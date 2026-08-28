import { NAME, LEGACY_NAMES, DEFAULT_SETTINGS } from "./constants.js";
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
        if (next === KEEP) return;
        this._values[id] = next;
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
            onChange: (_categoryId, settingId, value) => this._set(settingId, value),
            settings: [
                {
                    type: "text",
                    id: "apiKey",
                    name: "DeepSeek API 키",
                    // The stored key is never rendered: BetterDiscord's text
                    // input has no masked mode, and this panel is a real
                    // exposure risk while screen sharing.
                    note: v.apiKey
                        ? `저장된 키는 표시되지 않습니다. 새 키를 입력하면 교체되고, 비워 두면 유지됩니다. 지우려면 ${CLEAR_TOKEN} 를 입력하세요.`
                        : "platform.deepseek.com → API Keys 에서 발급합니다.",
                    placeholder: v.apiKey ? `저장됨 · ${fingerprint(v.apiKey)}` : "sk-...",
                    value: "",
                },
                {
                    type: "text",
                    id: "model",
                    name: "모델 이름",
                    note: "예: deepseek-v4-flash(기본·저렴), deepseek-v4-pro(고품질)",
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
            ],
        });
    }
}

// Pasted keys and URLs routinely carry stray whitespace, which turns into a 401
// or a malformed endpoint.
const TRIMMED_FIELDS = new Set(["apiKey", "baseUrl", "model"]);

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
