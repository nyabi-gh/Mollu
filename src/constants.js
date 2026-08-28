// Static configuration shared across modules.

// Must match `name` in meta.json. Used as the BdApi caller id, data-store name,
// and injected <style> id.
export const NAME = "KoreanAutoTranslator";

export const DEFAULT_SETTINGS = Object.freeze({
    provider: "deepseek",
    apiKey: "",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    // Comma/space separated guild ids. Translation only runs in these servers.
    guildIds: "",
    // A message is treated as Korean (and skipped) when its share of Hangul
    // letters is at least this percentage.
    koreanThreshold: 30,
    // Messages longer than this are skipped to bound cost.
    maxChars: 3000,
    maxConcurrent: 3,
    translateBots: true,
    translateOwnMessages: false,
    showPending: true,
    showErrors: false,
});

// Persistent translation cache is trimmed back to this many entries.
export const CACHE_LIMIT = 3000;

// Minimum gap between "translation failed" toasts.
export const ERROR_TOAST_COOLDOWN_MS = 15000;

// Per-request timeout handed to BdApi.Net.fetch (its own default is 8s).
export const REQUEST_TIMEOUT_MS = 30000;
