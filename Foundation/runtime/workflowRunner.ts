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

/** Internal container so handleReport gets both tool output and building info. */
interface RunOutput {
    toolOutput: unknown;
    building?: string;
    buildingVersion?: string;
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
    let runOutput: RunOutput = { toolOutput: null };
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
                    runOutput = await handleToolCall(i, step, trace, runInfo, agent, foundationRoot, cityConfig, options, traceDate);
                    break;
                case "verify":
                    await handleVerify(i, step, trace, runInfo, agent, foundationRoot, runOutput.toolOutput);
                    break;
                case "report":
                    await handleReport(i, step, trace, runInfo, agent, runOutput, foundationRoot, trace.traceId, traceDate, options);
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
        output: runOutput.toolOutput,
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
): Promise<RunOutput> {
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

    return {
        toolOutput: result,
        building: step.building,
        buildingVersion: resolved.version,
    };
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
    runOutput: RunOutput,
    foundationRoot: string, traceId: string, traceDate: string,
    options: RunOptions,
): Promise<void> {
    console.log(`   → [${index}] report: ${step.name}`);

    const output = runOutput.toolOutput;
    const summary = output
        ? `output_keys=${Object.keys(output as Record<string, unknown>).join(",")}`
        : "no output";

    // ── Store artifacts under trace folder ─────────────────────────────
    const artifactsDir = resolve(foundationRoot, "data", "traces", traceDate, traceId, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    // output.json (strip _driverMeta — it's in-memory only)
    const persistOutput = { ...(output as Record<string, unknown>) };
    delete persistOutput._driverMeta;
    writeFileSync(
        resolve(artifactsDir, "output.json"),
        JSON.stringify(persistOutput, null, 2) + "\n",
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

    // ── Copy external records (immutable snapshots) ───────────────────
    const externalRecords = copyAndSnapshotExternalRecords(foundationRoot, artifactsDir);

    // ── Write SINGLE CANONICAL notebooklm_metadata.json ──────────────
    // One file. One truth. Merges driver meta + external records + links.
    const driverMeta = (typedOutput as Record<string, unknown> | null)?._driverMeta as Record<string, unknown> | undefined;

    const canonicalMetadata = {
        building: runOutput.building ?? "notebooklm",
        building_version: runOutput.buildingVersion ?? "unknown",
        driver: driverMeta?.driver ?? options.driver ?? "mock",
        notebook: driverMeta?.notebook ?? { title: null, id: null },
        external_records: externalRecords,
        links: {
            output_json: "artifacts/output.json",
            trace_jsonl: `../${traceId}.jsonl`,
            summary_md: `../${traceId}.summary.md`,
        },
    };

    const metadataPath = resolve(artifactsDir, "notebooklm_metadata.json");
    writeFileSync(metadataPath, JSON.stringify(canonicalMetadata, null, 2) + "\n", "utf-8");

    const foundCount = Object.values(externalRecords).filter((v) => typeof v === "string").length;
    console.log(`     ├─ 📁 Artifact: ${artifactsDir}/output.json`);
    console.log(`     ├─ 📝 Summary: ${summaryPath}`);
    console.log(`     ├─ 📋 Metadata (canonical): notebooklm_metadata.json (${foundCount} external records)`);

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

/** Present files → path string. Missing files → structured reason. */
type ExternalRecordEntry = string | {
    path: null;
    status: "missing";
    expected_from: string;
    note: string;
};

interface KnownFile {
    file: string;
    key: string;
    expected_from: string;
    note_if_missing: string;
}

/**
 * Copy known external briefs into trace artifacts. External files can change
 * later — the copy makes the run immutable. Missing files get structured null
 * so old traces are self-documenting.
 */
function copyAndSnapshotExternalRecords(
    foundationRoot: string,
    artifactsDir: string,
): Record<string, ExternalRecordEntry> {
    const docsRoot = resolve(foundationRoot, "..", "VerseRidge Corporate", ".agent", "docs");
    const externalDir = resolve(artifactsDir, "external_records");
    mkdirSync(externalDir, { recursive: true });

    const knownFiles: KnownFile[] = [
        {
            file: "context_brief.json",
            key: "context_brief_json",
            expected_from: "notebook-booster",
            note_if_missing: "notebook-booster has not produced context_brief.json yet",
        },
        {
            file: "context_brief.md",
            key: "context_brief_md",
            expected_from: "notebook-booster",
            note_if_missing: "notebook-booster has not produced context_brief.md yet",
        },
        {
            file: "ultimate_agent_brief.md",
            key: "ultimate_agent_brief",
            expected_from: "agent docs",
            note_if_missing: "VerseRidge Corporate/.agent/docs/ultimate_agent_brief.md not found",
        },
        {
            file: "master_agentic_context.md",
            key: "master_agentic_context",
            expected_from: "agent docs",
            note_if_missing: "VerseRidge Corporate/.agent/docs/master_agentic_context.md not found",
        },
    ];

    const records: Record<string, ExternalRecordEntry> = {};

    for (const { file, key, expected_from, note_if_missing } of knownFiles) {
        const srcPath = resolve(docsRoot, file);
        if (existsSync(srcPath)) {
            const dest = resolve(externalDir, file);
            copyFileSync(srcPath, dest);
            records[key] = `artifacts/external_records/${file}`;
            console.log(`     ├─ 📥 Copied ${file} (immutable snapshot)`);
        } else {
            records[key] = {
                path: null,
                status: "missing",
                expected_from,
                note: note_if_missing,
            };
        }
    }

    return records;
}
