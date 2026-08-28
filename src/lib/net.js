import { REQUEST_TIMEOUT_MS } from "../constants.js";
import { logger } from "./logger.js";

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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Validate a user-entered API base URL before an API key is sent to it.
 * Plain http is refused except for a local proxy, because the key travels in an
 * Authorization header.
 *
 * @returns {string} origin + path, without a trailing slash
 */
export function normalizeBaseUrl(raw, fallback = "") {
    const input = String(raw ?? "").trim() || String(fallback);
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;

    let url;
    try {
        url = new URL(withScheme);
    } catch {
        throw new Error(`API Base URL이 올바르지 않습니다: ${input}`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`지원하지 않는 프로토콜입니다: ${url.protocol}`);
    }
    if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
        throw new Error("http:// 주소로는 API 키가 평문으로 전송됩니다. https:// 를 사용하세요.");
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/**
 * How long a rejected request asked us to wait, in ms; 0 when it did not say.
 * Reads the standard Retry-After header, then google.rpc.RetryInfo, which is
 * what the Gemini API returns inside a 429 payload.
 */
function retryAfterMs(res, body) {
    const header = res.headers?.get?.("retry-after");
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
        const at = Date.parse(header);
        if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
    }

    const retryDelay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body || "");
    return retryDelay ? Math.round(Number(retryDelay[1]) * 1000) : 0;
}

function withDeadline(signal, timeout) {
    if (!(timeout > 0) || typeof AbortSignal?.timeout !== "function") return signal;
    const deadline = AbortSignal.timeout(timeout);
    if (!signal) return deadline;
    return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, deadline]) : signal;
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
        // The `timeout` option is BdApi.Net.fetch's; standard fetch ignores it,
        // so the fallback path gets the same deadline through its signal.
        signal: hasNativeFetch() ? signal : withDeadline(signal, timeout),
        timeout,
    });

    const text = await res.text().catch(() => "");
    const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
    if (!ok) {
        // The body can echo request material, so it goes to the log only — the
        // Error message is what ends up in a user-visible toast.
        if (text) logger.warn(`HTTP ${res.status} body:`, text.slice(0, 500));
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.retryAfterMs = retryAfterMs(res, text);
        throw err;
    }

    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new Error("invalid JSON in response");
    }
}
