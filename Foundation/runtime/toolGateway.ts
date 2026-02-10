import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import _Ajv, { type ValidateFunction } from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;
import { getDriver, type ToolInput, type ToolResult, type DriverContext } from "./drivers/index.js";
import { buildEvent, type TraceHandle, type AgentInfo, type RunInfo } from "./traceLogger.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface GatewayContext {
    foundationRoot: string;
    environment: string;
    trace: TraceHandle;
    agent: AgentInfo; // who is calling (the city)
    runInfo: RunInfo;
    stepIndex: number;
    budgets: {
        max_tool_calls: number;
        timeout_seconds: number;
    };
    traceDate: string;
    sopPath?: string;
}

// ── State (Budgets & Cache) ────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = new Map<string, ValidateFunction>();
let toolCallCount = 0;

export function resetBudgets(): void {
    toolCallCount = 0;
}

// ── The Gateway ────────────────────────────────────────────────────────

/**
 * callTool — The single approved route for building execution.
 * Enforces contracts, budgets, and policies.
 */
export async function callTool(
    toolName: string,
    input: ToolInput,
    ctx: GatewayContext,
): Promise<ToolResult<unknown>> {
    const startMs = Date.now();
    const buildingName = toolName.replace(/^tool\./, "").replace(/\.run$/, ""); // e.g. "notebooklm"

    // 1. Budget Check
    toolCallCount++;
    if (toolCallCount > ctx.budgets.max_tool_calls) {
        throw new Error(`Budget exceeded: max_tool_calls=${ctx.budgets.max_tool_calls}`);
    }

    // 2. Load Contracts
    const inputContractPath = resolve(ctx.foundationRoot, "buildings", buildingName, "contracts", "input.schema.json");
    const outputContractPath = resolve(ctx.foundationRoot, "buildings", buildingName, "contracts", "output.schema.json");

    // 3. Validate Input
    if (inputContractPath) {
        const validate = getValidator(inputContractPath);
        if (!validate(input)) {
            const msg = formatErrors(validate);
            ctx.trace.emit(buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "error", {
                step_index: ctx.stepIndex,
                step_type: "tool_call",
                status: "failed",
                inputs_summary: `tool=${toolName}`,
                outputs_summary: "",
            }, {
                errors: [{ code: "INPUT_CONTRACT_VIOLATION", message: msg }],
            }));
            throw new Error(`Input contract violation for ${toolName}: ${msg}`);
        }
    }

    // 4. Trace Start
    ctx.trace.emit(buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "tool_call", {
        step_index: ctx.stepIndex,
        step_type: "tool_call",
        status: "started",
        inputs_summary: `${toolName} question="${input.question.slice(0, 50)}..."`,
        outputs_summary: "",
    }, {
        tool: { name: toolName, attempt: toolCallCount }
    }));

    // 5. Execute via Driver
    const driverName = input.driver || "mock";
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

    let result: ToolResult<unknown>;
    try {
        result = await driver.execute(input, driverCtx);
    } catch (err: any) {
        // Driver crash
        ctx.trace.emit(buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "tool_call", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: toolName,
            outputs_summary: "",
            errors: [{ code: "DRIVER_CRASH", message: err.message }],
        }));
        throw err;
    }

    // 6. Validate Output Payload
    let validationError: string | null = null;

    if (outputContractPath) {
        const validate = getValidator(outputContractPath);
        if (!validate(result.payload)) {
            validationError = formatErrors(validate);
        }
    }

    if (validationError) {
        // Soft failure: Attach error info to metadata but return result
        if (!result.meta) result.meta = { driver: driver.name, notebook: { title: null, id: null } };

        result.meta.status = "failed";
        result.meta.reason = `output_schema_failed: ${validationError}`;

        console.warn(`   ⚠️  Output validation failed: ${validationError}`);

        ctx.trace.emit(buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "tool_call", {
            step_index: ctx.stepIndex,
            step_type: "tool_call",
            status: "failed",
            inputs_summary: toolName,
            outputs_summary: "validation_failed",
            errors: [{ code: "OUTPUT_CONTRACT", message: validationError }],
        }));

        return result;
    }

    // 7. Trace End (Success)
    const durationMs = Date.now() - startMs;
    ctx.trace.emit(buildEvent(ctx.trace.traceId, ctx.runInfo, ctx.agent, "tool_call", {
        step_index: ctx.stepIndex,
        step_type: "tool_call",
        status: "succeeded",
        inputs_summary: toolName,
        outputs_summary: "schema_valid",
    }, {
        duration_ms: durationMs,
        tool: { name: toolName, driver: driverName, call_index: toolCallCount, cache_hit: false }
    }));

    return result;
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
