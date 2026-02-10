import { type ToolInput, type ToolResult } from "./drivers/index.js";
import { type TraceHandle, type AgentInfo, type RunInfo } from "./traceLogger.js";
export interface GatewayContext {
    foundationRoot: string;
    environment: string;
    trace: TraceHandle;
    agent: AgentInfo;
    runInfo: RunInfo;
    stepIndex: number;
    budgets: {
        max_tool_calls: number;
        timeout_seconds: number;
    };
    traceDate: string;
    sopPath?: string;
}
export declare function resetBudgets(): void;
/**
 * callTool — The single approved route for building execution.
 * Enforces contracts, budgets, and policies.
 */
export declare function callTool(toolName: string, input: ToolInput, ctx: GatewayContext): Promise<ToolResult<unknown>>;
//# sourceMappingURL=toolGateway.d.ts.map