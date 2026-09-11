import { REQUEST_TIMEOUT_MS } from "../constants.js";
import { logger } from "./logger.js";
import { t } from "../i18n.js";

function resolveFetch() {
    if (typeof BdApi !== "undefined" && BdApi.Net && typeof BdApi.Net.fetch === "function") {
        return BdApi.Net.fetch.bind(BdApi.Net);
    }
    return typeof fetch === "function" ? fetch : null;
}

export function hasNativeFetch() {
    return typeof BdApi !== "undefined" && BdApi.Net && typeof BdApi.Net.fetch === "function";
}

export function configError(message) {
    const err = new Error(message);
    err.name = "ConfigError";
    return err;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function normalizeBaseUrl(raw, fallback = "") {
    const input = String(raw ?? "").trim() || String(fallback);
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;

    let url;
    try {
        url = new URL(withScheme);
    } catch {
        throw configError(t("error.badBaseUrl", { url: input }));
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw configError(t("error.badProtocol", { protocol: url.protocol }));
    }
    if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
        throw configError(t("error.insecureUrl"));
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

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

export async function getText(url, { signal, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const doFetch = resolveFetch();
    if (!doFetch) throw new Error("no fetch implementation available");

    const res = await doFetch(url, {
        method: "GET",
        signal: hasNativeFetch() ? signal : withDeadline(signal, timeout),
        timeout,
    });
    const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
    if (!ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.text();
}

export async function postJson(url, { headers = {}, body, signal, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const doFetch = resolveFetch();
    if (!doFetch) throw new Error("no fetch implementation available");

    const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),

        signal: hasNativeFetch() ? signal : withDeadline(signal, timeout),
        timeout,
    });

    const text = await res.text().catch(() => "");
    const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
    if (!ok) {
        if (text) logger.warn(`HTTP ${res.status} body:`, text.slice(0, 500));
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.body = text;
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
