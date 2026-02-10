/**
 * cli.ts — AgentCity CLI entry point
 *
 * Usage:
 *   npx tsx runtime/cli.ts run <workflow_name> [--driver mock|autopilot] [--question "..."] [--sources "a.pdf,b.md"]
 *   npx tsx runtime/cli.ts register <building> <version>
 *   npx tsx runtime/cli.ts promote <building> <version> <stage> [--force]
 *   npx tsx runtime/cli.ts rollback <building> <stage>
 *   npx tsx runtime/cli.ts eval <suite> [--driver mock|autopilot]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { runWorkflow } from "./workflowRunner.js";
import { register, promote, rollback, resolveVersion } from "./registry.js";
// ── Resolve Foundation root ────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FOUNDATION_ROOT = resolve(__dirname, "..");
// ── Load city config ───────────────────────────────────────────────────
function loadCityConfig() {
    const cityPath = resolve(FOUNDATION_ROOT, "city", "city.yaml");
    const raw = readFileSync(cityPath, "utf-8");
    return parseYaml(raw);
}
// ── Flag parser ────────────────────────────────────────────────────────
function getFlag(args, flag) {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length)
        return undefined;
    return args[idx + 1];
}
function hasFlag(args, flag) {
    return args.includes(flag);
}
// ── CLI Router ─────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
async function main() {
    writeFileSync("cli_debug.txt", `CLI Executing at ${new Date().toISOString()}\n`);
    const args = process.argv.slice(2);
    const command = args[0];
    if (!command) {
        printUsage();
        process.exit(1);
    }
    switch (command) {
        case "run": {
            const workflowName = args[1];
            if (!workflowName || workflowName.startsWith("--")) {
                console.error("Usage: ag run <workflow_name> [--driver mock|autopilot] [--question \"...\"] [--sources \"a.pdf,b.md\"]");
                process.exit(1);
            }
            const cityConfig = loadCityConfig();
            const workflowPath = `city/workflows/${workflowName}.yaml`;
            const options = {
                driver: getFlag(args, "--driver") ?? "mock",
                question: getFlag(args, "--question"),
                sources: getFlag(args, "--sources")?.split(",").map((s) => s.trim()),
            };
            const result = await runWorkflow(FOUNDATION_ROOT, workflowPath, cityConfig, options);
            console.log("── Run Summary ──────────────────────────────────");
            console.log(`   Success:  ${result.success}`);
            console.log(`   Trace ID: ${result.traceId}`);
            console.log(`   Run ID:   ${result.runId}`);
            console.log(`   Steps:    ${result.stepsExecuted}`);
            console.log(`   Trace:    ${result.traceFile}`);
            if (result.errors.length > 0) {
                console.log(`   Errors:`);
                for (const e of result.errors) {
                    console.log(`     - [${e.code}] ${e.message}`);
                }
            }
            process.exit(result.success ? 0 : 1);
            break;
        }
        case "eval": {
            const suiteName = args[1];
            if (!suiteName) {
                console.error("Usage: ag eval <suite_name> [--driver mock|autopilot]");
                process.exit(1);
            }
            const driver = getFlag(args, "--driver") ?? "mock";
            const suitePath = resolve(FOUNDATION_ROOT, "evals", `${suiteName}.ts`);
            console.log(`\n🧪 AgentCity Eval — Suite: ${suiteName} (driver: ${driver})\n`);
            // Dynamically import and run the eval suite
            try {
                const suite = await import(pathToFileURL(suitePath).href);
                const exitCode = await suite.run(FOUNDATION_ROOT, driver);
                process.exit(exitCode);
            }
            catch (err) {
                console.error(`Failed to load eval suite "${suiteName}":`, err);
                process.exit(1);
            }
            break;
        }
        case "register": {
            const building = args[1];
            const version = args[2];
            if (!building || !version) {
                console.error("Usage: ag register <building> <version>");
                process.exit(1);
            }
            register(FOUNDATION_ROOT, building, version, {
                permit_path: `buildings/${building}/building.yaml`,
                sop_version: "v1.0",
                git_sha: "LOCAL_DEV",
            });
            break;
        }
        case "promote": {
            const building = args[1];
            const version = args[2];
            const stage = (getFlag(args, "--env") ?? args[3]);
            const force = hasFlag(args, "--force");
            if (!building || !version || !stage) {
                console.error("Usage: ag promote <building> <version> --env <stage> [--force]");
                process.exit(1);
            }
            promote(FOUNDATION_ROOT, building, version, stage, { force });
            break;
        }
        case "rollback": {
            const building = args[1];
            const stage = (getFlag(args, "--env") ?? args[2]);
            if (!building || !stage) {
                console.error("Usage: ag rollback <building> --env <stage>");
                process.exit(1);
            }
            rollback(FOUNDATION_ROOT, building, stage);
            break;
        }
        case "resolve": {
            const building = args[1];
            const stage = (getFlag(args, "--env") ?? args[2]);
            if (!building) {
                console.error("Usage: ag resolve <building> [--env <stage>]");
                process.exit(1);
            }
            const resolved = resolveVersion(FOUNDATION_ROOT, building, stage);
            console.log(`${building}@${resolved.version}`);
            console.log(JSON.stringify(resolved.entry, null, 2));
            break;
        }
        case "audit": {
            const traceId = args[1];
            if (!traceId) {
                console.error("Usage: ag audit <trace_id>");
                process.exit(1);
            }
            await auditTrace(FOUNDATION_ROOT, traceId);
            break;
        }
        default:
            console.error(`Unknown command: "${command}"`);
            printUsage();
            process.exit(1);
    }
}
function printUsage() {
    console.log(`
🏙️  AgentCity CLI (ag)

Commands:
  run <workflow> [--driver mock|autopilot] [--question "..."] [--sources "a.pdf,b.md"]
                                        Run a workflow
  eval <suite> [--driver mock|autopilot] Run an eval suite
  audit <trace_id>                      Audit a trace for integrity
  register <building> <version>         Register a building version
  promote <building> <version> <stage> [--force]
                                        Promote a version to a stage
  rollback <building> <stage>           Rollback a stage to previous version
  resolve <building> [stage]            Show current version for a building
`);
}
// ── Audit Logic ────────────────────────────────────────────────────────
async function auditTrace(root, traceId) {
    console.log(`\n🔍 Auditing Trace: ${traceId}`);
    // 1. Find the trace file (it's in YYYY-MM-DD folder, but which one?)
    // We search all date folders in data/traces
    const tracesRoot = resolve(root, "data", "traces");
    if (!existsSync(tracesRoot)) {
        console.error("❌ data/traces directory not found.");
        process.exit(1);
    }
    let tracePath = null;
    let traceDate = null;
    const dates = readdirSync(tracesRoot).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    for (const date of dates) {
        const candidate = resolve(tracesRoot, date, `${traceId}.jsonl`);
        if (existsSync(candidate)) {
            tracePath = candidate;
            traceDate = date;
            break;
        }
    }
    if (!tracePath || !traceDate) {
        console.error(`❌ Trace file not found for ID ${traceId}`);
        process.exit(1);
    }
    console.log(`   ✓ Found trace file: data/traces/${traceDate}/${traceId}.jsonl`);
    // 2. Check Artifacts Folder
    const artifactsDir = resolve(tracesRoot, traceDate, traceId, "artifacts");
    if (!existsSync(artifactsDir)) {
        console.error(`❌ Artifacts folder missing: ${artifactsDir}`);
        process.exit(1);
    }
    console.log(`   ✓ Found artifacts folder`);
    // 3. Check Canonical Metadata
    const metaPath = resolve(artifactsDir, "notebooklm_metadata.json");
    if (!existsSync(metaPath)) {
        console.error(`❌ notebooklm_metadata.json missing`);
        process.exit(1);
    }
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    console.log(`   ✓ loaded notebooklm_metadata.json`);
    // Validate Schema (Basic checks)
    const requiredKeys = ["building", "driver", "notebook", "links"];
    const missing = requiredKeys.filter(k => !(k in meta));
    if (missing.length > 0) {
        console.error(`❌ Metadata missing keys: ${missing.join(", ")}`);
        process.exit(1);
    }
    // Check Links
    const links = meta.links || {};
    const checks = [
        { key: "output_json", path: resolve(artifactsDir, "output.json") },
        // trace_jsonl is relative to artifacts dir? "../ID.jsonl"
        // resolved: resolve(artifactsDir, meta.links.trace_jsonl)
        { key: "trace_jsonl", path: resolve(artifactsDir, links.trace_jsonl) },
        { key: "summary_md", path: resolve(artifactsDir, links.summary_md) }
    ];
    let linkErrors = 0;
    for (const { key, path } of checks) {
        if (!existsSync(path)) {
            console.error(`❌ Broken link: ${key} -> ${path}`);
            linkErrors++;
        }
        else {
            console.log(`   ✓ Link verified: ${key}`);
        }
    }
    if (linkErrors > 0) {
        console.error(`\n⛔ Audit FAILED: Broken links`);
        process.exit(1);
    }
    console.log(`\n✅ Audit PASSED: Trace ${traceId} is valid.`);
}
//# sourceMappingURL=cli.js.map