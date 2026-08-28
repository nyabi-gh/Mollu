export const NAME = "Mollu";

export const LEGACY_NAMES = ["KoreanAutoTranslator"];

export const DEFAULT_SETTINGS = Object.freeze({
    provider: "deepseek",
    apiKey: "",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    allGuilds: false,
    guildIds: "",
    targetLanguage: "ko",
    uiLanguage: "auto",
    profiles: Object.freeze({}),
    skipThreshold: 30,
    maxChars: 3000,
    maxConcurrent: 3,
    autoTranslate: true,
    hotkey: Object.freeze(["Control", "Shift", "T"]),
    translateOutgoing: false,
    outgoingLanguage: "en",
    outgoingHotkey: Object.freeze(["Control", "Shift", "O"]),
    translateBots: true,
    translateOwnMessages: false,
    showPending: true,
    showErrors: false,
    debugLog: false,
    autoUpdate: true,
});

export const CACHE_LIMIT = 3000;

export const CACHE_SAVE_DEBOUNCE_MS = 10000;

export const CACHE_KEY = "cache-v3";
export const LEGACY_CACHE_KEYS = ["cache", "cache-v2"];

export const ERROR_TOAST_COOLDOWN_MS = 15000;

export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
export const UPDATE_CHECK_DELAY_MS = 15000;

export const TRACE_LIMIT = 500;

export const REQUEST_TIMEOUT_MS = 30000;

export const RATE_LIMIT_PAUSE_MS = 20000;
export const MAX_RATE_LIMIT_PAUSE_MS = 120000;
export const MAX_RATE_LIMIT_RETRIES = 3;

export const TRANSIENT_RETRIES = 2;
export const TRANSIENT_RETRY_DELAY_MS = 1500;

export const FAILURE_BACKOFF_MS = 60000;
export const FAILURE_RECORD_LIMIT = 500;

export const MAX_OUTPUT_TOKENS = 4096;
export const OUTPUT_TOKEN_HEADROOM = 256;
