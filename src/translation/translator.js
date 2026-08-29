import { mask, unmaskSegments, missingPlaceholders, appendPlaceholders } from "./tokenizer.js";
import { TranslationCache } from "./cache.js";
import { TaskQueue } from "./queue.js";
import { getProvider } from "./providers/index.js";
import {
    FAILURE_BACKOFF_MS,
    FAILURE_RECORD_LIMIT,
    RATE_LIMIT_PAUSE_MS,
    MAX_RATE_LIMIT_PAUSE_MS,
    TRANSIENT_RETRIES,
    TRANSIENT_RETRY_DELAY_MS,
} from "../constants.js";
import { t } from "../i18n.js";
import { logger } from "../lib/logger.js";

const skip = () => ({ status: "skip" });
const done = (text, segments) => ({ status: "done", text, segments });
const error = (message) => ({ status: "error", message });

export class Translator {
    constructor({ settings, onError }) {
        this._settings = settings;
        this._onError = onError || (() => {});
        this._cache = new TranslationCache();
        this._queue = new TaskQueue(() => this._settings.current.maxConcurrent);
        this._inflight = new Map();

        this._starts = new Map();
        this._failures = new Map();
        this._aborters = new Set();
        this._pausedUntil = 0;
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
            } catch {}
        }
        this._aborters.clear();
        this._inflight.clear();
        this._starts.clear();
        this._failures.clear();
        this._cache.save();
    }

    get cacheSize() {
        return this._cache.size;
    }

    clearCache() {
        const cleared = this._cache.size;
        this._cache.clear();
        this._failures.clear();
        return cleared;
    }

    peek(text) {
        const { masked, tokens } = mask(text);
        const key = this._cacheKey(masked, this._settings.current.targetLanguage);
        if (this._cache.has(key)) return this._restore(this._cache.get(key), tokens);
        if (text.length > this._settings.current.maxChars) return skip();
        return { status: "unknown" };
    }

    _cacheKey(masked, language) {
        return `${language}\u0001${masked}`;
    }

    translate(text, hooks = {}) {
        const { masked, tokens } = mask(text);
        const language = hooks.language || this._settings.current.targetLanguage;
        const key = this._cacheKey(masked, language);

        if (this._cache.has(key)) {
            return Promise.resolve(this._restore(this._cache.get(key), tokens));
        }

        if (text.length > this._settings.current.maxChars) return Promise.resolve(skip());

        if (hooks.ignoreBackoff) this._failures.delete(key);
        else if (this._isBackingOff(key)) return Promise.resolve(error(t("error.retryLater")));

        if (hooks.onStart) this._onStart(key, hooks.onStart);

        let job = this._inflight.get(key);
        if (!job) {
            job = this._queue
                .run(async () => {
                    await this._awaitResume();
                    if (this._stopped) throw aborted();
                    if (hooks.shouldRun && !hooks.shouldRun()) throw skipped();
                    this._announceStart(key);
                    return this._callWithRetries(masked, language);
                }, hooks.shouldRun)
                .then(
                    (raw) => this._resolveSuccess(key, masked, raw),
                    (err) => this._resolveFailure(key, err),
                )
                .finally(() => {
                    this._inflight.delete(key);
                    this._starts.delete(key);
                });
            this._inflight.set(key, job);
        }

        return job.then((outcome) =>
            outcome.status === "done" ? this._restore(outcome.masked, tokens) : outcome,
        );
    }

    _onStart(key, listener) {
        const waiting = this._starts.get(key);
        if (waiting === true) return listener();
        if (waiting) waiting.add(listener);
        else this._starts.set(key, new Set([listener]));
    }

    _announceStart(key) {
        const waiting = this._starts.get(key);
        this._starts.set(key, true);
        if (waiting === true || !waiting) return;
        for (const listener of waiting) {
            try {
                listener();
            } catch {}
        }
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

    async _callWithRetries(maskedText, language) {
        for (let attempt = 0; ; attempt += 1) {
            try {
                return await this._callProvider(maskedText, language);
            } catch (err) {
                if (attempt >= TRANSIENT_RETRIES || this._stopped || !isTransient(err)) throw err;
                logger.warn(`transient failure (${err.message}); retry ${attempt + 1}/${TRANSIENT_RETRIES}`);
                await sleep(TRANSIENT_RETRY_DELAY_MS * (attempt + 1));
            }
        }
    }

    _awaitResume() {
        const wait = this._pausedUntil - Date.now();
        return wait > 0 ? sleep(wait) : Promise.resolve();
    }

    _isBackingOff(maskedKey) {
        const failedAt = this._failures.get(maskedKey);
        if (failedAt == null) return false;
        if (Date.now() - failedAt < FAILURE_BACKOFF_MS) return true;
        this._failures.delete(maskedKey);
        return false;
    }

    async _callProvider(maskedText, language) {
        const controller = new AbortController();
        this._aborters.add(controller);
        try {
            const settings = this._settings.current;
            const provider = getProvider(settings.provider);
            return await provider.translate({
                text: maskedText,

                settings:
                    language === settings.targetLanguage
                        ? settings
                        : { ...settings, targetLanguage: language },
                signal: controller.signal,
            });
        } finally {
            this._aborters.delete(controller);
        }
    }

    _resolveSuccess(key, masked, raw) {
        const cleaned = stripWrappingQuotes(raw, masked).trim();
        if (!cleaned || normalize(cleaned) === normalize(masked)) {
            this._cache.set(key, null);
            return skip();
        }
        const maskedTranslation = this._keepPlaceholders(cleaned, masked);
        this._cache.set(key, maskedTranslation);
        return { status: "done", masked: maskedTranslation };
    }

    _keepPlaceholders(translation, masked) {
        const missing = missingPlaceholders(translation, masked);
        if (missing.length === 0) return translation;

        logger.warn(
            `the model dropped ${missing.length} placeholder(s) [${missing.join(", ")}]; ` +
                "appending them so the mentions, links or code they stand for are not lost",
        );
        return appendPlaceholders(translation, missing);
    }

    _resolveFailure(maskedKey, err) {
        const message = (err && err.message) || String(err);

        if (err && err.name === "AbortError") return error(message);

        if (err && err.name === "SkippedError") return { status: "unknown" };

        if (err && err.status === 429) {
            const after = Math.min(err.retryAfterMs || RATE_LIMIT_PAUSE_MS, MAX_RATE_LIMIT_PAUSE_MS);
            this._pausedUntil = Math.max(this._pausedUntil, Date.now() + after);
            logger.warn(`rate limited; retrying in ${Math.round(after / 1000)}s`);
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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(err) {
    if (!err || err.name === "AbortError" || err.name === "SkippedError") return false;
    if (err.name === "ConfigError") return false;
    if (err.status === undefined) return true;
    return err.status === 408 || err.status >= 500;
}

function aborted() {
    const err = new Error("stopped");
    err.name = "AbortError";
    return err;
}

function skipped() {
    const err = new Error("skipped");
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
