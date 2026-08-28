import { NAME } from "../constants.js";

function call(level, args) {
    const api = typeof BdApi !== "undefined" && BdApi.Logger;
    if (api && typeof api[level] === "function") {
        api[level](NAME, ...args);
    } else {
        (console[level] || console.log)(`[${NAME}]`, ...args);
    }
}

export const logger = {
    info: (...args) => call("info", args),
    warn: (...args) => call("warn", args),
    error: (...args) => call("error", args),
};
