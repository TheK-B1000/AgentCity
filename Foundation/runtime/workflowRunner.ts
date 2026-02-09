/**
 * workflowRunner.ts — Execute YAML workflow steps for AgentCity
 *
 * Loads a workflow, dispatches each step by step_type,
 * wraps execution in run_start / run_end trace events.
 * Stores artifacts under data/traces/YYYY-MM-DD/<traceId>/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import _Ajv from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;
import { createTrace, buildEvent, type TraceHandle, type AgentInfo, type RunInfo } from "./traceLogger.js";
import { callTool, resetBudgets, type GatewayContext } from "./toolGateway.js";
import { resolveVersion } from "./registry.js";
import { initDrivers } from "./drivers/index.js";

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

export interface RunOptions {
    driver?: string;
    question?: string;
    sources?: string[];
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
    options: RunOptions = {},
): Promise<RunResult> {
    // Initialize drivers
    await initDrivers();

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

    // Derive trace date from filePath (data/traces/YYYY-MM-DD/<traceId>.jsonl)
    const traceDir = dirname(trace.filePath);
    const traceDate = traceDir.split(/[/\\]/).pop() ?? new Date().toISOString().slice(0, 10);

    // ── Emit run_start ───────────────────────────────────────────────────
    console.log(`\n🏙️  AgentCity — Running workflow: ${wf.workflow.name}`);
    console.log(`   Trace: ${trace.traceId}`);
    console.log(`   Driver: ${options.driver ?? "mock"}`);
    console.log(`   File:  ${trace.filePath}\n`);

    trace.emit(buildEvent(trace.traceId, runInfo, agent, "run_start", {
        step_index: 0,
        step_type: "run_start",
        status: "started",
        inputs_summary: `workflow=${wf.workflow.name} env=${cityConfig.environment} driver=${options.driver ?? "mock"}`,
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
                    output = await handleToolCall(i, step, trace, runInfo, agent, foundationRoot, cityConfig, options, traceDate);
                    break;
                case "verify":
                    await handleVerify(i, step, trace, runInfo, agent, foundationRoot, output);
                    break;
                case "report":
                    await handleReport(i, step, trace, runInfo, agent, output, foundationRoot, trace.traceId, traceDate);
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
    options: RunOptions, traceDate: string,
): Promise<unknown> {
    console.log(`   → [${index}] tool_call: ${step.name} → ${step.tool}`);

    if (!step.tool) throw new Error(`Step "${step.name}" is tool_call but has no "tool" field.`);
    if (!step.building) throw new Error(`Step "${step.name}" has no "building" field.`);

    // Resolve building by environment stage pointer (not hardcoded)
    const envStage = cityConfig.environment as "dev" | "staging" | "prod";
    const resolved = resolveVersion(foundationRoot, step.building, envStage);
    console.log(`     ├─ Resolved ${step.building}@${resolved.version} (stage: ${envStage})`);

    // Load SOP for context
    if (step.sop_path) {
        const sopFull = resolve(foundationRoot, step.sop_path);
        const sop = parseYaml(readFileSync(sopFull, "utf-8"));
        console.log(`     ├─ SOP loaded: ${(sop as Record<string, unknown>)?.sop ?? step.sop_path}`);
    }

    // Build tool input from RunOptions (driver is part of input — traceable)
    const toolInput = {
        sources: options.sources ?? ["VerseRidge_Overview.pdf", "AgentOps_Design_Brief.md"],
        question: options.question ?? "What are the key principles of the AgentCity governance model?",
        driver: options.driver ?? "mock",
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
        traceDate,
        sopPath: step.sop_path,
    };

    const result = await callTool(step.tool, toolInput, gatewayCtx);
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
    foundationRoot: string, traceId: string, traceDate: string,
): Promise<void> {
    console.log(`   → [${index}] report: ${step.name}`);

    const summary = output
        ? `output_keys=${Object.keys(output as Record<string, unknown>).join(",")}`
        : "no output";

    // ── Store artifacts under trace folder ─────────────────────────────
    const artifactsDir = resolve(foundationRoot, "data", "traces", traceDate, traceId, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    // output.json
    writeFileSync(
        resolve(artifactsDir, "output.json"),
        JSON.stringify(output, null, 2) + "\n",
        "utf-8",
    );

    // summary.md
    const typedOutput = output as Record<string, unknown> | null;
    const summaryMd = [
        `# Run Summary`,
        ``,
        `- **Trace ID**: ${traceId}`,
        `- **Date**: ${traceDate}`,
        `- **Status**: succeeded`,
        ``,
        `## Answer`,
        ``,
        String(typedOutput?.answer ?? "(no answer)"),
        ``,
        `## Citations`,
        ``,
        ...((typedOutput?.citations as Array<{ source: string; locator: string }>) ?? []).map(
            (c) => `- **${c.source}** — ${c.locator}`,
        ),
        ``,
        typedOutput?.limits ? `## Limits\n\n${typedOutput.limits}\n` : "",
    ].join("\n");

    const summaryPath = resolve(foundationRoot, "data", "traces", traceDate, `${traceId}.summary.md`);
    writeFileSync(summaryPath, summaryMd, "utf-8");

    // ── Copy external records into trace (immutable snapshots) ────────
    const externalLinks = copyExternalRecords(foundationRoot, artifactsDir);

    // ── Write notebooklm_metadata.json with links.* pointers ─────────
    const metadataPath = resolve(artifactsDir, "notebooklm_metadata.json");
    const metadata = {
        trace_id: traceId,
        trace_date: traceDate,
        step: step.name,
        timestamp_utc: new Date().toISOString(),
        links: externalLinks,
    };
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf-8");

    console.log(`     ├─ 📁 Artifact: ${artifactsDir}/output.json`);
    console.log(`     ├─ 📝 Summary: ${summaryPath}`);
    console.log(`     ├─ 📋 Metadata: notebooklm_metadata.json (${Object.keys(externalLinks).filter((k) => externalLinks[k] !== null).length} links)`);

    trace.emit(buildEvent(trace.traceId, runInfo, agent, "step_end", {
        step_index: index,
        step_type: "report",
        status: "succeeded",
        inputs_summary: step.output ?? step.name,
        outputs_summary: summary,
    }));

    console.log(`     └─ Report recorded: ${summary}`);
}

// ── External Records Copier ────────────────────────────────────────────

interface ExternalLinkMap {
    context_brief_json_path: string | null;
    context_brief_md_path: string | null;
    [key: string]: string | null;
}

/**
 * Copy known external briefs from VerseRidge Corporate/.agent/docs/ into
 * the trace artifacts folder. External files can change later — the copy
 * makes the run immutable.
 */
function copyExternalRecords(foundationRoot: string, artifactsDir: string): ExternalLinkMap {
    const docsRoot = resolve(foundationRoot, "..", "VerseRidge Corporate", ".agent", "docs");
    const externalDir = resolve(artifactsDir, "external_records");
    mkdirSync(externalDir, { recursive: true });

    const links: ExternalLinkMap = {
        context_brief_json_path: null,
        context_brief_md_path: null,
    };

    // Known external files to snapshot
    const filesToCopy: Array<{ file: string; linkKey: string }> = [
        { file: "context_brief.json", linkKey: "context_brief_json_path" },
        { file: "context_brief.md", linkKey: "context_brief_md_path" },
        { file: "ultimate_agent_brief.md", linkKey: "ultimate_agent_brief_path" },
        { file: "master_agentic_context.md", linkKey: "master_agentic_context_path" },
    ];

    for (const { file, linkKey } of filesToCopy) {
        const srcPath = resolve(docsRoot, file);
        if (existsSync(srcPath)) {
            const dest = resolve(externalDir, file);
            copyFileSync(srcPath, dest);
            links[linkKey] = `artifacts/external_records/${file}`;
            console.log(`     ├─ 📥 Copied ${file} (immutable snapshot)`);
        }
    }

    return links;
}
