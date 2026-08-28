import {
    NAME,
    LEGACY_NAMES,
    CACHE_LIMIT,
    CACHE_SAVE_DEBOUNCE_MS,
    CACHE_KEY,
    LEGACY_CACHE_KEYS,
} from "../constants.js";

export class TranslationCache {
    constructor() {
        this._map = new Map();
        this._pendingSave = null;
    }

    load() {
        for (const store of [NAME, ...LEGACY_NAMES]) {
            for (const key of LEGACY_CACHE_KEYS) {
                try {
                    if (BdApi.Data.load(store, key) != null) BdApi.Data.delete(store, key);
                } catch {}
            }
        }

        try {
            const stored = readCache();
            if (!Array.isArray(stored)) return;
            for (const entry of stored) {
                if (!Array.isArray(entry) || entry.length !== 2) continue;
                const [key, value] = entry;

                if (typeof key !== "string") continue;
                if (typeof value === "string" || value === null) this._map.set(key, value);
            }
        } catch {}
    }

    save() {
        if (this._pendingSave != null) {
            clearTimeout(this._pendingSave);
            this._pendingSave = null;
        }
        try {
            const entries = Array.from(this._map);
            const out = [];

            for (let i = entries.length - 1; i >= 0 && out.length < CACHE_LIMIT; i -= 1) {
                const [key, value] = entries[i];

                if (typeof value !== "string" && value !== null) continue;
                if (key.length > 600) continue;
                out.push([key, value]);
            }
            out.reverse();
            BdApi.Data.save(NAME, CACHE_KEY, out);
        } catch {}
    }

    get size() {
        return this._map.size;
    }

    clear() {
        this._map.clear();
        this.save();
    }

    has(key) {
        return this._map.has(key);
    }

    get(key) {
        return this._map.get(key);
    }

    set(key, value) {
        this._map.set(key, value);
        this._scheduleSave();
        const max = CACHE_LIMIT * 2;
        if (this._map.size <= max) return;
        let drop = this._map.size - max;
        for (const oldKey of this._map.keys()) {
            this._map.delete(oldKey);
            if (--drop <= 0) break;
        }
    }

    _scheduleSave() {
        if (this._pendingSave != null) return;
        this._pendingSave = setTimeout(() => {
            this._pendingSave = null;
            this.save();
        }, CACHE_SAVE_DEBOUNCE_MS);

        this._pendingSave?.unref?.();
    }
}

function readCache() {
    for (const store of [NAME, ...LEGACY_NAMES]) {
        const stored = BdApi.Data.load(store, CACHE_KEY);
        if (Array.isArray(stored)) return stored;
    }
    return null;
}
