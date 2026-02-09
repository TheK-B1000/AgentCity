/**
 * cli.ts — AgentCity CLI entry point
 *
 * Usage:
 *   npx tsx runtime/cli.ts run <workflow_name>
 *   npx tsx runtime/cli.ts register <building> <version>
 *   npx tsx runtime/cli.ts promote <building> <version> <stage>
 *   npx tsx runtime/cli.ts rollback <building> <stage>
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { runWorkflow, type CityConfig } from "./workflowRunner.js";
import { register, promote, rollback, resolveVersion, type Stage } from "./registry.js";

// ── Resolve Foundation root ────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FOUNDATION_ROOT = resolve(__dirname, "..");

// ── Load city config ───────────────────────────────────────────────────

function loadCityConfig(): CityConfig {
    const cityPath = resolve(FOUNDATION_ROOT, "city", "city.yaml");
    const raw = readFileSync(cityPath, "utf-8");
    return parseYaml(raw) as CityConfig;
}

// ── CLI Router ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        printUsage();
        process.exit(1);
    }

    switch (command) {
        case "run": {
            const workflowName = args[1];
            if (!workflowName) {
                console.error("Usage: ag run <workflow_name>");
                process.exit(1);
            }

            const cityConfig = loadCityConfig();
            const workflowPath = `city/workflows/${workflowName}.yaml`;

            const result = await runWorkflow(FOUNDATION_ROOT, workflowPath, cityConfig);

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
            const stage = args[3] as Stage;
            const force = args.includes("--force");

            if (!building || !version || !stage) {
                console.error("Usage: ag promote <building> <version> <stage> [--force]");
                process.exit(1);
            }

            promote(FOUNDATION_ROOT, building, version, stage, { force });
            break;
        }

        case "rollback": {
            const building = args[1];
            const stage = args[2] as Stage;

            if (!building || !stage) {
                console.error("Usage: ag rollback <building> <stage>");
                process.exit(1);
            }

            rollback(FOUNDATION_ROOT, building, stage);
            break;
        }

        case "resolve": {
            const building = args[1];
            const stage = args[2] as Stage | undefined;

            if (!building) {
                console.error("Usage: ag resolve <building> [stage]");
                process.exit(1);
            }

            const resolved = resolveVersion(FOUNDATION_ROOT, building, stage);
            console.log(`${building}@${resolved.version}`);
            console.log(JSON.stringify(resolved.entry, null, 2));
            break;
        }

        default:
            console.error(`Unknown command: "${command}"`);
            printUsage();
            process.exit(1);
    }
}

function printUsage(): void {
    console.log(`
🏙️  AgentCity CLI (ag)

Commands:
  run <workflow>                      Run a workflow
  register <building> <version>       Register a building version
  promote <building> <version> <stage> [--force]
                                      Promote a version to a stage
  rollback <building> <stage>         Rollback a stage to previous version
  resolve <building> [stage]          Show current version for a building
`);
}

// ── Entry ──────────────────────────────────────────────────────────────

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
