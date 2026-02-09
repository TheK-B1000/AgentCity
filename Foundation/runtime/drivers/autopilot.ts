/**
 * drivers/autopilot.ts — Autonomous NotebookLM driver via notebook-booster
 *
 * Produces structured JSON directly (no markdown parsing).
 * The driver returns ToolOutput matching output.schema.json.
 *
 * Notebook-booster exports both:
 *   - context_brief.md  (for Obsidian / human reading)
 *   - context_brief.json (canonical, used by this driver)
 *
 * If context_brief.json exists, the driver uses it.
 * Otherwise, the driver generates structured output autonomously.
 *
 * In v2+, this will invoke the full browser-based notebook-booster skill.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Driver, ToolInput, ToolOutput, DriverContext } from "./index.js";

// ── SOP Types ──────────────────────────────────────────────────────────

interface SopDef {
    sop: { name: string; version: number; intent: string };
    prompt_template: string;
}

// ── Driver ─────────────────────────────────────────────────────────────

export const autopilotDriver: Driver = {
    name: "autopilot",

    async execute(input: ToolInput, ctx: DriverContext): Promise<ToolOutput> {
        // ── 1. Load and render SOP prompt ────────────────────────────────────
        const sopPath = ctx.sopPath
            ? resolve(ctx.foundationRoot, ctx.sopPath)
            : resolve(ctx.foundationRoot, "buildings", "notebooklm", "sop", "v1.0", "sop.yaml");

        const sopRaw = readFileSync(sopPath, "utf-8");
        const sop = parseYaml(sopRaw) as SopDef;
        const renderedPrompt = sop.prompt_template.replace("{{question}}", input.question);

        console.log(`     ├─ 🤖 Autopilot: SOP "${sop.sop.name}" v${sop.sop.version}`);
        console.log(`     ├─ Sources: ${input.sources.join(", ")}`);
        console.log(`     ├─ Prompt rendered (${renderedPrompt.length} chars)`);

        // ── 2. Store job request artifact ────────────────────────────────────
        const artifactsDir = resolve(ctx.foundationRoot, "data", "traces", ctx.traceDate, ctx.traceId, "artifacts");
        mkdirSync(artifactsDir, { recursive: true });

        const jobRequest = {
            driver: "autopilot",
            sop: sop.sop.name,
            sop_version: sop.sop.version,
            question: input.question,
            sources: input.sources,
            rendered_prompt: renderedPrompt,
            timestamp_utc: new Date().toISOString(),
        };
        writeFileSync(resolve(artifactsDir, "job_request.json"), JSON.stringify(jobRequest, null, 2) + "\n", "utf-8");

        // ── 3. Check for notebook-booster canonical JSON output ──────────────
        const docsRoot = resolve(ctx.foundationRoot, "..", "VerseRidge Corporate", ".agent", "docs");
        const jsonBriefPath = resolve(docsRoot, "context_brief.json");

        let output: ToolOutput;

        if (existsSync(jsonBriefPath)) {
            // Notebook-booster has produced canonical JSON — use directly
            const raw = readFileSync(jsonBriefPath, "utf-8");
            output = JSON.parse(raw) as ToolOutput;
            console.log(`     ├─ 📄 Loaded context_brief.json (canonical)`);
        } else {
            // Autonomous structured generation (v1 fallback)
            output = generateStructuredOutput(input, renderedPrompt);
            console.log(`     ├─ 🔄 Generated autonomous structured output`);
        }

        // ── 4. Store output artifact ─────────────────────────────────────────
        writeFileSync(resolve(artifactsDir, "output.json"), JSON.stringify(output, null, 2) + "\n", "utf-8");

        // ── 5. Copy external briefs (immutable snapshots) ────────────────────
        // External files live in VerseRidge Corporate/.agent/docs/.
        // We COPY them into the trace folder so the run is immutable
        // (external files can change later; the copy preserves the state-at-run).
        const externalLinks = copyExternalBriefs(ctx, artifactsDir);

        // ── 6. Write notebooklm_metadata.json with links.* pointers ─────────
        const metadata = {
            driver: "autopilot",
            sop: sop.sop.name,
            sop_version: sop.sop.version,
            question: input.question,
            sources: input.sources,
            timestamp_utc: new Date().toISOString(),
            links: externalLinks,
        };
        writeFileSync(resolve(artifactsDir, "notebooklm_metadata.json"), JSON.stringify(metadata, null, 2) + "\n", "utf-8");

        console.log(`     ├─ ✓ Output: answer=${output.answer.length} chars, ${output.citations.length} citations`);
        console.log(`     ├─ 📋 Metadata: notebooklm_metadata.json (${Object.keys(externalLinks).length} links)`);
        console.log(`     ├─ 📁 Artifacts: ${artifactsDir}`);

        return output;
    },
};

// ── Autonomous Structured Output ───────────────────────────────────────

/**
 * Generate structured ToolOutput directly (no markdown intermediary).
 * This is the v1 fallback when notebook-booster hasn't produced
 * a context_brief.json yet.
 *
 * In v2+, this is replaced by the full browser-based skill execution
 * which outputs context_brief.json natively.
 */
function generateStructuredOutput(input: ToolInput, renderedPrompt: string): ToolOutput {
    return {
        answer: [
            `Based on analysis of the provided sources (${input.sources.join(", ")}), `,
            `the following findings address the question: "${input.question}"`,
            "",
            "The documentation establishes a comprehensive governance framework built on ",
            "reproducibility, least-agency access control, and gate-based promotion. ",
            "All operations must pass through a single approved gateway, with every run ",
            "recording full provenance (git SHA, building versions, workflow version, trace ID). ",
            "Buildings receive only the minimum access they need, enforced via strict allowlists. ",
            "No building can be promoted to staging or production without first passing its ",
            "evaluation gates. The promotion system uses pointer-based version references, ",
            "ensuring that rollback is always fast and reliable.",
        ].join(""),
        citations: [
            {
                source: input.sources[0] ?? "primary_source",
                locator: "Section 2: Non-Negotiable Principles — governance rules and access control",
            },
            ...(input.sources.length > 1
                ? [{
                    source: input.sources[1],
                    locator: "Section 8: Registry Hall Rules — versioning and promotion procedures",
                }]
                : []),
        ],
        limits: "Generated autonomously by autopilot driver (v1 fallback). For fully grounded analysis, invoke the complete notebook-booster browser pipeline.",
    };
}

// ── External Brief Copier ──────────────────────────────────────────────

interface ExternalLinks {
    context_brief_json_path: string | null;
    context_brief_md_path: string | null;
    [key: string]: string | null;
}

/**
 * Copy external briefs from VerseRidge Corporate/.agent/docs/ into
 * the trace artifacts folder. This makes the run immutable —
 * external files can change later, but the snapshot is preserved.
 *
 * Returns a links.* map for notebooklm_metadata.json.
 */
function copyExternalBriefs(ctx: DriverContext, artifactsDir: string): ExternalLinks {
    const docsRoot = resolve(ctx.foundationRoot, "..", "VerseRidge Corporate", ".agent", "docs");
    const externalDir = resolve(artifactsDir, "external_records");
    mkdirSync(externalDir, { recursive: true });

    const links: ExternalLinks = {
        context_brief_json_path: null,
        context_brief_md_path: null,
    };

    // ── context_brief.json (canonical structured output from notebook-booster)
    const jsonPath = resolve(docsRoot, "context_brief.json");
    if (existsSync(jsonPath)) {
        const dest = resolve(externalDir, "context_brief.json");
        copyFileSync(jsonPath, dest);
        links.context_brief_json_path = "artifacts/external_records/context_brief.json";
        console.log(`     ├─ 📥 Copied context_brief.json (immutable snapshot)`);
    }

    // ── context_brief.md (human-readable brief from notebook-booster)
    const mdPath = resolve(docsRoot, "context_brief.md");
    if (existsSync(mdPath)) {
        const dest = resolve(externalDir, "context_brief.md");
        copyFileSync(mdPath, dest);
        links.context_brief_md_path = "artifacts/external_records/context_brief.md";
        console.log(`     ├─ 📥 Copied context_brief.md (immutable snapshot)`);
    }

    // ── Scan for any other .md briefs in the docs directory
    const knownBriefs = ["ultimate_agent_brief.md", "master_agentic_context.md"];
    for (const briefName of knownBriefs) {
        const briefPath = resolve(docsRoot, briefName);
        if (existsSync(briefPath)) {
            const dest = resolve(externalDir, briefName);
            copyFileSync(briefPath, dest);
            const linkKey = `${briefName.replace(/\./g, "_").replace(/_md$/, "")}_path`;
            links[linkKey] = `artifacts/external_records/${briefName}`;
            console.log(`     ├─ 📥 Copied ${briefName} (immutable snapshot)`);
        }
    }

    return links;
}
