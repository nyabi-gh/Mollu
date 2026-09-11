import { NAME, LEGACY_NAMES, DEFAULT_SETTINGS } from "./constants.js";
import {
    getProvider,
    knownModels,
    isCustomModel,
    CUSTOM_MODEL,
    PROVIDER_OPTIONS,
} from "./translation/providers/index.js";
import { LANGUAGE_OPTIONS } from "./languages.js";
import { setLocale, t, UI_LANGUAGES } from "./i18n.js";
import { keysFromString } from "./hotkey.js";
import { React } from "./discord.js";
import { logger } from "./lib/logger.js";

export class Settings {
    constructor(actions = {}) {
        this._actions = actions;
        const stored = migrate(safeLoad());
        this._values = normalize({ ...DEFAULT_SETTINGS, ...stored });
        this._guildIdSet = parseGuildIds(this._values.guildIds);
        this._listeners = new Set();
        setLocale(this._values.uiLanguage);

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
        if (id === CUSTOM_MODEL_FIELD) return this.set("model", value);
        if (id === "model" && value === CUSTOM_MODEL) return this._openCustomModel();

        const next = coerce(id, value, this._values[id]);

        if (next === KEEP || same(next, this._values[id])) return;

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
            } catch {}
        }
    }

    // Empty the model so the text field starts blank, but keep a name already typed in.
    _openCustomModel() {
        if (!this.usesCustomModel) this.set("model", "");
    }

    get usesCustomModel() {
        return isCustomModel(this._values.provider, this._values.model);
    }

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

    buildPanel() {
        const settings = this;
        function MolluSettings() {
            const [revision, bump] = React.useState(0);
            React.useEffect(() => {
                let custom = settings.usesCustomModel;
                return settings.onChange((id) => {
                    const nowCustom = settings.usesCustomModel;
                    const flipped = nowCustom !== custom;
                    custom = nowCustom;

                    // Rebuilding remounts every field, so typing a model name must not
                    // trigger one; swapping the list for that field has to.
                    if (PANEL_REBUILD.has(id) || (id === "model" && flipped)) bump((n) => n + 1);
                });
            }, []);
            const panel = BdApi.UI.buildSettingsPanel(settings._panelSpec());
            return React.cloneElement(panel, { key: `panel-${revision}` });
        }
        return React.createElement(MolluSettings);
    }

    _panelSpec() {
        const v = this._values;
        return {
            onChange: (_categoryId, settingId, value) => this.set(settingId, value),

            onDrawerToggle: (id, shown) => DRAWERS.set(id, shown),
            getDrawerState: (id, fallback) => DRAWERS.get(id) ?? fallback,
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

                    disableWith: "allGuilds",
                },
                {
                    type: "switch",
                    id: "translateDms",
                    name: t("settings.translateDms"),
                    note: t("settings.translateDms.note"),
                    value: v.translateDms,
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
                    type: "category",
                    id: "advanced",
                    name: t("settings.advanced"),
                    collapsible: true,
                    shown: true,
                    settings: withChangeHandlers(this, [
                        ...modelFields(v, this.usesCustomModel),
                        {
                            type: "text",
                            id: "baseUrl",
                            name: t("settings.baseUrl"),
                            note: t("settings.baseUrl.note"),
                            value: v.baseUrl,
                        },
                        {
                            type: "switch",
                            id: "debugLog",
                            name: t("settings.debugLog"),
                            note: t("settings.debugLog.note"),
                            value: v.debugLog,
                        },
                        {
                            type: "switch",
                            id: "autoUpdate",
                            name: t("settings.autoUpdate"),
                            note: t("settings.autoUpdate.note"),
                            value: v.autoUpdate,
                        },
                        {
                            type: "button",
                            id: "checkUpdate",
                            name: t("settings.checkUpdate"),
                            note: t("settings.checkUpdate.note"),
                            children: t("settings.checkUpdate.action"),
                            onClick: () => this._actions.checkUpdate?.(),
                        },
                        {
                            type: "button",
                            id: "clearCache",
                            name: t("settings.clearCache"),
                            note: t("settings.clearCache.note"),
                            children: t("settings.clearCache.action"),
                            color: "red",
                            onClick: () => this._actions.clearCache?.(),
                        },
                    ]),
                },
            ]),
        };
    }
}

const CUSTOM_MODEL_FIELD = "customModel";

function modelFields(v, custom) {
    const models = knownModels(v.provider);
    if (models.length === 0) return [];

    const dropdown = {
        type: "dropdown",
        id: "model",
        name: t("settings.model"),
        note: t(`modelHint.${v.provider}`),
        value: custom ? CUSTOM_MODEL : v.model,
        options: [
            ...models.map((model) => ({ label: model, value: model })),
            { label: t("settings.model.custom"), value: CUSTOM_MODEL },
        ],
    };
    if (!custom) return [dropdown];

    return [
        dropdown,
        {
            type: "text",
            id: CUSTOM_MODEL_FIELD,
            name: t("settings.customModel"),
            note: t("settings.customModel.note", { fallback: getProvider(v.provider).defaults.model }),
            placeholder: models[0],
            value: v.model,
        },
    ];
}

const PANEL_REBUILD = new Set(["provider", "uiLanguage"]);

const DRAWERS = new Map();

function withChangeHandlers(settings, items) {
    return items.map((item) =>
        item.type === "button" || item.type === "category"
            ? item
            : { ...item, onChange: (value) => settings.set(item.id, value) },
    );
}

const TRIMMED_FIELDS = new Set(["apiKey", "baseUrl", "model"]);

const CREDENTIAL_FIELDS = new Set(["apiKey", "model", "baseUrl"]);

const CLEAR_TOKEN = "-";

const KEEP = Symbol("keep");

// The panel reports an edit twice, from the field and from the panel, so a set() that
// changes nothing has to stay a no-op. Keybinds are arrays and never match by reference.
function same(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function migrate(stored) {
    if (!stored || typeof stored !== "object") return stored;

    if (stored.skipThreshold === undefined && typeof stored.koreanThreshold === "number") {
        stored.skipThreshold = stored.koreanThreshold;
    }
    delete stored.koreanThreshold;

    if (stored.targetLanguage === "pt") stored.targetLanguage = "pt-BR";

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
