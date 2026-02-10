/**
 * drivers/index.ts — Driver interface and registry for AgentCity tool adapters
 *
 * A Driver is a pluggable execution backend for a tool call.
 * The gateway delegates to the selected driver after enforcement.
 */

import { type TraceHandle, type AgentInfo, type RunInfo } from "../traceLogger.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface ToolInput {
    sources: string[];
    question: string;
    driver?: string;
    constraints?: {
        max_words?: number;
        require_citations?: boolean;
    };
}

/** The validated payload shape for NotebookLM outputs. */
export interface ToolOutput {
    answer: string;
    citations: Array<{ source: string; locator: string }>;
    limits?: string;
}

/** Metadata attached by the driver — never validated against the output contract. */
export interface ToolMeta {
    driver: string;
    sop?: string;
    sop_version?: number;
    notebook?: {
        title: string | null;
        id: string | null;
    };
    /** Driver-owned external records (discovered/copied by the driver). */
    external_records?: Record<string, unknown>;
    /** Status flag — set to "failed" if output validation fails. */
    status?: string;
    /** Reason for failure (e.g. "output_schema_failed"). */
    reason?: string;
    [key: string]: unknown;
}

/** A link to an artifact file produced during a run. */
export interface ArtifactLink {
    name: string;
    path: string;
}

/**
 * Generic wrapper returned by every driver.
 *   payload  — validated against the building's output.schema.json
 *   meta     — driver/run metadata, never validated by the output contract
 *   artifacts — paths to files created by the driver
 */
export interface ToolResult<T> {
    payload: T;
    meta?: ToolMeta;
    artifacts?: ArtifactLink[];
}

export interface DriverContext {
    foundationRoot: string;
    environment: string;
    traceId: string;
    traceDate: string;
    runId: string;
    sopPath?: string;
}

export interface Driver {
    name: string;
    execute(input: ToolInput, ctx: DriverContext): Promise<ToolResult<ToolOutput>>;
}

// ── Registry ───────────────────────────────────────────────────────────

const drivers = new Map<string, Driver>();

export function registerDriver(driver: Driver): void {
    drivers.set(driver.name, driver);
}

export function getDriver(name: string): Driver {
    const driver = drivers.get(name);
    if (!driver) {
        const available = Array.from(drivers.keys()).join(", ") || "(none)";
        throw new Error(`[drivers] No driver registered with name "${name}". Available: ${available}`);
    }
    return driver;
}

export function listDrivers(): string[] {
    return Array.from(drivers.keys());
}

// ── Auto-register built-in drivers ─────────────────────────────────────

export async function initDrivers(): Promise<void> {
    const { mockDriver } = await import("./mock.js");
    const { autopilotDriver } = await import("./autopilot.js");
    registerDriver(mockDriver);
    registerDriver(autopilotDriver);
}
