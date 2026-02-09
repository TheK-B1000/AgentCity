/**
 * traceLogger.ts — JSONL event writer for AgentCity
 *
 * Writes events conforming to schemas/run_event.schema.json
 * to data/traces/YYYY-MM-DD/<traceId>.jsonl
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import _Ajv from "ajv";
const Ajv = _Ajv as unknown as typeof _Ajv.default;

// ── Types ──────────────────────────────────────────────────────────────

export interface AgentInfo {
    name: string;
    version: string;
}

export interface RunInfo {
    run_id: string;
    workflow: string;
    environment: string;
}

export interface StepInfo {
    step_index: number;
    step_type: string;
    status: "started" | "succeeded" | "failed" | "skipped";
    inputs_summary: string;
    outputs_summary: string;
    [key: string]: unknown;
}

export interface RunEvent {
    event_version: string;
    trace_id: string;
    timestamp_utc: string;
    event_type: "step_start" | "step_end" | "tool_call" | "error" | "run_start" | "run_end";
    agent: AgentInfo;
    run: RunInfo;
    step: StepInfo;
    errors: Array<{ code: string; message: string; details?: unknown }>;
    span_id?: string;
    parent_span_id?: string;
    duration_ms?: number;
    tool?: Record<string, unknown>;
    security?: Record<string, unknown>;
    links?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
}

// ── Trace Handle ───────────────────────────────────────────────────────

export interface TraceHandle {
    traceId: string;
    runId: string;
    filePath: string;
    emit: (event: RunEvent) => void;
    close: () => void;
}

// ── Schema Validator ───────────────────────────────────────────────────

let _validate: _Ajv.ValidateFunction | null = null;

function getValidator(foundationRoot: string): _Ajv.ValidateFunction {
    if (_validate) return _validate;

    const schemaPath = resolve(foundationRoot, "schemas", "run_event.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

    const ajv = new Ajv({ allErrors: true, strict: false });
    _validate = ajv.compile(schema);
    return _validate;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Create a new trace session.
 * Returns a handle with traceId, runId, emit(), and close().
 */
export function createTrace(
    foundationRoot: string,
    workflow: string,
    environment: string,
): TraceHandle {
    const traceId = randomUUID().replace(/-/g, "").slice(0, 16);
    const runId = randomUUID();

    // Build output path: data/traces/YYYY-MM-DD/<traceId>.jsonl
    const today = new Date().toISOString().slice(0, 10);
    const tracesDir = resolve(foundationRoot, "data", "traces", today);
    mkdirSync(tracesDir, { recursive: true });
    const filePath = join(tracesDir, `${traceId}.jsonl`);

    const validate = getValidator(foundationRoot);

    const emit = (event: RunEvent): void => {
        // Validate against run_event schema
        const valid = validate(event);
        if (!valid) {
            const errMsg = validate.errors
                ?.map((e: { instancePath: string; message?: string }) => `${e.instancePath} ${e.message}`)
                .join("; ");
            throw new Error(`[traceLogger] Event schema violation: ${errMsg}`);
        }

        // Append JSONL
        appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
    };

    const close = (): void => {
        // Future: flush buffers, finalize file. Currently no-op.
    };

    return { traceId, runId, filePath, emit, close };
}

/**
 * Build a RunEvent with defaults filled in.
 */
export function buildEvent(
    traceId: string,
    runInfo: RunInfo,
    agent: AgentInfo,
    eventType: RunEvent["event_type"],
    step: StepInfo,
    extras?: Partial<Pick<RunEvent, "tool" | "security" | "links" | "metrics" | "duration_ms" | "errors">>,
): RunEvent {
    return {
        event_version: "1.0.0",
        trace_id: traceId,
        timestamp_utc: new Date().toISOString(),
        event_type: eventType,
        agent,
        run: runInfo,
        step,
        errors: extras?.errors ?? [],
        span_id: randomUUID().replace(/-/g, "").slice(0, 12),
        ...(extras?.duration_ms != null && { duration_ms: extras.duration_ms }),
        ...(extras?.tool && { tool: extras.tool }),
        ...(extras?.security && { security: extras.security }),
        ...(extras?.links && { links: extras.links }),
        ...(extras?.metrics && { metrics: extras.metrics }),
    };
}
