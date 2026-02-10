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
export declare function run(foundationRoot: string, driver: string): Promise<number>;
//# sourceMappingURL=notebooklm_golden.d.ts.map