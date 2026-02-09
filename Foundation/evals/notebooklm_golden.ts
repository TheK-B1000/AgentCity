/**
 * evals/notebooklm_golden.ts — Golden-path eval suite for NotebookLM
 *
 * Runs in two modes:
 *   --driver mock      → deterministic checks (schema, citations, snapshot)
 *   --driver autopilot → integration checks (schema, citations, grounded content)
 *
 * Usage:
 *   npx tsx runtime/cli.ts eval notebooklm_golden --driver mock
 *   npx tsx runtime/cli.ts eval notebooklm_golden --driver autopilot
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import _Ajv from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;
import { runWorkflow, type CityConfig } from "../runtime/workflowRunner.js";
import { parse as parseYaml } from "yaml";

// ── Types ──────────────────────────────────────────────────────────────

interface EvalCheck {
    name: string;
    pass: boolean;
    detail: string;
}

// ── Entry point (called by CLI) ────────────────────────────────────────

export async function run(foundationRoot: string, driver: string): Promise<number> {
    const checks: EvalCheck[] = [];
    const workflowPath = "city/workflows/sop_routed_knowledge_task.yaml";

    // Load city config
    const cityPath = resolve(foundationRoot, "city", "city.yaml");
    const cityConfig = parseYaml(readFileSync(cityPath, "utf-8")) as CityConfig;

    // ── Run the workflow ──────────────────────────────────────────────────
    console.log(`   Running workflow with driver="${driver}"...\n`);

    const result = await runWorkflow(foundationRoot, workflowPath, cityConfig, {
        driver,
        question: "What are the key principles of the AgentCity governance model?",
        sources: ["Constitution.md", "AgentOps_Design_Brief.md"],
    });

    // ── Check 1: Workflow succeeded ────────────────────────────────────
    checks.push({
        name: "workflow_success",
        pass: result.success,
        detail: result.success ? "Workflow completed" : `Failed: ${result.errors.map((e) => e.message).join("; ")}`,
    });

    // ── Check 2: Output matches output.schema.json ─────────────────────
    const outputSchemaPath = resolve(foundationRoot, "buildings", "notebooklm", "contracts", "output.schema.json");
    const schema = JSON.parse(readFileSync(outputSchemaPath, "utf-8"));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const schemaValid = validate(result.output);
    checks.push({
        name: "output_schema_valid",
        pass: !!schemaValid,
        detail: schemaValid ? "Output matches output.schema.json" : `Schema errors: ${validate.errors?.map((e: { message?: string }) => e.message).join("; ")}`,
    });

    // ── Check 3: Answer is non-empty ───────────────────────────────────
    const output = result.output as { answer?: string; citations?: Array<{ source: string; locator: string }>; limits?: string } | null;
    const answerPresent = !!output?.answer && output.answer.length > 0;
    checks.push({
        name: "answer_present",
        pass: answerPresent,
        detail: answerPresent ? `Answer: ${output?.answer?.length ?? 0} chars` : "No answer in output",
    });

    // ── Check 4: At least 1 citation with source + locator ─────────────
    const citationCount = output?.citations?.length ?? 0;
    const citationsValid = citationCount >= 1 && (output?.citations ?? []).every((c) => c.source && c.locator);
    checks.push({
        name: "citations_valid",
        pass: citationsValid,
        detail: citationsValid ? `${citationCount} valid citations` : `Citations invalid (count=${citationCount})`,
    });

    // ── Check 5: Trace file exists and is valid JSONL ──────────────────
    const traceExists = existsSync(result.traceFile);
    let traceValid = false;
    if (traceExists) {
        const traceContent = readFileSync(result.traceFile, "utf-8").trim();
        const traceLines = traceContent.split("\n").filter((l: string) => l.trim());
        try {
            traceLines.forEach((l: string) => JSON.parse(l));
            traceValid = traceLines.length >= 5; // run_start, step_start, tool_call, verify, run_end minimum
        } catch { /* invalid JSON line */ }
    }
    checks.push({
        name: "trace_valid",
        pass: traceValid,
        detail: traceValid ? `Trace: ${result.traceFile}` : `Trace missing or invalid`,
    });

    // ── Check 6: Artifact files stored ─────────────────────────────────
    const traceDir = resolve(result.traceFile, "..");
    const traceId = result.traceId;
    const artifactDir = resolve(traceDir, traceId, "artifacts");
    const outputJsonExists = existsSync(resolve(artifactDir, "output.json"));
    const summaryMdPath = resolve(traceDir, `${traceId}.summary.md`);
    const summaryExists = existsSync(summaryMdPath);
    checks.push({
        name: "artifacts_stored",
        pass: outputJsonExists && summaryExists,
        detail: `output.json=${outputJsonExists ? "✓" : "✗"} summary.md=${summaryExists ? "✓" : "✗"}`,
    });

    // ── Driver-specific checks ─────────────────────────────────────────

    if (driver === "mock") {
        // Check 7 (mock): Answer is deterministic (contains known phrases)
        const knownPhrase = "One Front Door";
        const deterministic = output?.answer?.includes(knownPhrase) ?? false;
        checks.push({
            name: "mock_deterministic",
            pass: deterministic,
            detail: deterministic ? `Contains expected phrase "${knownPhrase}"` : `Missing expected phrase "${knownPhrase}"`,
        });
    }

    if (driver === "autopilot") {
        // Check 7 (autopilot): Answer references governance concepts
        const governanceTerms = ["governance", "allowlist", "promotion", "rollback", "reproducib"];
        const matchedTerms = governanceTerms.filter((t) => output?.answer?.toLowerCase().includes(t));
        const grounded = matchedTerms.length >= 2;
        checks.push({
            name: "autopilot_grounded",
            pass: grounded,
            detail: grounded ? `Grounded: matched ${matchedTerms.join(", ")}` : `Insufficient grounding: matched ${matchedTerms.length}/${governanceTerms.length} terms`,
        });
    }

    // ── Report ─────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(60)}`);
    console.log(`🧪 Eval Results: notebooklm_golden (driver=${driver})\n`);

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
        const icon = check.pass ? "✅" : "❌";
        console.log(`   ${icon} ${check.name}: ${check.detail}`);
        if (check.pass) passed++;
        else failed++;
    }

    console.log(`\n   ${passed}/${passed + failed} checks passed`);

    if (failed > 0) {
        console.log(`   ⛔ EVAL FAILED\n`);
        return 1;
    }

    console.log(`   ✅ EVAL PASSED\n`);
    return 0;
}
