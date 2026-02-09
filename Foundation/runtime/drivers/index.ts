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
    constraints?: {
        max_words?: number;
        require_citations?: boolean;
    };
}

export interface ToolOutput {
    answer: string;
    citations: Array<{ source: string; locator: string }>;
    limits?: string;
    /** In-memory only — drivers attach metadata here; handleReport writes the canonical file */
    _driverMeta?: DriverMeta;
}

export interface DriverMeta {
    driver: string;
    sop?: string;
    sop_version?: number;
    notebook?: {
        title: string;
        id: string | null;
    };
    [key: string]: unknown;
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
    execute(input: ToolInput, ctx: DriverContext): Promise<ToolOutput>;
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
