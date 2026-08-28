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

/**
 * Owns the cache, the concurrency-limited queue and provider dispatch.
 * Callers use `peek()` for a synchronous cache read and `translate()` for the
 * async path (deduplicated per masked source text).
 *
 * Cached and in-flight values are kept in **masked** form. Two different
 * messages can share one masked key ("hi 【0】"), so the placeholders must only
 * be resolved against the tokens of the message being rendered — otherwise a
 * cache hit shows another message's mention or link.
 */
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

    /**
     * Synchronous cache lookup for the first render.
     * @returns {TranslationResult}
     */
    peek(text) {
        const { masked, tokens } = mask(text);
        if (this._cache.has(masked)) return this._restore(this._cache.get(masked), tokens);
        if (text.length > this._settings.current.maxChars) return skip();
        return { status: "unknown" };
    }

    /**
     * @param {string} text
     * @param {{onStart?: () => void, shouldRun?: () => boolean}} [hooks]
     *   `onStart` fires when the request actually leaves the queue, so the UI
     *   can show "번역 중" for in-flight work only. `shouldRun` is re-checked at
     *   that moment and drops work whose message has scrolled away.
     * @returns {Promise<TranslationResult>} never rejects.
     */
    translate(text, hooks = {}) {
        const { masked, tokens } = mask(text);

        if (this._cache.has(masked)) {
            return Promise.resolve(this._restore(this._cache.get(masked), tokens));
        }
        // Not cached: the verdict depends on `maxChars`, so raising the setting
        // must let the message through on the next render.
        if (text.length > this._settings.current.maxChars) return Promise.resolve(skip());
        if (this._isBackingOff(masked)) {
            return Promise.resolve(error("최근 실패로 재시도를 미루는 중"));
        }

        let job = this._inflight.get(masked);
        if (!job) {
            job = this._queue
                .run(async () => {
                    // A rate-limit pause is served here rather than by failing:
                    // the message keeps its place instead of showing an error.
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

    /** Turn a masked cache/job value into a result for one specific message. */
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

    /** @returns {{status: "done", masked: string} | {status: "skip"}} */
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
        // Aborts come from stop()/queue.clear(), not from the provider.
        if (err && err.name === "AbortError") return error(message);
        // The message scrolled out of view before its turn came up. Not a
        // failure: report it as un-answered so the caller can ask again.
        if (err && err.name === "SkippedError") return { status: "unknown" };

        // 429 is a quota verdict on the account, not on this message. Pause
        // everything for the window the server asked for and tell the caller to
        // come back, so a burst does not turn into a wall of "번역 실패".
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

/**
 * Models like to wrap a translation in quotes. Strip them only when they really
 * do wrap the whole string: `"A" 하고 "B"` merely starts and ends with a quote,
 * and a source that was quoted itself keeps the author's quotes.
 */
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

/** Drop leading/trailing whitespace from the outer text segments. */
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
