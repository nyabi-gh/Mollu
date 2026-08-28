import { NAME, LEGACY_NAMES, DEFAULT_SETTINGS } from "./constants.js";
import { getProvider, PROVIDER_OPTIONS } from "./translation/providers/index.js";
import { logger } from "./lib/logger.js";

export class Settings {
    constructor() {
        const stored = safeLoad();
        this._values = normalize({ ...DEFAULT_SETTINGS, ...stored });
        this._guildIdSet = parseGuildIds(this._values.guildIds);
        this._listeners = new Set();
        // 이전 이름에서 인계한 값은 무언가가 다시 쓰기 전까지 옛 저장소에만 있다.
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
        // KEEP 은 적용하면 안 되는 편집. 값이 그대로면 같은 편집이 두 번 온
        // 것이므로(buildPanel 참고) 다시 쓸 필요가 없다.
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

    // 현재 프로바이더를 떠나기 전에 자격증명을 기억해 둔다.
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
            // BetterDiscord 는 패널 레벨 onChange 를 switch 타입에만 연결한다.
            // 나머지 타입은 Kr({...setting, defaultValue, disabled}) 로 렌더되어
            // 오직 설정 항목 자신의 onChange 로만 값을 알린다. 패널 콜백만 넘기면
            // API 키·서버 ID·모델·숫자 설정이 전부 조용히 버려진다. 둘 다 연결하고,
            // switch 에서 생기는 중복은 _set() 이 무시한다.
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
                    // 저장된 키는 렌더하지 않는다. BD 텍스트 입력에는 마스킹
                    // 모드가 없고, 화면 공유 중 이 패널은 실제 노출 위험이다.
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
                    id: "autoTranslate",
                    name: "자동 번역",
                    note: "끄면 수동 모드가 됩니다. 번역 대상 메시지 아래에 '번역' 버튼만 나오고, 누른 것만 API 로 보냅니다. 토큰을 아끼거나 무료 티어 한도를 지킬 때 쓰세요.",
                    value: v.autoTranslate,
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

// 모든 항목에 자기 onChange 를 붙인다. BdApi 가 실제로 호출하는 건 이것뿐이다.
function withChangeHandlers(settings, items) {
    return items.map((item) => ({
        ...item,
        onChange: (value) => settings._set(item.id, value),
    }));
}

// 붙여넣은 키와 URL 에는 공백이 딸려 오기 쉬운데, 그대로 두면 401 이나 잘못된
// 엔드포인트가 된다.
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

// 항상 비어 보이는 API 키 칸에서 빈 입력은 "유지" 를 뜻하므로, 저장된 키를
// 지우려면 이 값을 입력한다.
const CLEAR_TOKEN = "-";

// 적용하면 안 되는 편집에 대해 coerce() 가 돌려주는 표식.
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

    // 칸이 비어 보이므로 빈 입력은 "삭제" 가 아니라 "변경 없음" 이다.
    if (!trimmed) return previous ? KEEP : "";
    return trimmed === CLEAR_TOKEN ? "" : trimmed;
}

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
