/**
 * toolGateway.ts — The single approved route for all tool calls in AgentCity
 *
 * Enforcement pipeline:
 *   1. Allowlist check
 *   2. Input contract validation
 *   3. Budget check
 *   4. Driver dispatch (reads input.driver ?? defaultForEnv)
 *   5. Output contract validation
 *   6. Trace emission
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import _Ajv, { type ValidateFunction } from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;
import { parse as parseYaml } from "yaml";
import { buildEvent, type TraceHandle, type AgentInfo, type RunInfo } from "./traceLogger.js";
import { getDriver, type DriverContext } from "./drivers/index.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface GatewayContext {
    foundationRoot: string;
    environment: string;
    trace: TraceHandle;
    agent: AgentInfo;
    runInfo: RunInfo;
    stepIndex: number;
    budgets: { max_tool_calls: number; timeout_seconds: number };
    traceDate: string;
    sopPath?: string;
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
 * Driver selection: reads input.driver ?? "mock" (default).
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

    // ── 4. Driver dispatch ────────────────────────────────────────────────
    // Driver selection is part of the tool input (traceable, reproducible)
    const typedInput = input as { driver?: string };
    const driverName = typedInput.driver ?? "mock";
    const driver = getDriver(driverName);

    const driverCtx: DriverContext = {
        foundationRoot: ctx.foundationRoot,
        environment: ctx.environment,
        traceId: ctx.trace.traceId,
        traceDate: ctx.traceDate,
        runId: ctx.runInfo.run_id,
        sopPath: ctx.sopPath,
    };

    console.log(`     ├─ Driver: ${driver.name}`);
    const output = await driver.execute(input as Parameters<typeof driver.execute>[0], driverCtx);

    // ── 5. Output contract validation ────────────────────────────────────
    const outputSchemaPath = resolve(ctx.foundationRoot, "buildings", building, "contracts", "output.schema.json");
    const outputValidator = getValidator(outputSchemaPath);

    if (!outputValidator(output)) {
        const errMsg = formatErrors(outputValidator);
        const errEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "error", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: `tool=${toolName} driver=${driverName}`,
            outputs_summary: errMsg,
        }, {
            errors: [{ code: "OUTPUT_CONTRACT_VIOLATION", message: errMsg }],
        });
        ctx.trace.emit(errEvent);
        throw new Error(`[toolGateway] Output contract violation from "${toolName}" (driver=${driverName}): ${errMsg}`);
    }

    // ── 6. Trace emission ────────────────────────────────────────────────
    const durationMs = Date.now() - startMs;
    const toolEvent = buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "tool_call", {
        step_index: ctx.stepIndex,
        step_type: "tool_call",
        status: "succeeded",
        inputs_summary: `tool=${toolName} driver=${driverName}`,
        outputs_summary: `answer=${(output as unknown as Record<string, unknown>)?.answer ? "present" : "missing"}`,
    }, {
        duration_ms: durationMs,
        tool: { name: toolName, driver: driverName, call_index: toolCallCount, cache_hit: false },
        security: { allowlist_check: "passed", input_contract: "passed", output_contract: "passed" },
    });
    ctx.trace.emit(toolEvent);

    return output;
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
