/**
 * drivers/index.ts — Driver interface and registry for AgentCity tool adapters
 *
 * A Driver is a pluggable execution backend for a tool call.
 * The gateway delegates to the selected driver after enforcement.
 */
// ── Registry ───────────────────────────────────────────────────────────
const drivers = new Map();
export function registerDriver(driver) {
    drivers.set(driver.name, driver);
}
export function getDriver(name) {
    const driver = drivers.get(name);
    if (!driver) {
        const available = Array.from(drivers.keys()).join(", ") || "(none)";
        throw new Error(`[drivers] No driver registered with name "${name}". Available: ${available}`);
    }
    return driver;
}
export function listDrivers() {
    return Array.from(drivers.keys());
}
// ── Auto-register built-in drivers ─────────────────────────────────────
export async function initDrivers() {
    const { mockDriver } = await import("./mock.js");
    const { autopilotDriver } = await import("./autopilot.js");
    registerDriver(mockDriver);
    registerDriver(autopilotDriver);
}
//# sourceMappingURL=index.js.map