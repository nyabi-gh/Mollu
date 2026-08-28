import { REQUEST_TIMEOUT_MS } from "../constants.js";
import { logger } from "./logger.js";
import { t } from "../i18n.js";

// BdApi.Net.fetch 는 메인 프로세스의 Node http(s) 로 나가므로 렌더러 CSP 를 받지
// 않고 임의의 API 호스트에 닿는다. 표준 fetch 는 아주 오래된 BD 빌드용 폴백이며
// 대개 CSP 에 막힌다.
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

// 키를 보내기 전에 사용자가 입력한 base URL 을 검증한다. 키가 Authorization
// 헤더로 나가므로 로컬 프록시를 제외한 평문 http 는 거부한다.
export function normalizeBaseUrl(raw, fallback = "") {
    const input = String(raw ?? "").trim() || String(fallback);
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;

    let url;
    try {
        url = new URL(withScheme);
    } catch {
        throw new Error(t("error.badBaseUrl", { url: input }));
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(t("error.badProtocol", { protocol: url.protocol }));
    }
    if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
        throw new Error(t("error.insecureUrl"));
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

// 서버가 요구한 대기 시간(ms). 알려 주지 않으면 0. 표준 Retry-After 헤더를 먼저
// 보고, 없으면 Gemini 가 429 본문에 넣는 google.rpc.RetryInfo 를 읽는다.
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

export async function postJson(url, { headers = {}, body, signal, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const doFetch = resolveFetch();
    if (!doFetch) throw new Error("no fetch implementation available");

    const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
        // timeout 은 BdApi.Net.fetch 전용 옵션이라 표준 fetch 는 무시한다.
        // 폴백 경로에는 signal 로 같은 마감을 건다.
        signal: hasNativeFetch() ? signal : withDeadline(signal, timeout),
        timeout,
    });

    const text = await res.text().catch(() => "");
    const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
    if (!ok) {
        // 응답 본문은 요청 내용을 되비출 수 있어 로그로만 보낸다. Error 메시지는
        // 사용자에게 토스트로 노출된다.
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
