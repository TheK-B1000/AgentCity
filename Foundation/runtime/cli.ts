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

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { runWorkflow, type CityConfig, type RunOptions } from "./workflowRunner.js";
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

// ── Flag parser ────────────────────────────────────────────────────────

function getFlag(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
    return args.includes(flag);
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
            if (!workflowName || workflowName.startsWith("--")) {
                console.error("Usage: ag run <workflow_name> [--driver mock|autopilot] [--question \"...\"] [--sources \"a.pdf,b.md\"]");
                process.exit(1);
            }

            const cityConfig = loadCityConfig();
            const workflowPath = `city/workflows/${workflowName}.yaml`;

            const options: RunOptions = {
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
            } catch (err) {
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
            const stage = (getFlag(args, "--env") ?? args[3]) as Stage;
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
            const stage = (getFlag(args, "--env") ?? args[2]) as Stage;

            if (!building || !stage) {
                console.error("Usage: ag rollback <building> --env <stage>");
                process.exit(1);
            }

            rollback(FOUNDATION_ROOT, building, stage);
            break;
        }

        case "resolve": {
            const building = args[1];
            const stage = (getFlag(args, "--env") ?? args[2]) as Stage | undefined;

            if (!building) {
                console.error("Usage: ag resolve <building> [--env <stage>]");
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
  run <workflow> [--driver mock|autopilot] [--question "..."] [--sources "a.pdf,b.md"]
                                        Run a workflow
  eval <suite> [--driver mock|autopilot] Run an eval suite
  register <building> <version>         Register a building version
  promote <building> <version> <stage> [--force]
                                        Promote a version to a stage
  rollback <building> <stage>           Rollback a stage to previous version
  resolve <building> [stage]            Show current version for a building
`);
}

// ── Entry ──────────────────────────────────────────────────────────────

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
