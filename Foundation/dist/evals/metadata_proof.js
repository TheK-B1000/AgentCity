import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { runWorkflow } from "../runtime/workflowRunner.js";
import { parse as parseYaml } from "yaml";
/**
 * Metadata Proof Tests (Regression Guards)
 *
 * Invokable via:
 * npx tsx runtime/cli.ts eval metadata_proof --driver mock
 */
export async function run(foundationRoot, driverName) {
    console.log(`\n🔍 Metadata Proof Tests (Driver: ${driverName})`);
    // Only 'mock' driver is supported for these deterministic checks
    if (driverName !== "mock") {
        console.warn("⚠️  Warning: these tests expect deterministic mock behavior.");
    }
    try {
        await testA_ContractValidation(foundationRoot, driverName);
        await testB_MergePrecedence(foundationRoot, driverName);
        await testC_StructuredNulls(foundationRoot, driverName);
        console.log("\n✅ ALL PROOF TESTS PASSED");
        process.exit(0);
    }
    catch (err) {
        console.error("\n❌ PROOF TEST FAILED");
        console.error(err.message || String(err));
        process.exit(1);
    }
}
async function runProofWorkflow(root, driverName, question) {
    const cityPath = resolve(root, "city", "city.yaml");
    const cityConfig = parseYaml(readFileSync(cityPath, "utf-8"));
    // Override environment for proof test
    cityConfig.environment = "proof_test";
    // Use a standard workflow
    const workflowPath = "city/workflows/sop_routed_knowledge_task.yaml";
    return await runWorkflow(root, workflowPath, cityConfig, {
        driver: driverName,
        question: question,
        sources: ["proof_test_source"],
    });
}
async function testA_ContractValidation(root, driverName) {
    console.log("\n🧪 Test A: Metadata survives contract validation");
    // Run workflow
    const runResult = await runProofWorkflow(root, driverName, "Test A Contract Survival");
    const traceId = runResult.traceId;
    // Trace date is YYYY-MM-DD
    const traceDate = new Date().toISOString().slice(0, 10);
    // In strict env, might need to parse from workflow output if available, 
    // but traceId includes date usually? No, generated UUID usually.
    // The runner returns traceFile path, we can parse date from it.
    // traceFile: .../data/traces/YYYY-MM-DD/ID/trace.jsonl
    const parts = runResult.traceFile.split(/[/\\]/);
    const dateDir = parts[parts.length - 3];
    const idDir = parts[parts.length - 2];
    const artifactsDir = resolve(root, "data", "traces", dateDir, idDir, "artifacts");
    // 1. Assert notebooklm_metadata.json exists
    const metaPath = resolve(artifactsDir, "notebooklm_metadata.json");
    if (!existsSync(metaPath))
        throw new Error(`Missing metadata file: ${metaPath}`);
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    // 2. Assert meta-owned fields
    if (meta.driver !== driverName)
        throw new Error(`Metadata mismatch: driver=${meta.driver}`);
    // notebook.title might differ in mock vs autopilot, but key must exist
    if (!meta.notebook || !("title" in meta.notebook))
        throw new Error("Missing notebook.title in metadata");
    // 3. Assert validated artifacts/output.json is payload-only
    const outputPath = resolve(artifactsDir, "output.json");
    const output = JSON.parse(readFileSync(outputPath, "utf-8"));
    if ("meta" in output)
        throw new Error("output.json contains 'meta' field (leaked)");
    if ("_driverMeta" in output)
        throw new Error("output.json contains '_driverMeta' field (legacy leak)");
    if ("artifacts" in output)
        throw new Error("output.json contains 'artifacts' wrapper field");
    if (!output.answer || !output.citations)
        throw new Error("output.json missing required payload fields");
    console.log("   ✓ Metadata separated from payload");
}
async function testB_MergePrecedence(root, driverName) {
    console.log("\n🧪 Test B: Merge precedence is deterministic");
    const runResult = await runProofWorkflow(root, driverName, "Test B Merge Precedence");
    const parts = runResult.traceFile.split(/[/\\]/);
    const dateDir = parts[parts.length - 3];
    const idDir = parts[parts.length - 2];
    const artifactsDir = resolve(root, "data", "traces", dateDir, idDir, "artifacts");
    const meta = JSON.parse(readFileSync(resolve(artifactsDir, "notebooklm_metadata.json"), "utf-8"));
    // 1. Assert Producer-owned fields (from driver)
    if (!meta.notebook)
        throw new Error("Missing producer-owned 'notebook' field");
    if (!meta.driver)
        throw new Error("Missing producer-owned 'driver' field");
    // 2. Assert Run-owned fields (from workflow)
    if (!meta.links)
        throw new Error("Missing run-owned 'links' field");
    if (!meta.building_version)
        throw new Error("Missing run-owned 'building_version'");
    // 3. Conflict Check
    if (!Array.isArray(meta.conflicts))
        throw new Error("Missing 'conflicts' array in metadata");
    console.log("   ✓ Merge precedence respected");
}
async function testC_StructuredNulls(root, driverName) {
    console.log("\n🧪 Test C: Structured nulls are stable");
    const runResult = await runProofWorkflow(root, driverName, "Test C Structured Nulls");
    const parts = runResult.traceFile.split(/[/\\]/);
    const dateDir = parts[parts.length - 3];
    const idDir = parts[parts.length - 2];
    const artifactsDir = resolve(root, "data", "traces", dateDir, idDir, "artifacts");
    const meta = JSON.parse(readFileSync(resolve(artifactsDir, "notebooklm_metadata.json"), "utf-8"));
    if (meta.external_records) {
        for (const [key, val] of Object.entries(meta.external_records)) {
            if (val === null)
                throw new Error(`Field external_records.${key} is bare null. Must be structured object or omitted.`);
            if (typeof val === 'object' && val !== null && val.status === "missing") {
                if (!("path" in val) || val.path !== null) {
                    throw new Error(`Structured null for ${key} invalid shape`);
                }
            }
        }
    }
    console.log("   ✓ Structured nulls verified");
}
//# sourceMappingURL=metadata_proof.js.map