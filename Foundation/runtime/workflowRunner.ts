/**
 * workflowRunner.ts — Execute YAML workflow steps for AgentCity
 *
 * Loads a workflow, dispatches each step by step_type,
 * wraps execution in run_start / run_end trace events.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parse as parseYaml } from "yaml";
import _Ajv from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;
import { createTrace, buildEvent, type TraceHandle, type AgentInfo, type RunInfo } from "./traceLogger.js";
import { callTool, resetBudgets, type GatewayContext } from "./toolGateway.js";
import { resolveVersion } from "./registry.js";

// ── Types ──────────────────────────────────────────────────────────────

interface WorkflowStep {
    step_type: "step_start" | "step_end" | "tool_call" | "verify" | "report" | "error";
    name: string;
    tool?: string;
    building?: string;
    input_contract?: string;
    output_contract?: string;
    sop_path?: string;
    checks?: Array<{ type: string; contract?: string; min_citations?: number }>;
    output?: string;
}

interface WorkflowDef {
    workflow: {
        name: string;
        version: string;
        description: string;
    };
    steps: WorkflowStep[];
}

export interface CityConfig {
    city: { name: string; version: string };
    environment: string;
    defaults: {
        budgets: { max_steps: number; max_tool_calls: number; timeout_seconds: number };
    };
    observability: { traces_dir: string; format: string; event_schema: string };
    registry: { path: string };
    governance: { policy_mode: string; least_agency: boolean };
}

export interface RunResult {
    success: boolean;
    traceFile: string;
    traceId: string;
    runId: string;
    output: unknown;
    stepsExecuted: number;
    errors: Array<{ code: string; message: string }>;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Run a workflow from a YAML file.
 */
export async function runWorkflow(
    foundationRoot: string,
    workflowPath: string,
    cityConfig: CityConfig,
): Promise<RunResult> {
    // Load workflow YAML
    const fullPath = resolve(foundationRoot, workflowPath);
    const wfRaw = readFileSync(fullPath, "utf-8");
    const wf = parseYaml(wfRaw) as WorkflowDef;

    const agent: AgentInfo = {
        name: cityConfig.city.name,
        version: cityConfig.city.version,
    };

    // Create trace session
    const trace = createTrace(foundationRoot, wf.workflow.name, cityConfig.environment);

    const runInfo: RunInfo = {
        run_id: trace.runId,
        workflow: wf.workflow.name,
        environment: cityConfig.environment,
    };

    const errors: Array<{ code: string; message: string }> = [];
    let output: unknown = null;
    let stepsExecuted = 0;

    // Reset tool call budgets
    resetBudgets();

    // ── Emit run_start ───────────────────────────────────────────────────
    console.log(`\n🏙️  AgentCity — Running workflow: ${wf.workflow.name}`);
    console.log(`   Trace: ${trace.traceId}`);
    console.log(`   File:  ${trace.filePath}\n`);

    trace.emit(buildEvent(trace.traceId, runInfo, agent, "run_start", {
        step_index: 0,
        step_type: "run_start",
        status: "started",
        inputs_summary: `workflow=${wf.workflow.name} env=${cityConfig.environment}`,
        outputs_summary: "",
    }));

    // ── Execute steps ────────────────────────────────────────────────────
    for (let i = 0; i < wf.steps.length; i++) {
        const step = wf.steps[i];
        stepsExecuted++;

        if (stepsExecuted > cityConfig.defaults.budgets.max_steps) {
            errors.push({ code: "MAX_STEPS_EXCEEDED", message: `Exceeded max_steps budget (${cityConfig.defaults.budgets.max_steps}).` });
            break;
        }

        try {
            switch (step.step_type) {
                case "step_start":
                    await handleStepStart(i, step, trace, runInfo, agent);
                    break;
                case "tool_call":
                    output = await handleToolCall(i, step, trace, runInfo, agent, foundationRoot, cityConfig);
                    break;
                case "verify":
                    await handleVerify(i, step, trace, runInfo, agent, foundationRoot, output);
                    break;
                case "report":
                    await handleReport(i, step, trace, runInfo, agent, output);
                    break;
                case "step_end":
                    await handleStepEnd(i, step, trace, runInfo, agent);
                    break;
                default:
                    throw new Error(`Unknown step_type: "${step.step_type}"`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push({ code: "STEP_FAILED", message });

            trace.emit(buildEvent(trace.traceId, runInfo, agent, "error", {
                step_index: i,
                step_type: step.step_type,
                status: "failed",
                inputs_summary: `step=${step.name}`,
                outputs_summary: "",
            }, {
                errors: [{ code: "STEP_FAILED", message }],
            }));

            console.error(`   ❌ Step "${step.name}" failed: ${message}`);
            break; // halt on error
        }
    }

    // ── Emit run_end ─────────────────────────────────────────────────────
    const finalStatus = errors.length === 0 ? "succeeded" : "failed";
    trace.emit(buildEvent(trace.traceId, runInfo, agent, "run_end", {
        step_index: stepsExecuted,
        step_type: "run_end",
        status: finalStatus,
        inputs_summary: `steps_executed=${stepsExecuted}`,
        outputs_summary: finalStatus,
    }, {
        errors: errors.length > 0 ? errors : undefined,
    }));

    trace.close();

    const success = errors.length === 0;
    if (success) {
        console.log(`\n   ✅ Workflow completed successfully.`);
    } else {
        console.log(`\n   ⛔ Workflow completed with errors.`);
    }
    console.log(`   Trace file: ${trace.filePath}\n`);

    return {
        success,
        traceFile: trace.filePath,
        traceId: trace.traceId,
        runId: trace.runId,
        output,
        stepsExecuted,
        errors,
    };
}

// ── Step Handlers ──────────────────────────────────────────────────────

async function handleStepStart(
    index: number, step: WorkflowStep,
    trace: TraceHandle, runInfo: RunInfo, agent: AgentInfo,
): Promise<void> {
    console.log(`   → [${index}] step_start: ${step.name}`);
    trace.emit(buildEvent(trace.traceId, runInfo, agent, "step_start", {
        step_index: index,
        step_type: "step_start",
        status: "started",
        inputs_summary: step.name,
        outputs_summary: "",
    }));
}

async function handleStepEnd(
    index: number, step: WorkflowStep,
    trace: TraceHandle, runInfo: RunInfo, agent: AgentInfo,
): Promise<void> {
    console.log(`   → [${index}] step_end: ${step.name}`);
    trace.emit(buildEvent(trace.traceId, runInfo, agent, "step_end", {
        step_index: index,
        step_type: "step_end",
        status: "succeeded",
        inputs_summary: step.name,
        outputs_summary: "",
    }));
}

async function handleToolCall(
    index: number, step: WorkflowStep,
    trace: TraceHandle, runInfo: RunInfo, agent: AgentInfo,
    foundationRoot: string, cityConfig: CityConfig,
): Promise<unknown> {
    console.log(`   → [${index}] tool_call: ${step.name} → ${step.tool}`);

    if (!step.tool) throw new Error(`Step "${step.name}" is tool_call but has no "tool" field.`);
    if (!step.building) throw new Error(`Step "${step.name}" has no "building" field.`);

    // Verify building is registered and resolved
    const resolved = resolveVersion(foundationRoot, step.building);
    console.log(`     ├─ Resolved ${step.building}@${resolved.version}`);

    // Load SOP for context (informational in v1)
    if (step.sop_path) {
        const sopFull = resolve(foundationRoot, step.sop_path);
        const sop = parseYaml(readFileSync(sopFull, "utf-8"));
        console.log(`     ├─ SOP loaded: ${(sop as Record<string, unknown>)?.sop ?? step.sop_path}`);
    }

    // Build mock input matching input.schema.json
    const mockInput = {
        sources: ["VerseRidge_Overview.pdf", "AgentOps_Design_Brief.md"],
        question: "What are the key principles of the AgentCity governance model?",
        constraints: {
            max_words: 500,
            require_citations: true,
        },
    };

    const gatewayCtx: GatewayContext = {
        foundationRoot,
        environment: cityConfig.environment,
        trace,
        agent,
        runInfo,
        stepIndex: index,
        budgets: {
            max_tool_calls: cityConfig.defaults.budgets.max_tool_calls,
            timeout_seconds: cityConfig.defaults.budgets.timeout_seconds,
        },
    };

    const result = await callTool(step.tool, mockInput, gatewayCtx);
    console.log(`     └─ Tool call succeeded`);
    return result;
}

async function handleVerify(
    index: number, step: WorkflowStep,
    trace: TraceHandle, runInfo: RunInfo, agent: AgentInfo,
    foundationRoot: string, output: unknown,
): Promise<void> {
    console.log(`   → [${index}] verify: ${step.name}`);

    if (!step.checks || step.checks.length === 0) {
        console.log(`     └─ No checks defined, skipping.`);
        return;
    }

    for (const check of step.checks) {
        if (check.type === "output_schema" && check.contract) {
            const schemaPath = resolve(foundationRoot, check.contract);
            const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
            const ajvInstance = new Ajv({ allErrors: true, strict: false });
            const validate = ajvInstance.compile(schema);

            if (!validate(output)) {
                const errMsg = validate.errors?.map((e: { instancePath: string; message?: string }) => `${e.instancePath} ${e.message}`).join(";");
                throw new Error(`Output schema verification failed: ${errMsg}`);
            }
            console.log(`     ├─ ✓ output_schema: passed`);
        }

        if (check.type === "citations_present") {
            const typedOutput = output as { citations?: unknown[] } | null;
            const citationCount = typedOutput?.citations?.length ?? 0;
            const minRequired = check.min_citations ?? 1;

            if (citationCount < minRequired) {
                throw new Error(`Citations check failed: found ${citationCount}, required ≥ ${minRequired}.`);
            }
            console.log(`     ├─ ✓ citations_present: ${citationCount} citations (min=${minRequired})`);
        }
    }

    trace.emit(buildEvent(trace.traceId, runInfo, agent, "step_end", {
        step_index: index,
        step_type: "verify",
        status: "succeeded",
        inputs_summary: `checks=${step.checks.map((c) => c.type).join(",")}`,
        outputs_summary: "all checks passed",
    }));

    console.log(`     └─ All verification checks passed`);
}

async function handleReport(
    index: number, step: WorkflowStep,
    trace: TraceHandle, runInfo: RunInfo, agent: AgentInfo,
    output: unknown,
): Promise<void> {
    console.log(`   → [${index}] report: ${step.name}`);

    const summary = output
        ? `output_keys=${Object.keys(output as Record<string, unknown>).join(",")}`
        : "no output";

    trace.emit(buildEvent(trace.traceId, runInfo, agent, "step_end", {
        step_index: index,
        step_type: "report",
        status: "succeeded",
        inputs_summary: step.output ?? step.name,
        outputs_summary: summary,
    }));

    console.log(`     └─ Report recorded: ${summary}`);
}
