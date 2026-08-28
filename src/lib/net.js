import { REQUEST_TIMEOUT_MS } from "../constants.js";

// BdApi.Net.fetch runs over Node's http(s) in the main process, so it is not
// subject to Discord's renderer CSP and can reach arbitrary API hosts. It
// returns a standard Response. Plain `fetch` is only a fallback for very old
// BetterDiscord builds and will usually be blocked by CSP.
function resolveFetch() {
    if (typeof BdApi !== "undefined" && BdApi.Net && typeof BdApi.Net.fetch === "function") {
        return BdApi.Net.fetch.bind(BdApi.Net);
    }
    return typeof fetch === "function" ? fetch : null;
}

export function hasNativeFetch() {
    return typeof BdApi !== "undefined" && BdApi.Net && typeof BdApi.Net.fetch === "function";
}

/**
 * POST a JSON body and parse a JSON response.
 * Throws an Error (with `.status` when available) on a non-2xx response.
 */
export async function postJson(url, { headers = {}, body, signal, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const doFetch = resolveFetch();
    if (!doFetch) throw new Error("no fetch implementation available");

    const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
        signal,
        timeout,
    });

    const text = await res.text().catch(() => "");
    const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
    if (!ok) {
        const err = new Error(`HTTP ${res.status}${text ? ` · ${text.slice(0, 200)}` : ""}`);
        err.status = res.status;
        throw err;
    }

    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new Error("invalid JSON in response");
    }
}
