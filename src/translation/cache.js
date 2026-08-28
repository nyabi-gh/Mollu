import { NAME, CACHE_LIMIT } from "../constants.js";

/**
 * Keyed by masked source text. A `string` value is the Korean translation;
 * `null` means "already Korean / not worth showing" so we don't ask again.
 * Insertion order gives a rough LRU for trimming.
 */
export class TranslationCache {
    constructor() {
        this._map = new Map();
    }

    load() {
        try {
            const stored = BdApi.Data.load(NAME, "cache");
            if (!Array.isArray(stored)) return;
            for (const entry of stored) {
                if (Array.isArray(entry) && entry.length === 2) this._map.set(entry[0], entry[1]);
            }
        } catch {
            /* ignore corrupt cache */
        }
    }

    save() {
        try {
            const out = [];
            for (const [key, value] of this._map) {
                if (typeof value !== "string") continue;
                if (key.length > 600) continue;
                out.push([key, value]);
                if (out.length >= CACHE_LIMIT) break;
            }
            BdApi.Data.save(NAME, "cache", out);
        } catch {
            /* ignore */
        }
    }

    has(key) {
        return this._map.has(key);
    }

    get(key) {
        return this._map.get(key);
    }

    set(key, value) {
        this._map.set(key, value);
        const max = CACHE_LIMIT * 2;
        if (this._map.size <= max) return;
        let drop = this._map.size - max;
        for (const oldKey of this._map.keys()) {
            this._map.delete(oldKey);
            if (--drop <= 0) break;
        }
    }
}
