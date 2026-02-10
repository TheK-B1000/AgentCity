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
const Ajv = _Ajv;
// ── Schema Validator ───────────────────────────────────────────────────
let _validate = null;
function getValidator(foundationRoot) {
    if (_validate)
        return _validate;
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
export function createTrace(foundationRoot, workflow, environment) {
    const traceId = randomUUID().replace(/-/g, "").slice(0, 16);
    const runId = randomUUID();
    // Build output path: data/traces/YYYY-MM-DD/<traceId>.jsonl
    const today = new Date().toISOString().slice(0, 10);
    const tracesDir = resolve(foundationRoot, "data", "traces", today);
    mkdirSync(tracesDir, { recursive: true });
    const filePath = join(tracesDir, `${traceId}.jsonl`);
    const validate = getValidator(foundationRoot);
    const emit = (event) => {
        // Validate against run_event schema
        const valid = validate(event);
        if (!valid) {
            const errMsg = validate.errors
                ?.map((e) => `${e.instancePath} ${e.message}`)
                .join("; ");
            throw new Error(`[traceLogger] Event schema violation: ${errMsg}`);
        }
        // Append JSONL
        appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
    };
    const close = () => {
        // Future: flush buffers, finalize file. Currently no-op.
    };
    return { traceId, runId, filePath, emit, close };
}
/**
 * Build a RunEvent with defaults filled in.
 */
export function buildEvent(traceId, runInfo, agent, eventType, step, extras) {
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
//# sourceMappingURL=traceLogger.js.map