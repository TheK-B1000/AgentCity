/**
 * drivers/index.ts — Driver interface and registry for AgentCity tool adapters
 *
 * A Driver is a pluggable execution backend for a tool call.
 * The gateway delegates to the selected driver after enforcement.
 */
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
    citations: Array<{
        source: string;
        locator: string;
    }>;
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
export declare function registerDriver(driver: Driver): void;
export declare function getDriver(name: string): Driver;
export declare function listDrivers(): string[];
export declare function initDrivers(): Promise<void>;
//# sourceMappingURL=index.d.ts.map