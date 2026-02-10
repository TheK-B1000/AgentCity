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
import type { Driver } from "./index.js";
export declare const autopilotDriver: Driver;
//# sourceMappingURL=autopilot.d.ts.map