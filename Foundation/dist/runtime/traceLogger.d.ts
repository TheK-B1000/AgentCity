/**
 * traceLogger.ts — JSONL event writer for AgentCity
 *
 * Writes events conforming to schemas/run_event.schema.json
 * to data/traces/YYYY-MM-DD/<traceId>.jsonl
 */
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
    errors: Array<{
        code: string;
        message: string;
        details?: unknown;
    }>;
    span_id?: string;
    parent_span_id?: string;
    duration_ms?: number;
    tool?: Record<string, unknown>;
    security?: Record<string, unknown>;
    links?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
}
export interface TraceHandle {
    traceId: string;
    runId: string;
    filePath: string;
    emit: (event: RunEvent) => void;
    close: () => void;
}
/**
 * Create a new trace session.
 * Returns a handle with traceId, runId, emit(), and close().
 */
export declare function createTrace(foundationRoot: string, workflow: string, environment: string): TraceHandle;
/**
 * Build a RunEvent with defaults filled in.
 */
export declare function buildEvent(traceId: string, runInfo: RunInfo, agent: AgentInfo, eventType: RunEvent["event_type"], step: StepInfo, extras?: Partial<Pick<RunEvent, "tool" | "security" | "links" | "metrics" | "duration_ms" | "errors">>): RunEvent;
//# sourceMappingURL=traceLogger.d.ts.map