import { NAME, LEGACY_NAMES, CACHE_LIMIT, CACHE_KEY, LEGACY_CACHE_KEYS } from "../constants.js";

// 키는 마스킹된 원문이고 값도 마스킹된 채로 저장한다. 그래야 캐시가 맞았을 때
// 읽는 쪽이 자기 토큰으로 복원할 수 있다. 값이 null 이면 "번역 불필요" 라는 뜻으로
// 다시 묻지 않는다. 삽입 순서를 트리밍 기준으로 쓴다.
export class TranslationCache {
    constructor() {
        this._map = new Map();
    }

    load() {
        // 폐기된 키에 저장된 항목은 그대로 쓰면 안 되는 형식이라 이관하지 않고 버린다.
        for (const store of [NAME, ...LEGACY_NAMES]) {
            for (const key of LEGACY_CACHE_KEYS) {
                try {
                    if (BdApi.Data.load(store, key) != null) BdApi.Data.delete(store, key);
                } catch {
                    /* ignore */
                }
            }
        }

        try {
            const stored = readCache();
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
            // 최신부터 훑어 오래된 것이 잘려 나가게 한 뒤, 다음 load() 를 위해
            // 삽입 순서로 되돌린다.
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

function readCache() {
    for (const store of [NAME, ...LEGACY_NAMES]) {
        const stored = BdApi.Data.load(store, CACHE_KEY);
        if (Array.isArray(stored)) return stored;
    }
    return null;
}
