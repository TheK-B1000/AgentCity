export interface CityConfig {
    city: {
        name: string;
        version: string;
    };
    environment: string;
    defaults: {
        budgets: {
            max_steps: number;
            max_tool_calls: number;
            timeout_seconds: number;
        };
    };
    observability: {
        traces_dir: string;
        format: string;
        event_schema: string;
    };
    registry: {
        path: string;
    };
    governance: {
        policy_mode: string;
        least_agency: boolean;
    };
}
export interface RunOptions {
    driver?: string;
    question?: string;
    sources?: string[];
}
export interface RunResult {
    success: boolean;
    traceFile: string;
    traceId: string;
    runId: string;
    output: unknown;
    stepsExecuted: number;
    errors: Array<{
        code: string;
        message: string;
    }>;
}
/**
 * Run a workflow from a YAML file.
 */
export declare function runWorkflow(foundationRoot: string, workflowPath: string, cityConfig: CityConfig, options?: RunOptions): Promise<RunResult>;
//# sourceMappingURL=workflowRunner.d.ts.map