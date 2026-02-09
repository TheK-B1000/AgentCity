/**
 * drivers/mock.ts — Deterministic mock driver for testing and evals
 *
 * Returns a fixed, schema-compliant response. No side effects.
 * Used for: unit tests, eval baselines, --driver mock runs.
 */

import type { Driver, ToolInput, ToolOutput, DriverContext } from "./index.js";

export const mockDriver: Driver = {
    name: "mock",

    async execute(input: ToolInput, _ctx: DriverContext): Promise<ToolOutput> {
        return {
            answer: [
                `Based on the provided sources, here is a synthesized answer to: "${input.question}".`,
                "",
                "The AgentCity governance model is built on five core principles:",
                "1. One Front Door — all operations through official entrypoints.",
                "2. Reproducibility by Default — every run records git SHA, versions, and trace_id.",
                "3. Principle of Least Agency — deny by default, allow by explicit allowlist.",
                "4. Gates Before Promotion — eval gates required before staging/prod.",
                "5. Rollback Must Always Work — pointer-based promotion for fast rollback.",
            ].join("\n"),
            citations: [
                {
                    source: input.sources[0] ?? "unknown_source.pdf",
                    locator: "Section 2: Non-Negotiable Principles",
                },
                {
                    source: input.sources[1] ?? input.sources[0] ?? "unknown_source.pdf",
                    locator: "Section 8: Registry Hall Rules",
                },
            ],
            limits: "This is a deterministic mock response — no actual source analysis was performed.",
            _driverMeta: {
                driver: "mock",
                notebook: { title: "mock_notebook", id: null },
            },
        };
    },
};
