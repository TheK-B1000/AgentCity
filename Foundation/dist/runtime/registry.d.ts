/**
 * registry.ts — Building version registry for AgentCity
 *
 * Operates on data/registry/registry.json.
 * Four functions: register, promote, resolve, rollback.
 */
export interface VersionEntry {
    permit_path: string;
    sop_version: string;
    created_utc: string;
    git_sha: string;
    eval_passed?: boolean;
}
export interface BuildingRecord {
    versions: Record<string, VersionEntry>;
    stages: {
        dev: string | null;
        staging: string | null;
        prod: string | null;
    };
}
export interface RegistryData {
    buildings: Record<string, BuildingRecord>;
}
export type Stage = "dev" | "staging" | "prod";
/**
 * Register a new building version.
 * Errors if the version already exists.
 */
export declare function register(foundationRoot: string, building: string, version: string, meta: {
    permit_path: string;
    sop_version: string;
    git_sha: string;
}): void;
/**
 * Promote a building version to a stage.
 * staging/prod require eval_passed unless force=true.
 */
export declare function promote(foundationRoot: string, building: string, version: string, stage: Stage, options?: {
    force?: boolean;
}): void;
/**
 * Resolve the current version for a building at a given stage.
 * Returns the version entry + version string, or throws if no pointer.
 */
export declare function resolveVersion(foundationRoot: string, building: string, stage?: Stage): {
    version: string;
    entry: VersionEntry;
};
/**
 * Rollback a stage pointer to the previous version.
 * Records the rollback by returning the old and new pointers.
 */
export declare function rollback(foundationRoot: string, building: string, stage: Stage): {
    rolledBackFrom: string;
    rolledBackTo: string | null;
};
//# sourceMappingURL=registry.d.ts.map