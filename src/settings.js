import { NAME, LEGACY_NAMES, DEFAULT_SETTINGS } from "./constants.js";
import { getProvider, PROVIDER_OPTIONS } from "./translation/providers/index.js";
import { logger } from "./lib/logger.js";

/**
 * Loads/persists plugin settings and builds the BetterDiscord settings panel.
 * `current` is the live values object; `guildIdSet` is the parsed allow-list.
 * Consumers can `onChange` to react to edits without rebuilding.
 */
export class Settings {
    constructor() {
        const stored = safeLoad();
        this._values = normalize({ ...DEFAULT_SETTINGS, ...stored });
        this._guildIdSet = parseGuildIds(this._values.guildIds);
        this._listeners = new Set();
        // Settings carried over from a previous name only live under the old
        // store until something writes them back.
        if (!BdApi.Data.load(NAME, "settings")) this._persist();
    }

    get current() {
        return this._values;
    }

    get guildIdSet() {
        return this._guildIdSet;
    }

    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _set(id, value) {
        const next = coerce(id, value, this._values[id]);
        // KEEP is an edit that must not apply; an unchanged value means the
        // same edit arrived twice (see buildPanel) and needs no second write.
        if (next === KEEP || next === this._values[id]) return;

        if (id === "provider") {
            this._stashProfile();
            this._values.provider = next;
            this._restoreProfile(next);
        } else {
            this._values[id] = next;
            if (CREDENTIAL_FIELDS.has(id)) this._stashProfile();
        }
        if (id === "guildIds") this._guildIdSet = parseGuildIds(next);
        this._persist();
        for (const listener of this._listeners) {
            try {
                listener(id, next);
            } catch {
                /* a listener error must not block persistence */
            }
        }
    }

    /** Remember the active provider's credentials before leaving it. */
    _stashProfile() {
        const { provider, apiKey, model, baseUrl } = this._values;
        this._values.profiles = { ...this._values.profiles, [provider]: { apiKey, model, baseUrl } };
    }

    _restoreProfile(providerId) {
        const { defaults } = getProvider(providerId);
        const saved = this._values.profiles?.[providerId] ?? {};
        this._values.apiKey = saved.apiKey || "";
        this._values.model = saved.model || defaults.model;
        this._values.baseUrl = saved.baseUrl || defaults.baseUrl;
    }

    _persist() {
        try {
            BdApi.Data.save(NAME, "settings", { ...this._values });
        } catch (e) {
            logger.error("설정 저장 실패", e);
        }
    }

    buildPanel() {
        const v = this._values;
        return BdApi.UI.buildSettingsPanel({
            // BetterDiscord wires the panel-level onChange for `switch` items
            // only: every other type is rendered as
            //   Kr({...setting, defaultValue, disabled})
            // and reports exclusively through the setting's own onChange. With
            // just the panel callback, the API key, server ids, model and the
            // numeric settings were silently discarded. Both are wired, and
            // _set() ignores the duplicate a switch produces.
            onChange: (_categoryId, settingId, value) => this._set(settingId, value),
            settings: withChangeHandlers(this, [
                {
                    type: "dropdown",
                    id: "provider",
                    name: "번역 백엔드",
                    note: "바꾸면 모델·URL 이 그 백엔드의 기본값으로 맞춰집니다. 각 백엔드의 API 키는 따로 기억하므로 되돌아와도 다시 입력할 필요가 없습니다. 아래 칸의 표시는 설정 창을 닫았다 열어야 갱신됩니다.",
                    value: v.provider,
                    options: PROVIDER_OPTIONS,
                },
                {
                    type: "text",
                    id: "apiKey",
                    name: `${getProvider(v.provider).label} API 키`,
                    // The stored key is never rendered: BetterDiscord's text
                    // input has no masked mode, and this panel is a real
                    // exposure risk while screen sharing.
                    note: v.apiKey
                        ? `저장된 키는 표시되지 않습니다. 새 키를 입력하면 교체되고, 비워 두면 유지됩니다. 지우려면 ${CLEAR_TOKEN} 를 입력하세요.`
                        : KEY_SOURCE[v.provider] || "제공사 콘솔에서 API 키를 발급하세요.",
                    placeholder: v.apiKey ? `저장됨 · ${fingerprint(v.apiKey)}` : "sk-...",
                    value: "",
                },
                {
                    type: "text",
                    id: "model",
                    name: "모델 이름",
                    note: MODEL_HINT[v.provider] || "OpenAI 호환 모델 이름",
                    value: v.model,
                },
                {
                    type: "text",
                    id: "baseUrl",
                    name: "API Base URL",
                    note: "OpenAI 호환 엔드포인트. 보통 그대로 둡니다.",
                    value: v.baseUrl,
                },
                {
                    type: "text",
                    id: "guildIds",
                    name: "대상 서버 ID",
                    note: "쉼표 또는 공백으로 구분. 개발자 모드를 켠 뒤 서버 아이콘 우클릭 → 서버 ID 복사.",
                    value: v.guildIds,
                },
                {
                    type: "slider",
                    id: "koreanThreshold",
                    name: "한국어로 간주할 한글 비율",
                    note: "메시지의 글자 중 한글 비율이 이 값 이상이면 번역하지 않습니다.",
                    value: v.koreanThreshold,
                    min: 5,
                    max: 95,
                    step: 5,
                    units: "%",
                    markers: [10, 30, 50, 70, 90],
                },
                {
                    type: "number",
                    id: "maxChars",
                    name: "번역할 최대 글자 수",
                    note: "이보다 긴 메시지는 건너뜁니다.",
                    value: v.maxChars,
                    min: 200,
                    max: 8000,
                    step: 100,
                },
                {
                    type: "number",
                    id: "maxConcurrent",
                    name: "동시 번역 요청 수",
                    value: v.maxConcurrent,
                    min: 1,
                    max: 10,
                },
                {
                    type: "switch",
                    id: "translateBots",
                    name: "봇 메시지도 번역",
                    value: v.translateBots,
                },
                {
                    type: "switch",
                    id: "translateOwnMessages",
                    name: "내 메시지도 번역",
                    value: v.translateOwnMessages,
                },
                {
                    type: "switch",
                    id: "showPending",
                    name: "번역 중 표시",
                    value: v.showPending,
                },
                {
                    type: "switch",
                    id: "showErrors",
                    name: "번역 실패 시 표시",
                    value: v.showErrors,
                },
            ]),
        });
    }
}

/** Give every setting its own onChange, which is the only one BdApi calls. */
function withChangeHandlers(settings, items) {
    return items.map((item) => ({
        ...item,
        onChange: (value) => settings._set(item.id, value),
    }));
}

// Pasted keys and URLs routinely carry stray whitespace, which turns into a 401
// or a malformed endpoint.
const TRIMMED_FIELDS = new Set(["apiKey", "baseUrl", "model"]);

const CREDENTIAL_FIELDS = new Set(["apiKey", "model", "baseUrl"]);

const KEY_SOURCE = {
    deepseek: "platform.deepseek.com → API Keys 에서 발급합니다.",
    gemini: "aistudio.google.com → Get API key 에서 발급합니다. 무료 티어가 있습니다.",
};

const MODEL_HINT = {
    deepseek: "예: deepseek-v4-flash(기본·저렴), deepseek-v4-pro(고품질)",
    gemini: "예: gemini-3.1-flash-lite(기본·약 1초). gemma-4-* 는 추론을 끌 수 없어 9~12초가 걸리고 번역문 대신 추론이 나옵니다.",
};

// Typed into the (always blank) API key field to erase the stored key, since an
// empty field means "keep what is saved".
const CLEAR_TOKEN = "-";

// Sentinel returned by coerce() for an edit that must not be applied.
const KEEP = Symbol("keep");

function normalize(values) {
    for (const field of TRIMMED_FIELDS) {
        if (typeof values[field] === "string") values[field] = values[field].trim();
    }
    return values;
}

function coerce(id, value, previous) {
    if (!TRIMMED_FIELDS.has(id) || typeof value !== "string") return value;

    const trimmed = value.trim();
    if (id !== "apiKey") return trimmed;

    // The field renders empty, so an empty edit is "unchanged", not "erase".
    if (!trimmed) return previous ? KEEP : "";
    return trimmed === CLEAR_TOKEN ? "" : trimmed;
}

/** Last four characters, the way a provider console identifies a key. */
function fingerprint(key) {
    return key.length >= 8 ? `••••${key.slice(-4)}` : "••••";
}

function safeLoad() {
    try {
        const loaded = BdApi.Data.load(NAME, "settings") || loadLegacy();
        logger.info("설정 로드:", loaded ? `apiKey=${!!loaded.apiKey}` : "저장된 값 없음");
        return loaded || {};
    } catch (e) {
        logger.error("설정 로드 실패", e);
        return {};
    }
}

/** Settings saved under a previous plugin name, carried over once. */
function loadLegacy() {
    for (const legacy of LEGACY_NAMES) {
        const stored = BdApi.Data.load(legacy, "settings");
        if (stored) {
            logger.info(`이전 이름(${legacy})의 설정을 가져왔습니다`);
            return stored;
        }
    }
    return null;
}

function parseGuildIds(raw) {
    return new Set(
        String(raw || "")
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter((s) => /^\d{15,25}$/.test(s)),
    );
}
