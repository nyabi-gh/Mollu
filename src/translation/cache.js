import { NAME, CACHE_LIMIT, CACHE_KEY, LEGACY_CACHE_KEYS } from "../constants.js";

/**
 * Keyed by masked source text; values are stored **masked** as well, so a hit
 * restores the reader's own tokens. A `string` value is the Korean translation;
 * `null` means "already Korean / not worth showing" so we don't ask again.
 * Insertion order gives a rough LRU for trimming.
 */
export class TranslationCache {
    constructor() {
        this._map = new Map();
    }

    load() {
        try {
            for (const legacy of LEGACY_CACHE_KEYS) {
                if (BdApi.Data.load(NAME, legacy) != null) BdApi.Data.delete(NAME, legacy);
            }
        } catch {
            /* ignore */
        }
        try {
            const stored = BdApi.Data.load(NAME, CACHE_KEY);
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
            const entries = Array.from(this._map);
            const out = [];
            // Walk newest-first so trimming drops the oldest entries, then put
            // the survivors back in insertion order for the next load().
            for (let i = entries.length - 1; i >= 0 && out.length < CACHE_LIMIT; i -= 1) {
                const [key, value] = entries[i];
                if (typeof value !== "string") continue;
                if (key.length > 600) continue;
                out.push([key, value]);
            }
            out.reverse();
            BdApi.Data.save(NAME, CACHE_KEY, out);
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
