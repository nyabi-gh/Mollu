import { NAME, LEGACY_NAMES, DEFAULT_SETTINGS } from "./constants.js";
import { getProvider, PROVIDER_OPTIONS } from "./translation/providers/index.js";
import { LANGUAGE_OPTIONS } from "./languages.js";
import { setLocale, t, UI_LANGUAGES } from "./i18n.js";
import { keysFromString } from "./hotkey.js";
import { React } from "./discord.js";
import { logger } from "./lib/logger.js";

export class Settings {
    constructor() {
        const stored = migrate(safeLoad());
        this._values = normalize({ ...DEFAULT_SETTINGS, ...stored });
        this._guildIdSet = parseGuildIds(this._values.guildIds);
        this._listeners = new Set();
        setLocale(this._values.uiLanguage);
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

    set(id, value) {
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
        if (id === "uiLanguage") setLocale(next);
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
            logger.error("failed to save settings", e);
        }
    }

    // BD 의 설정 항목은 defaultValue 로 한 번 초기화되는 비제어 컴포넌트라, 값만
    // 바꿔 다시 렌더해도 화면은 그대로다. 프로바이더나 UI 언어처럼 패널 전체의
    // 표시를 바꾸는 편집은 key 를 갈아 끼워 통째로 다시 마운트시킨다.
    buildPanel() {
        const settings = this;
        function MolluSettings() {
            const [revision, bump] = React.useState(0);
            React.useEffect(
                () =>
                    settings.onChange((id) => {
                        if (PANEL_REBUILD.has(id)) bump((n) => n + 1);
                    }),
                [],
            );
            const panel = BdApi.UI.buildSettingsPanel(settings._panelSpec());
            return React.cloneElement(panel, { key: `panel-${revision}` });
        }
        return React.createElement(MolluSettings);
    }

    _panelSpec() {
        const v = this._values;
        return {
            // BetterDiscord 는 패널 레벨 onChange 를 switch 타입에만 연결한다.
            // 나머지 타입은 Kr({...setting, defaultValue, disabled}) 로 렌더되어
            // 오직 설정 항목 자신의 onChange 로만 값을 알린다. 패널 콜백만 넘기면
            // API 키·서버 ID·모델·숫자 설정이 전부 조용히 버려진다. 둘 다 연결하고,
            // switch 에서 생기는 중복은 set() 이 무시한다.
            onChange: (_categoryId, settingId, value) => this.set(settingId, value),
            settings: withChangeHandlers(this, [
                {
                    type: "dropdown",
                    id: "provider",
                    name: t("settings.provider"),
                    note: t("settings.provider.note"),
                    value: v.provider,
                    options: PROVIDER_OPTIONS,
                },
                {
                    type: "text",
                    id: "apiKey",
                    name: t("settings.apiKey", { provider: getProvider(v.provider).label }),
                    // 저장된 키는 렌더하지 않는다. BD 텍스트 입력에는 마스킹
                    // 모드가 없고, 화면 공유 중 이 패널은 실제 노출 위험이다.
                    note: v.apiKey
                        ? t("settings.apiKey.note", { clear: CLEAR_TOKEN })
                        : t(`keySource.${v.provider}`),
                    placeholder: v.apiKey
                        ? t("settings.apiKey.saved", { fingerprint: fingerprint(v.apiKey) })
                        : "sk-...",
                    value: "",
                },
                {
                    type: "dropdown",
                    id: "targetLanguage",
                    name: t("settings.targetLanguage"),
                    note: t("settings.targetLanguage.note"),
                    value: v.targetLanguage,
                    options: LANGUAGE_OPTIONS,
                },
                // DeepL 처럼 모델을 고르지 않는 백엔드에서는 칸 자체를 숨긴다.
                ...(getProvider(v.provider).usesModel === false
                    ? []
                    : [
                          {
                              type: "text",
                              id: "model",
                              name: t("settings.model"),
                              note: t(`modelHint.${v.provider}`),
                              value: v.model,
                          },
                      ]),
                {
                    type: "text",
                    id: "baseUrl",
                    name: t("settings.baseUrl"),
                    note: t("settings.baseUrl.note"),
                    value: v.baseUrl,
                },
                {
                    type: "switch",
                    id: "allGuilds",
                    name: t("settings.allGuilds"),
                    note: t("settings.allGuilds.note"),
                    value: v.allGuilds,
                },
                {
                    type: "text",
                    id: "guildIds",
                    name: t("settings.guildIds"),
                    note: t("settings.guildIds.note"),
                    value: v.guildIds,
                    // 목록을 무시하는 동안에는 칸도 비활성으로 보여 준다.
                    disableWith: "allGuilds",
                },
                {
                    type: "dropdown",
                    id: "uiLanguage",
                    name: t("settings.uiLanguage"),
                    note: t("settings.uiLanguage.note"),
                    value: v.uiLanguage,
                    options: [
                        { label: t("language.auto"), value: "auto" },
                        ...UI_LANGUAGES.map((code) => ({ label: code.toUpperCase(), value: code })),
                    ],
                },
                {
                    type: "slider",
                    id: "skipThreshold",
                    name: t("settings.threshold"),
                    note: t("settings.threshold.note"),
                    value: v.skipThreshold,
                    min: 5,
                    max: 95,
                    step: 5,
                    units: "%",
                    markers: [10, 30, 50, 70, 90],
                },
                {
                    type: "number",
                    id: "maxChars",
                    name: t("settings.maxChars"),
                    note: t("settings.maxChars.note"),
                    value: v.maxChars,
                    min: 200,
                    max: 8000,
                    step: 100,
                },
                {
                    type: "number",
                    id: "maxConcurrent",
                    name: t("settings.maxConcurrent"),
                    value: v.maxConcurrent,
                    min: 1,
                    max: 10,
                },
                {
                    type: "switch",
                    id: "autoTranslate",
                    name: t("settings.autoTranslate"),
                    note: t("settings.autoTranslate.note"),
                    value: v.autoTranslate,
                },
                {
                    type: "keybind",
                    id: "hotkey",
                    name: t("settings.hotkey"),
                    note: t("settings.hotkey.note"),
                    value: v.hotkey,
                    clearable: true,
                },
                {
                    type: "switch",
                    id: "translateOutgoing",
                    name: t("settings.translateOutgoing"),
                    note: t("settings.translateOutgoing.note"),
                    value: v.translateOutgoing,
                },
                {
                    type: "dropdown",
                    id: "outgoingLanguage",
                    name: t("settings.outgoingLanguage"),
                    note: t("settings.outgoingLanguage.note"),
                    value: v.outgoingLanguage,
                    options: LANGUAGE_OPTIONS,
                    enableWith: "translateOutgoing",
                },
                {
                    type: "keybind",
                    id: "outgoingHotkey",
                    name: t("settings.outgoingHotkey"),
                    note: t("settings.outgoingHotkey.note"),
                    value: v.outgoingHotkey,
                    clearable: true,
                },
                {
                    type: "switch",
                    id: "translateBots",
                    name: t("settings.translateBots"),
                    value: v.translateBots,
                },
                {
                    type: "switch",
                    id: "translateOwnMessages",
                    name: t("settings.translateOwnMessages"),
                    value: v.translateOwnMessages,
                },
                {
                    type: "switch",
                    id: "showPending",
                    name: t("settings.showPending"),
                    value: v.showPending,
                },
                {
                    type: "switch",
                    id: "showErrors",
                    name: t("settings.showErrors"),
                    value: v.showErrors,
                },
                {
                    type: "switch",
                    id: "debugLog",
                    name: t("settings.debugLog"),
                    note: t("settings.debugLog.note"),
                    value: v.debugLog,
                },
            ]),
        };
    }
}

// 이 항목을 바꾸면 다른 칸의 이름·설명·값·표시 여부까지 달라지므로 패널을 다시
// 만든다. 타자를 치는 동안 다시 마운트되면 포커스를 잃으므로 텍스트 칸은 넣지 않는다.
const PANEL_REBUILD = new Set(["provider", "uiLanguage"]);

// 모든 항목에 자기 onChange 를 붙인다. BdApi 가 실제로 호출하는 건 이것뿐이다.
function withChangeHandlers(settings, items) {
    return items.map((item) => ({
        ...item,
        onChange: (value) => settings.set(item.id, value),
    }));
}

// 붙여넣은 키와 URL 에는 공백이 딸려 오기 쉬운데, 그대로 두면 401 이나 잘못된
// 엔드포인트가 된다.
const TRIMMED_FIELDS = new Set(["apiKey", "baseUrl", "model"]);

const CREDENTIAL_FIELDS = new Set(["apiKey", "model", "baseUrl"]);

// 항상 비어 보이는 API 키 칸에서 빈 입력은 "유지" 를 뜻하므로, 저장된 키를
// 지우려면 이 값을 입력한다.
const CLEAR_TOKEN = "-";

// 적용하면 안 되는 편집에 대해 coerce() 가 돌려주는 표식.
const KEEP = Symbol("keep");

// 기본값과 병합하기 전에 적용해야 한다. 병합 후에는 기본값이 이미 들어와 있어
// "저장된 적 없음" 과 구분할 수 없다.
function migrate(stored) {
    if (!stored || typeof stored !== "object") return stored;

    // skipThreshold 의 옛 이름.
    if (stored.skipThreshold === undefined && typeof stored.koreanThreshold === "number") {
        stored.skipThreshold = stored.koreanThreshold;
    }
    delete stored.koreanThreshold;

    // 포르투갈어를 지역 변종으로 나누기 전 값.
    if (stored.targetLanguage === "pt") stored.targetLanguage = "pt-BR";

    // 단축키는 "Ctrl+Shift+T" 문자열이었다가 BD keybind 입력이 쓰는 키 이름
    // 배열이 됐다. 문자열을 그대로 두면 패널 자체가 렌더되지 않는다.
    for (const field of ["hotkey", "outgoingHotkey"]) {
        if (typeof stored[field] === "string") stored[field] = keysFromString(stored[field]);
    }
    return stored;
}

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
        logger.info("settings loaded:", loaded ? `apiKey=${!!loaded.apiKey}` : "none stored");
        return loaded || {};
    } catch (e) {
        logger.error("failed to load settings", e);
        return {};
    }
}

function loadLegacy() {
    for (const legacy of LEGACY_NAMES) {
        const stored = BdApi.Data.load(legacy, "settings");
        if (stored) {
            logger.info(`carried settings over from "${legacy}"`);
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
