import { mask, unmaskSegments } from "./tokenizer.js";
import { TranslationCache } from "./cache.js";
import { TaskQueue } from "./queue.js";
import { getProvider } from "./providers/index.js";
import {
    FAILURE_BACKOFF_MS,
    FAILURE_RECORD_LIMIT,
    RATE_LIMIT_PAUSE_MS,
    MAX_RATE_LIMIT_PAUSE_MS,
} from "../constants.js";
import { logger } from "../lib/logger.js";

/** @typedef {import("./tokenizer.js").Segment} Segment */
/** @typedef {{status: "done", text: string, segments: Segment[]} | {status: "skip"} | {status: "error", message: string} | {status: "pending"} | {status: "retry", after: number} | {status: "unknown"}} TranslationResult */

const skip = () => ({ status: "skip" });
const done = (text, segments) => ({ status: "done", text, segments });
const error = (message) => ({ status: "error", message });

// 캐시와 값은 마스킹된 형태로 보관한다. 서로 다른 두 메시지가 같은 마스킹 키
// ("hi 【0】")를 공유할 수 있으므로, placeholder 는 반드시 지금 렌더 중인 메시지의
// 토큰으로만 복원해야 한다. 아니면 캐시가 맞았을 때 다른 메시지의 멘션이나
// 링크가 표시된다.
export class Translator {
    constructor({ settings, onError }) {
        this._settings = settings;
        this._onError = onError || (() => {});
        this._cache = new TranslationCache();
        this._queue = new TaskQueue(() => this._settings.current.maxConcurrent);
        this._inflight = new Map(); // masked key -> Promise<masked outcome>
        this._failures = new Map(); // masked key -> timestamp of last failure
        this._aborters = new Set();
        this._pausedUntil = 0; // set by a 429; blocks every provider call
        this._stopped = false;
    }

    start() {
        this._stopped = false;
        this._pausedUntil = 0;
        this._cache.load();
    }

    stop() {
        this._stopped = true;
        this._queue.clear();
        for (const controller of this._aborters) {
            try {
                controller.abort();
            } catch {
                /* ignore */
            }
        }
        this._aborters.clear();
        this._inflight.clear();
        this._failures.clear();
        this._cache.save();
    }

    peek(text) {
        const { masked, tokens } = mask(text);
        if (this._cache.has(masked)) return this._restore(this._cache.get(masked), tokens);
        if (text.length > this._settings.current.maxChars) return skip();
        return { status: "unknown" };
    }

    // onStart 는 요청이 실제로 큐를 떠날 때 호출된다. 큐에 들어간 시점이 아니라
    // 이때 "번역 중" 을 띄워야 스크롤 중 화면이 밀리지 않는다. shouldRun 은 그
    // 순간 다시 확인해, 이미 화면 밖으로 나간 메시지의 작업을 버린다.
    // 이 함수는 절대 reject 하지 않는다.
    translate(text, hooks = {}) {
        const { masked, tokens } = mask(text);

        if (this._cache.has(masked)) {
            return Promise.resolve(this._restore(this._cache.get(masked), tokens));
        }
        // 캐시하지 않는다. maxChars 에 따라 달라지는 판정이라, 설정을 올리면
        // 다음 렌더에서 통과해야 한다.
        if (text.length > this._settings.current.maxChars) return Promise.resolve(skip());
        if (this._isBackingOff(masked)) {
            return Promise.resolve(error("최근 실패로 재시도를 미루는 중"));
        }

        let job = this._inflight.get(masked);
        if (!job) {
            job = this._queue
                .run(async () => {
                    // 한도 대기를 실패가 아니라 여기서 처리한다. 그래야 메시지가
                    // 오류를 띄우는 대신 자기 자리를 지킨다.
                    await this._awaitResume();
                    if (this._stopped) throw aborted();
                    if (hooks.shouldRun && !hooks.shouldRun()) throw skipped();
                    if (hooks.onStart) hooks.onStart();
                    return this._callProvider(masked);
                }, hooks.shouldRun)
                .then(
                    (raw) => this._resolveSuccess(masked, raw),
                    (err) => this._resolveFailure(masked, err),
                )
                .finally(() => this._inflight.delete(masked));
            this._inflight.set(masked, job);
        }

        return job.then((outcome) =>
            outcome.status === "done" ? this._restore(outcome.masked, tokens) : outcome,
        );
    }

    _restore(maskedValue, tokens) {
        if (typeof maskedValue !== "string") return skip();
        const segments = unmaskSegments(maskedValue, tokens);
        const text = segments
            .map((segment) => segment.value)
            .join("")
            .trim();
        return text ? done(text, trimEdges(segments)) : skip();
    }

    _awaitResume() {
        const wait = this._pausedUntil - Date.now();
        if (wait <= 0) return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, wait));
    }

    _isBackingOff(maskedKey) {
        const failedAt = this._failures.get(maskedKey);
        if (failedAt == null) return false;
        if (Date.now() - failedAt < FAILURE_BACKOFF_MS) return true;
        this._failures.delete(maskedKey);
        return false;
    }

    async _callProvider(maskedText) {
        const controller = new AbortController();
        this._aborters.add(controller);
        try {
            const provider = getProvider(this._settings.current.provider);
            return await provider.translate({
                text: maskedText,
                settings: this._settings.current,
                signal: controller.signal,
            });
        } finally {
            this._aborters.delete(controller);
        }
    }

    _resolveSuccess(maskedKey, raw) {
        const maskedTranslation = stripWrappingQuotes(raw, maskedKey).trim();
        if (!maskedTranslation || normalize(maskedTranslation) === normalize(maskedKey)) {
            this._cache.set(maskedKey, null);
            return skip();
        }
        this._cache.set(maskedKey, maskedTranslation);
        return { status: "done", masked: maskedTranslation };
    }

    _resolveFailure(maskedKey, err) {
        const message = (err && err.message) || String(err);
        // Abort 는 프로바이더가 아니라 stop()/queue.clear() 에서 온다.
        if (err && err.name === "AbortError") return error(message);
        // 차례가 오기 전에 화면 밖으로 나간 경우. 실패가 아니므로 미응답으로
        // 알려 호출자가 다시 요청할 수 있게 한다.
        if (err && err.name === "SkippedError") return { status: "unknown" };

        // 429 는 이 메시지가 아니라 계정에 대한 한도 판정이다. 서버가 요구한
        // 시간만큼 전체를 멈추고 호출자에게 다시 오라고 알린다. 그래야 한꺼번에
        // 몰린 요청이 "번역 실패" 벽으로 바뀌지 않는다.
        if (err && err.status === 429) {
            const after = Math.min(err.retryAfterMs || RATE_LIMIT_PAUSE_MS, MAX_RATE_LIMIT_PAUSE_MS);
            this._pausedUntil = Math.max(this._pausedUntil, Date.now() + after);
            logger.warn(`rate limited: ${Math.round(after / 1000)}초 후 재시도`);
            return { status: "retry", after };
        }

        this._rememberFailure(maskedKey);
        logger.warn("translate failed:", message);
        this._onError(err);
        return error(message);
    }

    _rememberFailure(maskedKey) {
        this._failures.set(maskedKey, Date.now());
        if (this._failures.size <= FAILURE_RECORD_LIMIT) return;
        const cutoff = Date.now() - FAILURE_BACKOFF_MS;
        for (const [key, at] of this._failures) {
            if (at < cutoff) this._failures.delete(key);
        }
    }
}

function aborted() {
    const err = new Error("중지됨");
    err.name = "AbortError";
    return err;
}

function skipped() {
    const err = new Error("건너뜀");
    err.name = "SkippedError";
    return err;
}

function normalize(value) {
    return String(value)
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]/gu, "");
}

const QUOTE_PAIRS = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["「", "」"],
    ["『", "』"],
];

// 모델은 번역문을 따옴표로 감싸는 버릇이 있다. 문자열 전체를 실제로 감쌀 때만
// 벗긴다. `"가" 하고 "나"` 는 단지 따옴표로 시작하고 끝날 뿐이고, 원문 자체가
// 따옴표로 감싸여 있었다면 작성자의 따옴표이므로 보존한다.
function stripWrappingQuotes(value, source) {
    const text = String(value).trim();
    if (text.length < 2) return text;

    for (const [open, close] of QUOTE_PAIRS) {
        if (text[0] !== open || text[text.length - 1] !== close) continue;

        const inner = text.slice(1, -1);
        if (inner.includes(open) || inner.includes(close)) continue;

        const from = String(source ?? "").trim();
        if (from.length >= 2 && from[0] === open && from[from.length - 1] === close) continue;

        return inner.trim();
    }
    return text;
}

function trimEdges(segments) {
    const out = segments.slice();
    while (out.length && out[0].type === "text" && !out[0].value.trim()) out.shift();
    while (out.length && out[out.length - 1].type === "text" && !out[out.length - 1].value.trim()) out.pop();
    if (out.length && out[0].type === "text")
        out[0] = { type: "text", value: out[0].value.replace(/^\s+/, "") };
    const last = out.length - 1;
    if (last >= 0 && out[last].type === "text") {
        out[last] = { type: "text", value: out[last].value.replace(/\s+$/, "") };
    }
    return out;
}
