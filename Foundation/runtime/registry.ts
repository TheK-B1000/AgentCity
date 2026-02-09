/**
 * registry.ts — Building version registry for AgentCity
 *
 * Operates on data/registry/registry.json.
 * Four functions: register, promote, resolve, rollback.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────

function registryPath(foundationRoot: string): string {
    return resolve(foundationRoot, "data", "registry", "registry.json");
}

function loadRegistry(foundationRoot: string): RegistryData {
    const raw = readFileSync(registryPath(foundationRoot), "utf-8");
    return JSON.parse(raw) as RegistryData;
}

function saveRegistry(foundationRoot: string, data: RegistryData): void {
    writeFileSync(registryPath(foundationRoot), JSON.stringify(data, null, 4) + "\n", "utf-8");
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Register a new building version.
 * Errors if the version already exists.
 */
export function register(
    foundationRoot: string,
    building: string,
    version: string,
    meta: {
        permit_path: string;
        sop_version: string;
        git_sha: string;
    },
): void {
    const data = loadRegistry(foundationRoot);

    // Ensure building record exists
    if (!data.buildings[building]) {
        data.buildings[building] = {
            versions: {},
            stages: { dev: null, staging: null, prod: null },
        };
    }

    const bld = data.buildings[building];
    if (bld.versions[version]) {
        throw new Error(`[registry] Building "${building}" version "${version}" is already registered.`);
    }

    bld.versions[version] = {
        permit_path: meta.permit_path,
        sop_version: meta.sop_version,
        created_utc: new Date().toISOString(),
        git_sha: meta.git_sha,
    };

    saveRegistry(foundationRoot, data);
    console.log(`[registry] Registered ${building}@${version}`);
}

/**
 * Promote a building version to a stage.
 * staging/prod require eval_passed unless force=true.
 */
export function promote(
    foundationRoot: string,
    building: string,
    version: string,
    stage: Stage,
    options?: { force?: boolean },
): void {
    const data = loadRegistry(foundationRoot);
    const bld = data.buildings[building];

    if (!bld) {
        throw new Error(`[registry] Building "${building}" is not registered.`);
    }
    if (!bld.versions[version]) {
        throw new Error(`[registry] Version "${version}" not found for building "${building}".`);
    }

    // Gate: staging/prod require eval pass
    if ((stage === "staging" || stage === "prod") && !options?.force) {
        const entry = bld.versions[version];
        if (!entry.eval_passed) {
            throw new Error(
                `[registry] Cannot promote ${building}@${version} to ${stage}: eval not passed. Use force to override.`,
            );
        }
    }

    bld.stages[stage] = version;
    saveRegistry(foundationRoot, data);
    console.log(`[registry] Promoted ${building}@${version} → ${stage}`);
}

/**
 * Resolve the current version for a building at a given stage.
 * Returns the version entry + version string, or throws if no pointer.
 */
export function resolveVersion(
    foundationRoot: string,
    building: string,
    stage?: Stage,
): { version: string; entry: VersionEntry } {
    const data = loadRegistry(foundationRoot);
    const bld = data.buildings[building];

    if (!bld) {
        throw new Error(`[registry] Building "${building}" is not registered.`);
    }

    // Default stage: read from city.yaml environment field
    const effectiveStage = stage ?? getDefaultStage(foundationRoot);

    const version = bld.stages[effectiveStage];
    if (!version) {
        throw new Error(`[registry] No version promoted to "${effectiveStage}" for building "${building}".`);
    }

    const entry = bld.versions[version];
    if (!entry) {
        throw new Error(`[registry] Version pointer "${version}" does not exist in versions map.`);
    }

    return { version, entry };
}

/**
 * Rollback a stage pointer to the previous version.
 * Records the rollback by returning the old and new pointers.
 */
export function rollback(
    foundationRoot: string,
    building: string,
    stage: Stage,
): { rolledBackFrom: string; rolledBackTo: string | null } {
    const data = loadRegistry(foundationRoot);
    const bld = data.buildings[building];

    if (!bld) {
        throw new Error(`[registry] Building "${building}" is not registered.`);
    }

    const currentVersion = bld.stages[stage];
    if (!currentVersion) {
        throw new Error(`[registry] No version at stage "${stage}" for building "${building}" — nothing to roll back.`);
    }

    // Find the previous version by creation date
    const sortedVersions = Object.entries(bld.versions)
        .sort(([, a], [, b]) => new Date(a.created_utc).getTime() - new Date(b.created_utc).getTime());

    const currentIdx = sortedVersions.findIndex(([v]) => v === currentVersion);
    const previousVersion = currentIdx > 0 ? sortedVersions[currentIdx - 1][0] : null;

    bld.stages[stage] = previousVersion;
    saveRegistry(foundationRoot, data);

    console.log(`[registry] Rolled back ${building}@${stage}: ${currentVersion} → ${previousVersion ?? "(none)"}`);
    return { rolledBackFrom: currentVersion, rolledBackTo: previousVersion };
}

// ── Internal Helpers ───────────────────────────────────────────────────

function getDefaultStage(foundationRoot: string): Stage {
    const cityPath = resolve(foundationRoot, "city", "city.yaml");
    const raw = readFileSync(cityPath, "utf-8");
    const match = raw.match(/^environment:\s*(\w+)/m);
    return (match?.[1] as Stage) ?? "dev";
}
