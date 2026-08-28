import {
    NAME,
    LEGACY_NAMES,
    CACHE_LIMIT,
    CACHE_SAVE_DEBOUNCE_MS,
    CACHE_KEY,
    LEGACY_CACHE_KEYS,
} from "../constants.js";

// 키는 마스킹된 원문이고 값도 마스킹된 채로 저장한다. 그래야 캐시가 맞았을 때
// 읽는 쪽이 자기 토큰으로 복원할 수 있다. 값이 null 이면 "번역 불필요" 라는 뜻으로
// 다시 묻지 않는다. 삽입 순서를 트리밍 기준으로 쓴다.
export class TranslationCache {
    constructor() {
        this._map = new Map();
        this._pendingSave = null;
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
                if (!Array.isArray(entry) || entry.length !== 2) continue;
                const [key, value] = entry;
                // null 은 "번역 불필요" 다. 그 밖의 타입은 우리가 쓴 것이 아니다.
                if (typeof key !== "string") continue;
                if (typeof value === "string" || value === null) this._map.set(key, value);
            }
        } catch {
            /* ignore corrupt cache */
        }
    }

    save() {
        if (this._pendingSave != null) {
            clearTimeout(this._pendingSave);
            this._pendingSave = null;
        }
        try {
            const entries = Array.from(this._map);
            const out = [];
            // 최신부터 훑어 오래된 것이 잘려 나가게 한 뒤, 다음 load() 를 위해
            // 삽입 순서로 되돌린다.
            for (let i = entries.length - 1; i >= 0 && out.length < CACHE_LIMIT; i -= 1) {
                const [key, value] = entries[i];
                // null 도 함께 남긴다. 버리면 "이미 대상 언어" 라는 판정을 세션마다
                // 다시 API 에 물어보게 되고, 그 비용이 캐시의 존재 이유를 지운다.
                if (typeof value !== "string" && value !== null) continue;
                if (key.length > 600) continue;
                out.push([key, value]);
            }
            out.reverse();
            BdApi.Data.save(NAME, CACHE_KEY, out);
        } catch {
            /* ignore */
        }
    }

    get size() {
        return this._map.size;
    }

    // 저장까지 함께 끝낸다. 지웠는데 다음 실행에 되살아나면 지운 것이 아니다.
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
        // Node(스모크 테스트)에서 대기 중인 타이머가 프로세스를 붙잡지 않게 한다.
        // 브라우저의 setTimeout 은 숫자를 돌려주므로 이 호출은 그냥 지나간다.
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
