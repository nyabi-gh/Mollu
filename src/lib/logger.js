import { NAME } from "../constants.js";

// BdApi.Logger 가 없는 환경(스모크 테스트 등)에서는 console 로 물러난다.
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
