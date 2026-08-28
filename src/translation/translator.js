import { mask, unmask } from "./tokenizer.js";
import { TranslationCache } from "./cache.js";
import { TaskQueue } from "./queue.js";
import { getProvider } from "./providers/index.js";
import { logger } from "../lib/logger.js";

/** @typedef {{status: "done", text: string} | {status: "skip"} | {status: "error", message: string} | {status: "pending"} | {status: "unknown"}} TranslationResult */

const skip = () => ({ status: "skip" });
const done = (text) => ({ status: "done", text });
const error = (message) => ({ status: "error", message });

/**
 * Owns the cache, the concurrency-limited queue and provider dispatch.
 * Callers use `peek()` for a synchronous cache read and `translate()` for the
 * async path (deduplicated per masked source text).
 */
export class Translator {
    constructor({ settings, onError }) {
        this._settings = settings;
        this._onError = onError || (() => {});
        this._cache = new TranslationCache();
        this._queue = new TaskQueue(() => this._settings.current.maxConcurrent);
        this._inflight = new Map(); // masked key -> Promise<TranslationResult>
        this._aborters = new Set();
    }

    start() {
        this._cache.load();
    }

    stop() {
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
        this._cache.save();
    }

    /**
     * Synchronous cache lookup for the first render.
     * @returns {TranslationResult}
     */
    peek(text) {
        const { masked } = mask(text);
        if (!this._cache.has(masked)) return { status: "unknown" };
        const value = this._cache.get(masked);
        return value == null ? skip() : done(value);
    }

    /**
     * @returns {Promise<TranslationResult>} never rejects.
     */
    translate(text) {
        const { masked, tokens } = mask(text);

        if (this._cache.has(masked)) {
            const value = this._cache.get(masked);
            return Promise.resolve(value == null ? skip() : done(value));
        }
        if (text.length > this._settings.current.maxChars) {
            this._cache.set(masked, null);
            return Promise.resolve(skip());
        }
        if (this._inflight.has(masked)) return this._inflight.get(masked);

        const job = this._queue
            .run(() => this._callProvider(masked))
            .then(
                (raw) => this._resolveSuccess(masked, tokens, text, raw),
                (err) => this._resolveFailure(err),
            )
            .finally(() => this._inflight.delete(masked));

        this._inflight.set(masked, job);
        return job;
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

    _resolveSuccess(maskedKey, tokens, original, raw) {
        const text = unmask(stripWrappingQuotes(raw), tokens).trim();
        if (!text || normalize(text) === normalize(original)) {
            this._cache.set(maskedKey, null);
            return skip();
        }
        this._cache.set(maskedKey, text);
        return done(text);
    }

    _resolveFailure(err) {
        const message = (err && err.message) || String(err);
        logger.warn("translate failed:", message);
        this._onError(err);
        return error(message);
    }
}

function normalize(value) {
    return String(value).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function stripWrappingQuotes(value) {
    let text = String(value).trim();
    const pairs = [
        ['"', '"'],
        ["'", "'"],
        ["“", "”"],
        ["「", "」"],
        ["『", "』"],
    ];
    for (const [open, close] of pairs) {
        if (text.length >= 2 && text[0] === open && text[text.length - 1] === close) {
            return text.slice(1, -1).trim();
        }
    }
    return text;
}
