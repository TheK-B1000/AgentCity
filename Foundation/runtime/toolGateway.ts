/**
 * toolGateway.ts — The single approved route for all tool calls in AgentCity
 *
 * Enforcement pipeline:
 *   1. Allowlist check
 *   2. Input contract validation
 *   3. Budget check
 *   4. Execute (v1: mock adapters)
 *   5. Output contract validation
 *   6. Trace emission
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import _Ajv, { type ValidateFunction } from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;
import { parse as parseYaml } from "yaml";
import { buildEvent, type TraceHandle, type AgentInfo, type RunInfo } from "./traceLogger.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface GatewayContext {
    foundationRoot: string;
    environment: string;
    trace: TraceHandle;
    agent: AgentInfo;
    runInfo: RunInfo;
    stepIndex: number;
    budgets: { max_tool_calls: number; timeout_seconds: number };
}

interface AllowlistPolicy {
    env: Record<string, { buildings: string[]; tools: string[] }>;
}

// ── State ──────────────────────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = new Map<string, ValidateFunction>();
let toolCallCount = 0;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Reset the per-run call counter (call at run start).
 */
export function resetBudgets(): void {
    toolCallCount = 0;
}

/**
 * The one front door for tool calls.
 * Returns the validated output from the tool adapter.
 */
export async function callTool(
    toolName: string,
    input: unknown,
    ctx: GatewayContext,
): Promise<unknown> {
    const startMs = Date.now();

    // ── 1. Allowlist check ───────────────────────────────────────────────
    const allowlistPath = resolve(ctx.foundationRoot, "city", "policies", "allowlist.yaml");
    const allowlist = parseYaml(readFileSync(allowlistPath, "utf-8")) as AllowlistPolicy;
    const envPolicy = allowlist.env[ctx.environment];

    if (!envPolicy || !envPolicy.tools.includes(toolName)) {
        const errEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "error", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: `tool=${toolName}`,
            outputs_summary: "",
        }, {
            errors: [{ code: "TOOL_NOT_ALLOWED", message: `Tool "${toolName}" is not on the allowlist for env "${ctx.environment}".` }],
        });
        ctx.trace.emit(errEvent);
        throw new Error(`[toolGateway] DENIED: "${toolName}" is not on the allowlist for "${ctx.environment}".`);
    }

    // ── 2. Input contract validation ─────────────────────────────────────
    // Derive contract path from the building associated with the tool
    const building = toolName.split(".")[1]; // tool.<building>.run → <building>
    const inputSchemaPath = resolve(ctx.foundationRoot, "buildings", building, "contracts", "input.schema.json");
    const inputValidator = getValidator(inputSchemaPath);

    if (!inputValidator(input)) {
        const errMsg = formatErrors(inputValidator);
        const errEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "error", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: `tool=${toolName}`,
            outputs_summary: "",
        }, {
            errors: [{ code: "INPUT_CONTRACT_VIOLATION", message: errMsg }],
        });
        ctx.trace.emit(errEvent);
        throw new Error(`[toolGateway] Input contract violation for "${toolName}": ${errMsg}`);
    }

    // ── 3. Budget check ──────────────────────────────────────────────────
    toolCallCount++;
    if (toolCallCount > ctx.budgets.max_tool_calls) {
        const errEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "error", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: `tool=${toolName} call#${toolCallCount}`,
            outputs_summary: "",
        }, {
            errors: [{ code: "BUDGET_EXCEEDED", message: `Tool call budget exceeded (max=${ctx.budgets.max_tool_calls}).` }],
        });
        ctx.trace.emit(errEvent);
        throw new Error(`[toolGateway] Budget exceeded: ${toolCallCount} calls > max ${ctx.budgets.max_tool_calls}.`);
    }

    // ── 4. Execute adapter (v1: mock) ────────────────────────────────────
    const output = await executeAdapter(toolName, input, ctx);

    // ── 5. Output contract validation ────────────────────────────────────
    const outputSchemaPath = resolve(ctx.foundationRoot, "buildings", building, "contracts", "output.schema.json");
    const outputValidator = getValidator(outputSchemaPath);

    if (!outputValidator(output)) {
        const errMsg = formatErrors(outputValidator);
        const errEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "error", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: `tool=${toolName}`,
            outputs_summary: errMsg,
        }, {
            errors: [{ code: "OUTPUT_CONTRACT_VIOLATION", message: errMsg }],
        });
        ctx.trace.emit(errEvent);
        throw new Error(`[toolGateway] Output contract violation from "${toolName}": ${errMsg}`);
    }

    // ── 6. Trace emission ────────────────────────────────────────────────
    const durationMs = Date.now() - startMs;
    const toolEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "tool_call", {
        step_index: ctx.stepIndex,
        step_type: "tool_call",
        status: "succeeded",
        inputs_summary: `tool=${toolName}`,
        outputs_summary: `answer=${(output as Record<string, unknown>)?.answer ? "present" : "missing"}`,
    }, {
        duration_ms: durationMs,
        tool: { name: toolName, call_index: toolCallCount, cache_hit: false },
        security: { allowlist_check: "passed", input_contract: "passed", output_contract: "passed" },
    });
    ctx.trace.emit(toolEvent);

    return output;
}

// ── Adapters (v1: mock/stub) ───────────────────────────────────────────

/**
 * v1 adapter dispatcher — returns mock output matching the output contract.
 * In v2+ this will dispatch to real tool implementations.
 */
async function executeAdapter(
    toolName: string,
    input: unknown,
    _ctx: GatewayContext,
): Promise<unknown> {
    const typedInput = input as { question?: string; sources?: string[] };

    if (toolName === "tool.notebooklm.run") {
        // Simulated NotebookLM response matching output.schema.json
        return {
            answer: `[Mock] Based on the provided sources, here is a synthesized answer to: "${typedInput.question ?? "(no question)"}".\n\nThis is a stub response from the v1 adapter. In production, this would be the actual NotebookLM output grounded in the ${typedInput.sources?.length ?? 0} provided source(s).`,
            citations: [
                {
                    source: typedInput.sources?.[0] ?? "unknown_source.pdf",
                    locator: "p.1, section 'Overview'",
                },
            ],
            limits: "This is a mock response — no actual source analysis was performed.",
        };
    }

    throw new Error(`[toolGateway] No adapter registered for tool "${toolName}".`);
}

// ── Internal Helpers ───────────────────────────────────────────────────

function getValidator(schemaPath: string): ValidateFunction {
    const cached = schemaCache.get(schemaPath);
    if (cached) return cached;

    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    const validate = ajv.compile(schema);
    schemaCache.set(schemaPath, validate);
    return validate;
}

function formatErrors(validate: ValidateFunction): string {
    return validate.errors
        ?.map((e) => `${e.instancePath || "/"} ${e.message}`)
        .join("; ") ?? "unknown validation error";
}
