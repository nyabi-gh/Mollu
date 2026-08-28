// Static configuration shared across modules.

// Must match `name` in meta.json. Used as the BdApi caller id, data-store name,
// and injected <style> id.
export const NAME = "Mollu";

// Data-store names this plugin used before it was renamed. Settings and cache
// are read from these once so a rename does not silently drop the user's API
// key and target servers.
export const LEGACY_NAMES = ["KoreanAutoTranslator"];

export const DEFAULT_SETTINGS = Object.freeze({
    provider: "deepseek",
    apiKey: "",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    // Comma/space separated guild ids. Translation only runs in these servers.
    guildIds: "",
    // Per-provider {apiKey, model, baseUrl}, so switching providers does not
    // throw away the credentials of the one being left. Always replaced, never
    // mutated in place: DEFAULT_SETTINGS is shared.
    profiles: {},
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

// Data-store key for the persistent cache. Bumped to "-v2" because entries
// written before that version stored token-substituted text, which could
// surface another message's mention or link on a cache hit.
export const CACHE_KEY = "cache-v2";
export const LEGACY_CACHE_KEYS = ["cache"];

// Minimum gap between "translation failed" toasts.
export const ERROR_TOAST_COOLDOWN_MS = 15000;

// Per-request timeout handed to BdApi.Net.fetch (its own default is 8s).
export const REQUEST_TIMEOUT_MS = 30000;

// After a failed translation the same text is not retried for this long.
// Without it every re-render of a message re-issues the request.
export const FAILURE_BACKOFF_MS = 60000;
export const FAILURE_RECORD_LIMIT = 500;

// Hard ceiling on model output. A translation is roughly as long as its source,
// so the per-request budget is derived from the source length and only clamped
// here. This bounds runaway generations (e.g. a prompt-injected message) without
// truncating a legitimately long translation.
export const MAX_OUTPUT_TOKENS = 4096;
export const OUTPUT_TOKEN_HEADROOM = 256;
