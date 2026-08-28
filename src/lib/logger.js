import { NAME } from "../constants.js";

// Thin wrapper over BdApi.Logger so call sites don't repeat the plugin name.
// Falls back to console when BdApi.Logger is unavailable (e.g. the smoke test).
function call(level, args) {
    const api = typeof BdApi !== "undefined" && BdApi.Logger;
    if (api && typeof api[level] === "function") {
        api[level](NAME, ...args);
    } else {
        // eslint-disable-next-line no-console
        (console[level] || console.log)(`[${NAME}]`, ...args);
    }
}

export const logger = {
    info: (...args) => call("info", args),
    warn: (...args) => call("warn", args),
    error: (...args) => call("error", args),
};
