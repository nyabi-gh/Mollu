/**
 * @name Mollu
 * @author Nyabi
 * @version 1.0.0
 * @description Auto-translates messages in chosen Discord servers into the language you pick, shown under the original.
 * @source https://github.com/Nyabi/mollu
 */

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  default: () => Mollu
});
module.exports = __toCommonJS(index_exports);

// src/constants.js
var NAME = "Mollu";
var LEGACY_NAMES = ["KoreanAutoTranslator"];
var DEFAULT_SETTINGS = Object.freeze({
  provider: "deepseek",
  apiKey: "",
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com",
  guildIds: "",
  // 번역 결과 언어. languages.js 의 code.
  targetLanguage: "ko",
  // "auto" 면 Discord 로캘을 따른다.
  uiLanguage: "auto",
  // 프로바이더별 {apiKey, model, baseUrl}. DEFAULT_SETTINGS 는 공유되므로
  // 제자리 수정 없이 항상 새 객체로 교체해야 한다.
  profiles: {},
  skipThreshold: 30,
  maxChars: 3e3,
  maxConcurrent: 3,
  autoTranslate: true,
  translateBots: true,
  translateOwnMessages: false,
  showPending: true,
  showErrors: false
});
var CACHE_LIMIT = 3e3;
var CACHE_KEY = "cache-v3";
var LEGACY_CACHE_KEYS = ["cache", "cache-v2"];
var ERROR_TOAST_COOLDOWN_MS = 15e3;
var REQUEST_TIMEOUT_MS = 3e4;
var RATE_LIMIT_PAUSE_MS = 2e4;
var MAX_RATE_LIMIT_PAUSE_MS = 12e4;
var MAX_RATE_LIMIT_RETRIES = 3;
var TRANSIENT_RETRIES = 2;
var TRANSIENT_RETRY_DELAY_MS = 1500;
var FAILURE_BACKOFF_MS = 6e4;
var FAILURE_RECORD_LIMIT = 500;
var MAX_OUTPUT_TOKENS = 4096;
var OUTPUT_TOKEN_HEADROOM = 256;

// src/translation/providers/deepseek.js
var deepseek_exports = {};
__export(deepseek_exports, {
  defaults: () => defaults,
  id: () => id,
  label: () => label,
  translate: () => translate
});

// src/lib/logger.js
function call(level, args) {
  const api = typeof BdApi !== "undefined" && BdApi.Logger;
  if (api && typeof api[level] === "function") {
    api[level](NAME, ...args);
  } else {
    (console[level] || console.log)(`[${NAME}]`, ...args);
  }
}
var logger = {
  info: (...args) => call("info", args),
  warn: (...args) => call("warn", args),
  error: (...args) => call("error", args)
};

// src/i18n.js
var STRINGS = {
  en: {
    "block.pending": "Translating…",
    "block.error": "Translation failed",
    "block.errorTitle": "{message} — click to try again",
    "error.retryLater": "Waiting before trying again",
    "block.trigger": "Translate",
    "toast.outdatedBd": "BetterDiscord is out of date; API requests may be blocked. Please update.",
    "toast.noMessageContent": "Could not find the message component. Check the console log.",
    "toast.needApiKey": "Enter an API key in the settings.",
    "toast.needGuilds": "Add at least one target server id in the settings.",
    "toast.failed": "Translation failed · {message}",
    "error.noApiKey": "No API key configured",
    "error.emptyResponse": "Empty response",
    "error.reasoningOnly": "Response was cut off while the model was still reasoning",
    "error.badBaseUrl": "API Base URL is not valid: {url}",
    "error.badProtocol": "Unsupported protocol: {protocol}",
    "error.insecureUrl": "An http:// address sends the API key in the clear. Use https://.",
    "error.rateLimited": "Rate limited; retry delayed",
    "error.unsupportedLanguage": "{provider} cannot translate into {language}",
    "error.quotaExceeded": "The API key's translation quota is used up",
    "settings.provider": "Translation backend",
    "settings.provider.note": "Switching fills in that backend's model and base URL. Each backend's API key is remembered separately. The fields below only refresh after you close and reopen this panel.",
    "settings.apiKey": "{provider} API key",
    "settings.apiKey.note": "The saved key is never shown. Type a new one to replace it, leave it blank to keep it, or type {clear} to erase it.",
    "settings.apiKey.saved": "saved · {fingerprint}",
    "settings.model": "Model",
    "settings.baseUrl": "API base URL",
    "settings.baseUrl.note": "OpenAI-compatible endpoint. Filled in when you pick a backend.",
    "settings.guildIds": "Target server ids",
    "settings.guildIds.note": "Separated by commas or spaces. Turn on Developer Mode, then right-click a server icon → Copy Server ID.",
    "settings.targetLanguage": "Translate into",
    "settings.targetLanguage.note": "Messages not already in this language are translated into it. Languages written in the Latin alphabet cannot be told apart before sending, so every message is sent once and skipped if it comes back unchanged.",
    "settings.uiLanguage": "Plugin language",
    "settings.uiLanguage.note": "Language of this panel and the plugin's own messages.",
    "settings.threshold": "Treat as already translated above",
    "settings.threshold.note": "A message is skipped when this share of its letters is already in the target language's script.",
    "settings.maxChars": "Maximum characters to translate",
    "settings.maxChars.note": "Longer messages are skipped.",
    "settings.maxConcurrent": "Concurrent requests",
    "settings.autoTranslate": "Automatic translation",
    "settings.autoTranslate.note": "Off is manual mode: a Translate button appears under each message and only what you press is sent. Use it to save tokens or stay inside a free-tier quota.",
    "settings.translateBots": "Translate bot messages",
    "settings.translateOwnMessages": "Translate my own messages",
    "settings.showPending": "Show while translating",
    "settings.showErrors": "Show translation failures",
    "keySource.deepseek": "Get one at platform.deepseek.com → API Keys.",
    "keySource.gemini": "Get one at aistudio.google.com → Get API key. It has a free tier.",
    "keySource.deepl": "Get one at deepl.com/pro-api. The free plan allows 500,000 characters a month and needs no model.",
    "modelHint.deepseek": "e.g. deepseek-v4-flash (cheap), deepseek-v4-pro (higher quality)",
    "modelHint.gemini": "e.g. gemini-3.1-flash-lite (default, ~1s). gemma-4-* reasons and cannot be told not to, so it takes 9-12s and returns its reasoning instead of a translation.",
    "language.auto": "Match Discord"
  },
  ko: {
    "block.pending": "번역 중…",
    "block.error": "번역 실패",
    "block.errorTitle": "{message} — 클릭하면 다시 시도합니다",
    "error.retryLater": "재시도를 기다리는 중",
    "block.trigger": "번역",
    "toast.outdatedBd": "BetterDiscord가 오래되어 API 요청이 차단될 수 있습니다. 최신 버전으로 업데이트하세요.",
    "toast.noMessageContent": "메시지 컴포넌트를 찾지 못했습니다. 콘솔 로그를 확인하세요.",
    "toast.needApiKey": "설정에서 API 키를 입력하세요.",
    "toast.needGuilds": "설정에서 대상 서버 ID를 추가하세요.",
    "toast.failed": "번역 실패 · {message}",
    "error.noApiKey": "API 키가 설정되지 않았습니다",
    "error.emptyResponse": "빈 응답",
    "error.reasoningOnly": "모델이 추론하는 도중에 응답이 잘렸습니다",
    "error.badBaseUrl": "API Base URL이 올바르지 않습니다: {url}",
    "error.badProtocol": "지원하지 않는 프로토콜입니다: {protocol}",
    "error.insecureUrl": "http:// 주소로는 API 키가 평문으로 전송됩니다. https:// 를 사용하세요.",
    "error.rateLimited": "한도 초과로 재시도를 미루는 중",
    "error.unsupportedLanguage": "{provider} 는 {language} 로 번역할 수 없습니다",
    "error.quotaExceeded": "API 키의 번역 할당량을 모두 사용했습니다",
    "settings.provider": "번역 백엔드",
    "settings.provider.note": "바꾸면 모델·URL 이 그 백엔드의 기본값으로 맞춰집니다. 각 백엔드의 API 키는 따로 기억합니다. 아래 칸의 표시는 설정 창을 닫았다 열어야 갱신됩니다.",
    "settings.apiKey": "{provider} API 키",
    "settings.apiKey.note": "저장된 키는 표시되지 않습니다. 새 키를 입력하면 교체되고, 비워 두면 유지됩니다. 지우려면 {clear} 를 입력하세요.",
    "settings.apiKey.saved": "저장됨 · {fingerprint}",
    "settings.model": "모델 이름",
    "settings.baseUrl": "API Base URL",
    "settings.baseUrl.note": "OpenAI 호환 엔드포인트. 백엔드를 고르면 자동으로 채워집니다.",
    "settings.guildIds": "대상 서버 ID",
    "settings.guildIds.note": "쉼표 또는 공백으로 구분. 개발자 모드를 켠 뒤 서버 아이콘 우클릭 → 서버 ID 복사.",
    "settings.targetLanguage": "번역할 언어",
    "settings.targetLanguage.note": "이 언어가 아닌 메시지를 이 언어로 번역합니다. 라틴 문자를 쓰는 언어끼리는 보내기 전에 구분할 수 없어, 메시지마다 한 번은 전송한 뒤 원문 그대로 돌아오면 표시하지 않습니다.",
    "settings.uiLanguage": "플러그인 언어",
    "settings.uiLanguage.note": "이 설정 패널과 플러그인 표시 문구의 언어입니다.",
    "settings.threshold": "번역 생략 기준 비율",
    "settings.threshold.note": "메시지의 글자 중 이 비율 이상이 대상 언어 문자면 번역하지 않습니다.",
    "settings.maxChars": "번역할 최대 글자 수",
    "settings.maxChars.note": "이보다 긴 메시지는 건너뜁니다.",
    "settings.maxConcurrent": "동시 번역 요청 수",
    "settings.autoTranslate": "자동 번역",
    "settings.autoTranslate.note": "끄면 수동 모드가 됩니다. 메시지 아래에 번역 버튼만 나오고, 누른 것만 전송합니다. 토큰을 아끼거나 무료 티어 한도를 지킬 때 쓰세요.",
    "settings.translateBots": "봇 메시지도 번역",
    "settings.translateOwnMessages": "내 메시지도 번역",
    "settings.showPending": "번역 중 표시",
    "settings.showErrors": "번역 실패 시 표시",
    "keySource.deepseek": "platform.deepseek.com → API Keys 에서 발급합니다.",
    "keySource.gemini": "aistudio.google.com → Get API key 에서 발급합니다. 무료 티어가 있습니다.",
    "keySource.deepl": "deepl.com/pro-api 에서 발급합니다. 무료 플랜은 월 50만 자이고 모델 선택이 없습니다.",
    "modelHint.deepseek": "예: deepseek-v4-flash(저렴), deepseek-v4-pro(고품질)",
    "modelHint.gemini": "예: gemini-3.1-flash-lite(기본·약 1초). gemma-4-* 는 추론을 끌 수 없어 9~12초가 걸리고 번역문 대신 추론이 나옵니다.",
    "language.auto": "Discord 설정에 맞춤"
  }
};
var UI_LANGUAGES = ["en", "ko"];
var active = "en";
function setLocale(preference) {
  const wanted = preference === "auto" || !preference ? detect() : preference;
  active = STRINGS[wanted] ? wanted : "en";
}
function t(key, vars) {
  const table = STRINGS[active] || STRINGS.en;
  const template = table[key] ?? STRINGS.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) => name in vars ? String(vars[name]) : whole);
}
function detect() {
  try {
    const tag = typeof navigator !== "undefined" && navigator.language;
    return tag ? String(tag).split("-")[0].toLowerCase() : "en";
  } catch {
    return "en";
  }
}
setLocale("auto");

// src/lib/net.js
function resolveFetch() {
  if (typeof BdApi !== "undefined" && BdApi.Net && typeof BdApi.Net.fetch === "function") {
    return BdApi.Net.fetch.bind(BdApi.Net);
  }
  return typeof fetch === "function" ? fetch : null;
}
function hasNativeFetch() {
  return typeof BdApi !== "undefined" && BdApi.Net && typeof BdApi.Net.fetch === "function";
}
function configError(message) {
  const err = new Error(message);
  err.name = "ConfigError";
  return err;
}
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
function normalizeBaseUrl(raw, fallback = "") {
  const input = String(raw ?? "").trim() || String(fallback);
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw configError(t("error.badBaseUrl", { url: input }));
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw configError(t("error.badProtocol", { protocol: url.protocol }));
  }
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw configError(t("error.insecureUrl"));
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
function retryAfterMs(res, body) {
  const header = res.headers?.get?.("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
    const at = Date.parse(header);
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  }
  const retryDelay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body || "");
  return retryDelay ? Math.round(Number(retryDelay[1]) * 1e3) : 0;
}
function withDeadline(signal, timeout) {
  if (!(timeout > 0) || typeof AbortSignal?.timeout !== "function") return signal;
  const deadline = AbortSignal.timeout(timeout);
  if (!signal) return deadline;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, deadline]) : signal;
}
async function postJson(url, { headers = {}, body, signal, timeout = REQUEST_TIMEOUT_MS } = {}) {
  const doFetch = resolveFetch();
  if (!doFetch) throw new Error("no fetch implementation available");
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
    // timeout 은 BdApi.Net.fetch 전용 옵션이라 표준 fetch 는 무시한다.
    // 폴백 경로에는 signal 로 같은 마감을 건다.
    signal: hasNativeFetch() ? signal : withDeadline(signal, timeout),
    timeout
  });
  const text = await res.text().catch(() => "");
  const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
  if (!ok) {
    if (text) logger.warn(`HTTP ${res.status} body:`, text.slice(0, 500));
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.retryAfterMs = retryAfterMs(res, text);
    throw err;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid JSON in response");
  }
}

// src/translation/prompt.js
function systemPrompt(languageName) {
  return [
    "You are a translation engine embedded in a Discord chat client.",
    `Translate the user's message into natural, colloquial ${languageName}.`,
    "",
    "Rules:",
    "- Output ONLY the translated text. No explanations, no notes, no surrounding quotes, no romanization.",
    "- Preserve Markdown (*, _, ~~, `, #, >, lists), emoji, line breaks and spacing exactly as in the source.",
    "- Tokens shaped like 【0】 or 【1】 are placeholders. Copy each one verbatim, keep it in the same position, and never translate or renumber it.",
    "- Keep the register of the source: casual stays casual, formal stays formal. Render internet slang naturally.",
    `- If the message is already written in ${languageName}, return it unchanged.`
  ].join("\n");
}

// src/languages.js
var HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿ﾠ-ￜ]/;
var KANA = /[぀-ヿㇰ-ㇿｦ-ﾝ]/;
var HAN = /[㐀-䶿一-鿿豈-﫿]/;
var CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;
var ARABIC = /[؀-ۿݐ-ݿ]/;
var THAI = /[฀-๿]/;
var DEVANAGARI = /[ऀ-ॿ]/;
var LANGUAGES = [
  { code: "ko", label: "한국어 (Korean)", name: "Korean", script: HANGUL },
  { code: "en", label: "English", name: "English", script: null },
  { code: "ja", label: "日本語 (Japanese)", name: "Japanese", script: combine(KANA, HAN) },
  { code: "zh", label: "中文 (Chinese)", name: "Simplified Chinese", script: HAN },
  { code: "es", label: "Español (Spanish)", name: "Spanish", script: null },
  { code: "fr", label: "Français (French)", name: "French", script: null },
  { code: "de", label: "Deutsch (German)", name: "German", script: null },
  {
    code: "pt-BR",
    label: "Português do Brasil",
    name: "Brazilian Portuguese",
    badge: "PT-BR",
    script: null
  },
  {
    code: "pt-PT",
    label: "Português de Portugal",
    name: "European Portuguese",
    badge: "PT-PT",
    script: null
  },
  { code: "ru", label: "Русский (Russian)", name: "Russian", script: CYRILLIC },
  { code: "vi", label: "Tiếng Việt (Vietnamese)", name: "Vietnamese", script: null },
  { code: "th", label: "ไทย (Thai)", name: "Thai", script: THAI },
  { code: "id", label: "Bahasa Indonesia", name: "Indonesian", script: null },
  { code: "ar", label: "العربية (Arabic)", name: "Arabic", script: ARABIC },
  { code: "hi", label: "हिन्दी (Hindi)", name: "Hindi", script: DEVANAGARI }
];
var DEFAULT_LANGUAGE = "ko";
var BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));
function getLanguage(code) {
  return BY_CODE.get(code) || BY_CODE.get(DEFAULT_LANGUAGE);
}
function badgeFor(code) {
  const language = getLanguage(code);
  return language.badge || language.code.toUpperCase();
}
var LANGUAGE_OPTIONS = LANGUAGES.map((language) => ({
  label: language.label,
  value: language.code
}));
function combine(...patterns) {
  return new RegExp(patterns.map((pattern) => pattern.source).join("|"));
}

// src/translation/providers/openai-compatible.js
async function chatCompletion({ text, settings, signal, defaults: defaults4, extend: extend3 }) {
  const apiKey = String(settings.apiKey || "").trim();
  if (!apiKey) throw configError(t("error.noApiKey"));
  const base = normalizeBaseUrl(settings.baseUrl, defaults4.baseUrl);
  const model = String(settings.model || defaults4.model).trim();
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt(getLanguage(settings.targetLanguage).name) },
      { role: "user", content: text }
    ],
    temperature: 0.2,
    stream: false,
    max_tokens: outputBudget(text)
  };
  if (extend3) extend3(body, { base, model });
  const json = await postJson(`${base}/chat/completions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
    body
  });
  const choice = json?.choices?.[0];
  const output = stripReasoning(choice?.message?.content);
  if (!output) {
    throw new Error(
      t(choice?.finish_reason === "length" ? "error.reasoningOnly" : "error.emptyResponse")
    );
  }
  return output;
}
function stripReasoning(value) {
  if (typeof value !== "string") return "";
  let text = value.replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, "");
  const unclosed = text.search(/<(?:thought|think)>/i);
  if (unclosed !== -1) text = text.slice(0, unclosed);
  return text.trim();
}
function outputBudget(text) {
  return Math.min(MAX_OUTPUT_TOKENS, text.length + OUTPUT_TOKEN_HEADROOM);
}

// src/translation/providers/deepseek.js
var id = "deepseek";
var label = "DeepSeek";
var defaults = Object.freeze({
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com"
});
function translate(params) {
  return chatCompletion({ ...params, defaults, extend });
}
function extend(body, { base }) {
  if (/(^|\.)deepseek\.com$/i.test(hostOf(base))) body.thinking = { type: "disabled" };
}
function hostOf(base) {
  try {
    return new URL(base).hostname;
  } catch {
    return "";
  }
}

// src/translation/providers/gemini.js
var gemini_exports = {};
__export(gemini_exports, {
  defaults: () => defaults2,
  id: () => id2,
  label: () => label2,
  translate: () => translate2
});
var id2 = "gemini";
var label2 = "Google Gemini / Gemma";
var defaults2 = Object.freeze({
  // 실제 API 로 채팅 길이 메시지를 측정한 결과 약 1초에 번역문만 돌려준다.
  // gemma-4-* 는 9~12초가 걸리고 예산을 전부 <thought> 블록에 써서 번역문이
  // 나오지 않는데, 추론을 끌 수도 없다(아래 extend 참고).
  model: "gemini-3.1-flash-lite",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai"
});
function translate2(params) {
  return chatCompletion({ ...params, defaults: defaults2, extend: extend2 });
}
function extend2(body, { model }) {
  if (/^gemini-/i.test(model)) body.reasoning_effort = "none";
}

// src/translation/providers/deepl.js
var deepl_exports = {};
__export(deepl_exports, {
  defaults: () => defaults3,
  id: () => id3,
  label: () => label3,
  translate: () => translate3,
  usesModel: () => usesModel
});
var id3 = "deepl";
var label3 = "DeepL";
var usesModel = false;
var FREE_BASE = "https://api-free.deepl.com";
var PRO_BASE = "https://api.deepl.com";
var defaults3 = Object.freeze({ model: "", baseUrl: FREE_BASE });
var TARGET_LANG = {
  ko: "KO",
  en: "EN-US",
  ja: "JA",
  zh: "ZH-HANS",
  es: "ES",
  fr: "FR",
  de: "DE",
  "pt-BR": "PT-BR",
  "pt-PT": "PT-PT",
  ru: "RU",
  vi: "VI",
  th: "TH",
  id: "ID",
  ar: "AR",
  hi: "HI"
};
async function translate3({ text, settings, signal }) {
  const apiKey = String(settings.apiKey || "").trim();
  if (!apiKey) throw configError(t("error.noApiKey"));
  const targetLang = TARGET_LANG[settings.targetLanguage];
  if (!targetLang) {
    throw configError(
      t("error.unsupportedLanguage", {
        language: getLanguage(settings.targetLanguage).label,
        provider: label3
      })
    );
  }
  let json;
  try {
    json = await postJson(`${endpoint(apiKey, settings.baseUrl)}/v2/translate`, {
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
      signal,
      body: {
        text: [protect(text)],
        target_lang: targetLang,
        tag_handling: "xml",
        ignore_tags: ["x"],
        preserve_formatting: true
      }
    });
  } catch (err) {
    if (err && err.status === 456) throw configError(t("error.quotaExceeded"));
    throw err;
  }
  const output = json?.translations?.[0]?.text;
  if (typeof output !== "string" || !output.trim()) throw new Error(t("error.emptyResponse"));
  return restore(output).trim();
}
function endpoint(apiKey, baseUrl) {
  const base = normalizeBaseUrl(baseUrl, FREE_BASE);
  const isFreeKey = apiKey.endsWith(":fx");
  if (!isFreeKey && base === FREE_BASE) return PRO_BASE;
  if (isFreeKey && base === PRO_BASE) return FREE_BASE;
  return base;
}
var PLACEHOLDER = /【(\d+)】/g;
var PROTECTED = /<x>(\d+)<\/x>/g;
function protect(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(PLACEHOLDER, (whole, index) => `<x>${index}</x>`);
}
function restore(text) {
  return text.replace(PROTECTED, (whole, index) => `【${index}】`).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// src/translation/providers/index.js
var PROVIDERS = {
  [id]: deepseek_exports,
  [id2]: gemini_exports,
  [id3]: deepl_exports
};
var DEFAULT_PROVIDER = id;
function getProvider(providerId) {
  return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
}
var PROVIDER_OPTIONS = Object.values(PROVIDERS).map((provider) => ({
  label: provider.label,
  value: provider.id
}));

// src/settings.js
var Settings = class {
  constructor() {
    const stored = migrate(safeLoad());
    this._values = normalize({ ...DEFAULT_SETTINGS, ...stored });
    this._guildIdSet = parseGuildIds(this._values.guildIds);
    this._listeners = /* @__PURE__ */ new Set();
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
  _set(id4, value) {
    const next = coerce(id4, value, this._values[id4]);
    if (next === KEEP || next === this._values[id4]) return;
    if (id4 === "provider") {
      this._stashProfile();
      this._values.provider = next;
      this._restoreProfile(next);
    } else {
      this._values[id4] = next;
      if (CREDENTIAL_FIELDS.has(id4)) this._stashProfile();
    }
    if (id4 === "guildIds") this._guildIdSet = parseGuildIds(next);
    if (id4 === "uiLanguage") setLocale(next);
    this._persist();
    for (const listener of this._listeners) {
      try {
        listener(id4, next);
      } catch {
      }
    }
  }
  // 현재 프로바이더를 떠나기 전에 자격증명을 기억해 둔다.
  _stashProfile() {
    const { provider, apiKey, model, baseUrl } = this._values;
    this._values.profiles = { ...this._values.profiles, [provider]: { apiKey, model, baseUrl } };
  }
  _restoreProfile(providerId) {
    const { defaults: defaults4 } = getProvider(providerId);
    const saved = this._values.profiles?.[providerId] ?? {};
    this._values.apiKey = saved.apiKey || "";
    this._values.model = saved.model || defaults4.model;
    this._values.baseUrl = saved.baseUrl || defaults4.baseUrl;
  }
  _persist() {
    try {
      BdApi.Data.save(NAME, "settings", { ...this._values });
    } catch (e) {
      logger.error("failed to save settings", e);
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
          name: t("settings.provider"),
          note: t("settings.provider.note"),
          value: v.provider,
          options: PROVIDER_OPTIONS
        },
        {
          type: "text",
          id: "apiKey",
          name: t("settings.apiKey", { provider: getProvider(v.provider).label }),
          // 저장된 키는 렌더하지 않는다. BD 텍스트 입력에는 마스킹
          // 모드가 없고, 화면 공유 중 이 패널은 실제 노출 위험이다.
          note: v.apiKey ? t("settings.apiKey.note", { clear: CLEAR_TOKEN }) : t(`keySource.${v.provider}`),
          placeholder: v.apiKey ? t("settings.apiKey.saved", { fingerprint: fingerprint(v.apiKey) }) : "sk-...",
          value: ""
        },
        {
          type: "dropdown",
          id: "targetLanguage",
          name: t("settings.targetLanguage"),
          note: t("settings.targetLanguage.note"),
          value: v.targetLanguage,
          options: LANGUAGE_OPTIONS
        },
        // DeepL 처럼 모델을 고르지 않는 백엔드에서는 칸 자체를 숨긴다.
        ...getProvider(v.provider).usesModel === false ? [] : [
          {
            type: "text",
            id: "model",
            name: t("settings.model"),
            note: t(`modelHint.${v.provider}`),
            value: v.model
          }
        ],
        {
          type: "text",
          id: "baseUrl",
          name: t("settings.baseUrl"),
          note: t("settings.baseUrl.note"),
          value: v.baseUrl
        },
        {
          type: "text",
          id: "guildIds",
          name: t("settings.guildIds"),
          note: t("settings.guildIds.note"),
          value: v.guildIds
        },
        {
          type: "dropdown",
          id: "uiLanguage",
          name: t("settings.uiLanguage"),
          note: t("settings.uiLanguage.note"),
          value: v.uiLanguage,
          options: [
            { label: t("language.auto"), value: "auto" },
            ...UI_LANGUAGES.map((code) => ({ label: code.toUpperCase(), value: code }))
          ]
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
          markers: [10, 30, 50, 70, 90]
        },
        {
          type: "number",
          id: "maxChars",
          name: t("settings.maxChars"),
          note: t("settings.maxChars.note"),
          value: v.maxChars,
          min: 200,
          max: 8e3,
          step: 100
        },
        {
          type: "number",
          id: "maxConcurrent",
          name: t("settings.maxConcurrent"),
          value: v.maxConcurrent,
          min: 1,
          max: 10
        },
        {
          type: "switch",
          id: "autoTranslate",
          name: t("settings.autoTranslate"),
          note: t("settings.autoTranslate.note"),
          value: v.autoTranslate
        },
        {
          type: "switch",
          id: "translateBots",
          name: t("settings.translateBots"),
          value: v.translateBots
        },
        {
          type: "switch",
          id: "translateOwnMessages",
          name: t("settings.translateOwnMessages"),
          value: v.translateOwnMessages
        },
        {
          type: "switch",
          id: "showPending",
          name: t("settings.showPending"),
          value: v.showPending
        },
        {
          type: "switch",
          id: "showErrors",
          name: t("settings.showErrors"),
          value: v.showErrors
        }
      ])
    });
  }
};
function withChangeHandlers(settings, items) {
  return items.map((item) => ({
    ...item,
    onChange: (value) => settings._set(item.id, value)
  }));
}
var TRIMMED_FIELDS = /* @__PURE__ */ new Set(["apiKey", "baseUrl", "model"]);
var CREDENTIAL_FIELDS = /* @__PURE__ */ new Set(["apiKey", "model", "baseUrl"]);
var CLEAR_TOKEN = "-";
var KEEP = /* @__PURE__ */ Symbol("keep");
function migrate(stored) {
  if (!stored || typeof stored !== "object") return stored;
  if (stored.skipThreshold === void 0 && typeof stored.koreanThreshold === "number") {
    stored.skipThreshold = stored.koreanThreshold;
  }
  delete stored.koreanThreshold;
  if (stored.targetLanguage === "pt") stored.targetLanguage = "pt-BR";
  return stored;
}
function normalize(values) {
  for (const field of TRIMMED_FIELDS) {
    if (typeof values[field] === "string") values[field] = values[field].trim();
  }
  return values;
}
function coerce(id4, value, previous) {
  if (!TRIMMED_FIELDS.has(id4) || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (id4 !== "apiKey") return trimmed;
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
    String(raw || "").split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{15,25}$/.test(s))
  );
}

// src/translation/tokenizer.js
var PATTERNS = [
  // 원문에 이미 들어 있는 리터럴 【n】. 먼저 마스킹해야 아래에서 생성하는
  // placeholder 와 충돌하지 않는다.
  "\\u3010\\d+\\u3011",
  "```[\\s\\S]*?```",
  // fenced code block
  "`[^`\\n]+`",
  // inline code
  "<a?:\\w+:\\d+>",
  // custom emoji
  "<@[!&]?\\d+>",
  // user / role mention
  "<#\\d+>",
  // channel mention
  "<id:[a-z]+>",
  // guild navigation mention
  "<t:\\d+(?::[tTdDfFR])?>",
  // unix timestamp
  "@(?:everyone|here)",
  // mass mention
  "https?://\\S+"
  // url
];
var MASK_PATTERN = PATTERNS.join("|");
var OPEN = "【";
var CLOSE = "】";
var MASK_RE = new RegExp(MASK_PATTERN, "g");
var EXACT_PLACEHOLDER = /\u3010\s*(\d+)\s*\u3011/g;
var LOOSE_PLACEHOLDER = /\[\s*(\d+)\s*\]|\(\s*(\d+)\s*\)|\uff08\s*(\d+)\s*\uff09/g;
function mask(text) {
  MASK_RE.lastIndex = 0;
  const tokens = [];
  const masked = String(text).replace(MASK_RE, (match) => {
    tokens.push(match);
    return `${OPEN}${tokens.length - 1}${CLOSE}`;
  });
  return { masked, tokens };
}
function unmaskSegments(text, tokens) {
  const restored = /* @__PURE__ */ new Set();
  const out = [];
  for (const segment of split(String(text), EXACT_PLACEHOLDER, tokens, restored, true)) {
    if (segment.type === "token") out.push(segment);
    else out.push(...split(segment.value, LOOSE_PLACEHOLDER, tokens, restored, false));
  }
  return out;
}
function split(input, regex, tokens, restored, record) {
  const out = [];
  let last = 0;
  regex.lastIndex = 0;
  for (let match = regex.exec(input); match !== null; match = regex.exec(input)) {
    const index = Number(match.slice(1).find((group) => group !== void 0));
    const token = tokens[index];
    if (token === void 0 || !record && restored.has(index)) continue;
    if (match.index > last) out.push({ type: "text", value: input.slice(last, match.index) });
    out.push({ type: "token", value: token });
    if (record) restored.add(index);
    last = match.index + match[0].length;
  }
  if (last < input.length) out.push({ type: "text", value: input.slice(last) });
  return out;
}

// src/translation/cache.js
var TranslationCache = class {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
  }
  load() {
    for (const store of [NAME, ...LEGACY_NAMES]) {
      for (const key of LEGACY_CACHE_KEYS) {
        try {
          if (BdApi.Data.load(store, key) != null) BdApi.Data.delete(store, key);
        } catch {
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
    }
  }
  save() {
    try {
      const entries = Array.from(this._map);
      const out = [];
      for (let i = entries.length - 1; i >= 0 && out.length < CACHE_LIMIT; i -= 1) {
        const [key, value] = entries[i];
        if (typeof value !== "string") continue;
        if (key.length > 600) continue;
        out.push([key, value]);
      }
      out.reverse();
      BdApi.Data.save(NAME, CACHE_KEY, out);
    } catch {
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
};
function readCache() {
  for (const store of [NAME, ...LEGACY_NAMES]) {
    const stored = BdApi.Data.load(store, CACHE_KEY);
    if (Array.isArray(stored)) return stored;
  }
  return null;
}

// src/translation/queue.js
var TaskQueue = class {
  constructor(concurrency) {
    this._limit = typeof concurrency === "function" ? concurrency : () => concurrency;
    this._active = 0;
    this._pending = [];
  }
  // shouldRun 은 작업이 큐 맨 앞에 왔을 때 다시 확인한다. 호출자가 관심을 잃은
  // 작업(화면 밖으로 나간 메시지)은 슬롯을 차지하지 않고 버려진다.
  run(task, shouldRun) {
    return new Promise((resolve, reject) => {
      this._pending.push({ task, resolve, reject, shouldRun });
      this._drain();
    });
  }
  // 대기 중인 호출자를 방치하지 않고 reject 한다. settle 되지 않는 Promise 는
  // UI 를 "번역 중…" 에 영원히 묶어 둔다.
  clear() {
    const dropped = this._pending;
    this._pending = [];
    for (const { reject } of dropped) {
      const err = new Error("cancelled");
      err.name = "AbortError";
      reject(err);
    }
  }
  _drain() {
    while (this._active < Math.max(1, this._limit() | 0) && this._pending.length > 0) {
      const { task, resolve, reject, shouldRun } = this._pending.shift();
      if (shouldRun && !shouldRun()) {
        const err = new Error("skipped");
        err.name = "SkippedError";
        reject(err);
        continue;
      }
      this._active += 1;
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        this._active -= 1;
        this._drain();
      });
    }
  }
};

// src/translation/translator.js
var skip = () => ({ status: "skip" });
var done = (text, segments) => ({ status: "done", text, segments });
var error = (message) => ({ status: "error", message });
var Translator = class {
  constructor({ settings, onError }) {
    this._settings = settings;
    this._onError = onError || (() => {
    });
    this._cache = new TranslationCache();
    this._queue = new TaskQueue(() => this._settings.current.maxConcurrent);
    this._inflight = /* @__PURE__ */ new Map();
    this._failures = /* @__PURE__ */ new Map();
    this._aborters = /* @__PURE__ */ new Set();
    this._pausedUntil = 0;
    this._stopped = false;
  }
  start() {
    this._stopped = false;
    this._pausedUntil = 0;
    this._cache.load();
  }
  stop() {
    this._stopped = true;
    this._queue.clear();
    for (const controller of this._aborters) {
      try {
        controller.abort();
      } catch {
      }
    }
    this._aborters.clear();
    this._inflight.clear();
    this._failures.clear();
    this._cache.save();
  }
  peek(text) {
    const { masked, tokens } = mask(text);
    const key = this._cacheKey(masked);
    if (this._cache.has(key)) return this._restore(this._cache.get(key), tokens);
    if (text.length > this._settings.current.maxChars) return skip();
    return { status: "unknown" };
  }
  // 같은 원문이라도 대상 언어가 다르면 다른 번역이다.
  _cacheKey(masked) {
    return `${this._settings.current.targetLanguage}${masked}`;
  }
  // onStart 는 요청이 실제로 큐를 떠날 때 호출된다. 큐에 들어간 시점이 아니라
  // 이때 "번역 중" 을 띄워야 스크롤 중 화면이 밀리지 않는다. shouldRun 은 그
  // 순간 다시 확인해, 이미 화면 밖으로 나간 메시지의 작업을 버린다.
  // 이 함수는 절대 reject 하지 않는다.
  translate(text, hooks = {}) {
    const { masked, tokens } = mask(text);
    const key = this._cacheKey(masked);
    if (this._cache.has(key)) {
      return Promise.resolve(this._restore(this._cache.get(key), tokens));
    }
    if (text.length > this._settings.current.maxChars) return Promise.resolve(skip());
    if (hooks.ignoreBackoff) this._failures.delete(key);
    else if (this._isBackingOff(key)) return Promise.resolve(error(t("error.retryLater")));
    let job = this._inflight.get(key);
    if (!job) {
      job = this._queue.run(async () => {
        await this._awaitResume();
        if (this._stopped) throw aborted();
        if (hooks.shouldRun && !hooks.shouldRun()) throw skipped();
        if (hooks.onStart) hooks.onStart();
        return this._callWithRetries(masked);
      }, hooks.shouldRun).then(
        (raw) => this._resolveSuccess(key, masked, raw),
        (err) => this._resolveFailure(key, err)
      ).finally(() => this._inflight.delete(key));
      this._inflight.set(key, job);
    }
    return job.then(
      (outcome) => outcome.status === "done" ? this._restore(outcome.masked, tokens) : outcome
    );
  }
  _restore(maskedValue, tokens) {
    if (typeof maskedValue !== "string") return skip();
    const segments = unmaskSegments(maskedValue, tokens);
    const text = segments.map((segment) => segment.value).join("").trim();
    return text ? done(text, trimEdges(segments)) : skip();
  }
  // 일시적인 실패는 사용자에게 보이기 전에 몇 번 더 해 본다.
  async _callWithRetries(maskedText) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this._callProvider(maskedText);
      } catch (err) {
        if (attempt >= TRANSIENT_RETRIES || this._stopped || !isTransient(err)) throw err;
        logger.warn(`transient failure (${err.message}); retry ${attempt + 1}/${TRANSIENT_RETRIES}`);
        await sleep(TRANSIENT_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  _awaitResume() {
    const wait = this._pausedUntil - Date.now();
    return wait > 0 ? sleep(wait) : Promise.resolve();
  }
  _isBackingOff(maskedKey) {
    const failedAt = this._failures.get(maskedKey);
    if (failedAt == null) return false;
    if (Date.now() - failedAt < FAILURE_BACKOFF_MS) return true;
    this._failures.delete(maskedKey);
    return false;
  }
  async _callProvider(maskedText) {
    const controller = new AbortController();
    this._aborters.add(controller);
    try {
      const provider = getProvider(this._settings.current.provider);
      return await provider.translate({
        text: maskedText,
        settings: this._settings.current,
        signal: controller.signal
      });
    } finally {
      this._aborters.delete(controller);
    }
  }
  _resolveSuccess(key, masked, raw) {
    const maskedTranslation = stripWrappingQuotes(raw, masked).trim();
    if (!maskedTranslation || normalize2(maskedTranslation) === normalize2(masked)) {
      this._cache.set(key, null);
      return skip();
    }
    this._cache.set(key, maskedTranslation);
    return { status: "done", masked: maskedTranslation };
  }
  _resolveFailure(maskedKey, err) {
    const message = err && err.message || String(err);
    if (err && err.name === "AbortError") return error(message);
    if (err && err.name === "SkippedError") return { status: "unknown" };
    if (err && err.status === 429) {
      const after = Math.min(err.retryAfterMs || RATE_LIMIT_PAUSE_MS, MAX_RATE_LIMIT_PAUSE_MS);
      this._pausedUntil = Math.max(this._pausedUntil, Date.now() + after);
      logger.warn(`rate limited; retrying in ${Math.round(after / 1e3)}s`);
      return { status: "retry", after };
    }
    this._rememberFailure(maskedKey);
    logger.warn("translate failed:", message);
    this._onError(err);
    return error(message);
  }
  _rememberFailure(maskedKey) {
    this._failures.set(maskedKey, Date.now());
    if (this._failures.size <= FAILURE_RECORD_LIMIT) return;
    const cutoff = Date.now() - FAILURE_BACKOFF_MS;
    for (const [key, at] of this._failures) {
      if (at < cutoff) this._failures.delete(key);
    }
  }
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isTransient(err) {
  if (!err || err.name === "AbortError" || err.name === "SkippedError") return false;
  if (err.name === "ConfigError") return false;
  if (err.status === void 0) return true;
  return err.status === 408 || err.status >= 500;
}
function aborted() {
  const err = new Error("stopped");
  err.name = "AbortError";
  return err;
}
function skipped() {
  const err = new Error("skipped");
  err.name = "SkippedError";
  return err;
}
function normalize2(value) {
  return String(value).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}
var QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["「", "」"],
  ["『", "』"]
];
function stripWrappingQuotes(value, source) {
  const text = String(value).trim();
  if (text.length < 2) return text;
  for (const [open, close] of QUOTE_PAIRS) {
    if (text[0] !== open || text[text.length - 1] !== close) continue;
    const inner = text.slice(1, -1);
    if (inner.includes(open) || inner.includes(close)) continue;
    const from = String(source ?? "").trim();
    if (from.length >= 2 && from[0] === open && from[from.length - 1] === close) continue;
    return inner.trim();
  }
  return text;
}
function trimEdges(segments) {
  const out = segments.slice();
  while (out.length && out[0].type === "text" && !out[0].value.trim()) out.shift();
  while (out.length && out[out.length - 1].type === "text" && !out[out.length - 1].value.trim()) out.pop();
  if (out.length && out[0].type === "text")
    out[0] = { type: "text", value: out[0].value.replace(/^\s+/, "") };
  const last = out.length - 1;
  if (last >= 0 && out[last].type === "text") {
    out[last] = { type: "text", value: out[last].value.replace(/\s+$/, "") };
  }
  return out;
}

// src/translation/language-detector.js
var MASK_RE2 = new RegExp(MASK_PATTERN, "g");
var NON_LETTER = /[^\p{L}]/gu;
var LanguageDetector = class {
  constructor(settings) {
    this._settings = settings;
  }
  needsTranslation(text) {
    if (typeof text !== "string") return false;
    const letters = this._letters(text);
    if (letters.length < 2) return false;
    const { script } = getLanguage(this._settings.current.targetLanguage);
    if (!script) return true;
    let inTarget = 0;
    for (const ch of letters) {
      if (script.test(ch)) inTarget += 1;
    }
    return inTarget / letters.length < this._threshold();
  }
  // 값이 없거나 숫자가 아니면 기본값으로 돌아간다. NaN 과의 비교는 항상 false 라,
  // 그대로 두면 번역이 통째로 조용히 꺼진다.
  _threshold() {
    const raw = this._settings.current.skipThreshold;
    const configured = typeof raw === "number" ? raw : Number.parseFloat(raw);
    const percent = Number.isFinite(configured) ? configured : DEFAULT_SETTINGS.skipThreshold;
    return percent / 100;
  }
  _letters(text) {
    MASK_RE2.lastIndex = 0;
    NON_LETTER.lastIndex = 0;
    return Array.from(text.replace(MASK_RE2, " ").replace(NON_LETTER, ""));
  }
};

// src/discord.js
var React = BdApi.React;
function createStores() {
  const ChannelStore = BdApi.Webpack.getStore("ChannelStore");
  const UserStore = BdApi.Webpack.getStore("UserStore");
  const GuildStore = BdApi.Webpack.getStore("GuildStore");
  return {
    guildIdForChannel(channelId) {
      try {
        return ChannelStore?.getChannel?.(channelId)?.guild_id ?? null;
      } catch {
        return null;
      }
    },
    currentUserId() {
      try {
        return UserStore?.getCurrentUser?.()?.id ?? null;
      } catch {
        return null;
      }
    },
    // 아래 세 조회는 멘션 표시용이다. null 은 "모름" 이고 호출자는 원본 토큰으로 물러난다.
    userName(userId) {
      try {
        const user = UserStore?.getUser?.(userId);
        return user?.globalName || user?.username || null;
      } catch {
        return null;
      }
    },
    channelName(channelId) {
      try {
        return ChannelStore?.getChannel?.(channelId)?.name ?? null;
      } catch {
        return null;
      }
    },
    roleName(guildId, roleId) {
      try {
        return GuildStore?.getGuild?.(guildId)?.roles?.[roleId]?.name ?? null;
      } catch {
        return null;
      }
    }
  };
}
function findMessageContent() {
  const { Filters } = BdApi.Webpack;
  const markerSets = [
    ["contentRef", "onUpdate", "compact"],
    ["contentRef", "onUpdate", "message", "content"],
    ["className", "message", "children", "content", "onUpdate", "contentRef", "compact"],
    ["messageContent", "onUpdate", "contentRef"]
  ];
  for (const markers of markerSets) {
    const target = tryWithKey(Filters.byComponentType(Filters.byStrings(...markers)));
    if (target) {
      logger.info(`MessageContent resolved via [${markers.join(", ")}] -> key "${target.key}"`);
      return target;
    }
  }
  if (typeof Filters.byDisplayName === "function") {
    const target = tryWithKey(Filters.byDisplayName("MessageContent"));
    if (target) {
      logger.info(`MessageContent resolved via displayName -> key "${target.key}"`);
      return target;
    }
  }
  return null;
}
function tryWithKey(filter) {
  let owner;
  let key;
  try {
    [owner, key] = BdApi.Webpack.getWithKey(filter);
  } catch (e) {
    logger.warn("getWithKey threw", e);
    return null;
  }
  if (!owner || !key) return null;
  const value = owner[key];
  if (value && typeof value.type === "function") return { module: value, key: "type" };
  if (value && typeof value.render === "function") return { module: value, key: "render" };
  if (typeof value === "function") return { module: owner, key };
  return null;
}

// src/ui/rich-text.js
var CUSTOM_EMOJI = /^<(a)?:(\w+):(\d+)>$/;
var USER_MENTION = /^<@!?(\d+)>$/;
var ROLE_MENTION = /^<@&(\d+)>$/;
var CHANNEL_MENTION = /^<#(\d+)>$/;
var TIMESTAMP = /^<t:(\d+)(?::([tTdDfFR]))?>$/;
var FENCED_CODE = /^```(?:[\w+-]*\n)?([\s\S]*?)```$/;
var INLINE_CODE = /^`([^`\n]+)`$/;
var EMOJI_CDN = "https://cdn.discordapp.com/emojis";
function renderSegments(segments, stores, guildId) {
  return segments.map(
    (segment, index) => segment.type === "token" ? renderToken(segment.value, stores, guildId, index) : segment.value
  );
}
function renderToken(token, stores, guildId, key) {
  const emoji = CUSTOM_EMOJI.exec(token);
  if (emoji) {
    const [, animated, name, id4] = emoji;
    return React.createElement("img", {
      key,
      className: "mollu-translation__emoji",
      src: `${EMOJI_CDN}/${id4}.${animated ? "gif" : "webp"}?size=44&quality=lossless`,
      alt: `:${name}:`,
      title: `:${name}:`,
      draggable: false
    });
  }
  const user = USER_MENTION.exec(token);
  if (user) return mention(key, stores?.userName?.(user[1]), "@", token);
  const role = ROLE_MENTION.exec(token);
  if (role) return mention(key, guildId ? stores?.roleName?.(guildId, role[1]) : null, "@", token);
  const channel = CHANNEL_MENTION.exec(token);
  if (channel) return mention(key, stores?.channelName?.(channel[1]), "#", token);
  const timestamp = TIMESTAMP.exec(token);
  if (timestamp) {
    const formatted = formatTimestamp(Number(timestamp[1]), timestamp[2]);
    return formatted == null ? token : React.createElement("span", { key, className: "mollu-translation__mention" }, formatted);
  }
  const code = FENCED_CODE.exec(token) || INLINE_CODE.exec(token);
  if (code) {
    return React.createElement("code", { key, className: "mollu-translation__code" }, code[1]);
  }
  return token;
}
function mention(key, name, sigil, fallback) {
  if (!name) return fallback;
  return React.createElement("span", { key, className: "mollu-translation__mention" }, `${sigil}${name}`);
}
var TIME_STYLES = {
  t: { timeStyle: "short" },
  T: { timeStyle: "medium" },
  d: { dateStyle: "short" },
  D: { dateStyle: "long" },
  f: { dateStyle: "long", timeStyle: "short" },
  F: { dateStyle: "full", timeStyle: "short" }
};
function formatTimestamp(seconds, style) {
  if (!Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1e3);
  if (Number.isNaN(date.getTime())) return null;
  try {
    if (style === "R") return relativeTime(date);
    return new Intl.DateTimeFormat(void 0, TIME_STYLES[style] || TIME_STYLES.f).format(date);
  } catch {
    return null;
  }
}
var RELATIVE_UNITS = [
  ["year", 31536e3],
  ["month", 2592e3],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1]
];
function relativeTime(date) {
  const delta = (date.getTime() - Date.now()) / 1e3;
  const formatter = new Intl.RelativeTimeFormat(void 0, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(delta) >= size || unit === "second") {
      return formatter.format(Math.round(delta / size), unit);
    }
  }
  return null;
}

// src/ui/visibility.js
var observer = null;
var callbacks = /* @__PURE__ */ new Map();
function ensure() {
  if (observer || typeof IntersectionObserver === "undefined") return observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const onChange = callbacks.get(entry.target);
      if (onChange) onChange(entry.isIntersecting);
    }
  });
  return observer;
}
function observeVisibility(node, onChange) {
  const target = ensure();
  if (!target || !node) return null;
  callbacks.set(node, onChange);
  target.observe(node);
  return () => {
    target.unobserve(node);
    callbacks.delete(node);
  };
}
function disconnectVisibility() {
  if (observer) observer.disconnect();
  observer = null;
  callbacks.clear();
}

// src/ui/translation-block.js
var DWELL_MS = 350;
function initialResult(translator, text) {
  const known = translator.peek(text);
  return known.status === "done" || known.status === "skip" ? known : { status: "idle" };
}
function TranslationBlock({ text, translator, settings, stores, guildId }) {
  const anchorRef = React.useRef(null);
  const { showPending, showErrors, autoTranslate } = useDisplaySettings(settings);
  const triggerRef = React.useRef(null);
  const [result, setResult] = React.useState(() => initialResult(translator, text));
  React.useEffect(() => {
    let alive = true;
    let visible = false;
    let dwell = null;
    let running = false;
    let rateLimitRetries = 0;
    const known = translator.peek(text);
    if (known.status === "done" || known.status === "skip") {
      setResult(known);
      return void 0;
    }
    setResult({ status: "idle" });
    const run = (force) => {
      if (!alive || running) return;
      running = true;
      if (force) rateLimitRetries = 0;
      translator.translate(text, {
        ignoreBackoff: force === true,
        // 큐를 실제로 떠난 작업만 "번역 중" 을 띄운다. 큐에 넣는
        // 시점에 띄우면 스크롤 중 수백 개 메시지가 동시에 한 줄씩
        // 커지면서 화면이 밀린다.
        onStart: () => {
          if (alive) setResult({ status: "pending" });
        },
        shouldRun: () => alive && visible
      }).then((res) => {
        if (!alive) return;
        running = false;
        if (res.status === "retry") {
          setResult({ status: "idle" });
          if (visible && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
            rateLimitRetries += 1;
            dwell = setTimeout(run, res.after + jitter());
          } else {
            setResult({ status: "error", message: t("error.rateLimited") });
          }
          return;
        }
        setResult(res.status === "unknown" ? { status: "idle" } : res);
      });
    };
    triggerRef.current = run;
    if (!autoTranslate) {
      visible = true;
      return () => {
        alive = false;
      };
    }
    const stopObserving = observeVisibility(anchorRef.current, (isVisible) => {
      visible = isVisible;
      if (isVisible) {
        if (dwell == null && !running) dwell = setTimeout(run, DWELL_MS);
      } else if (dwell != null) {
        clearTimeout(dwell);
        dwell = null;
      }
    });
    if (!stopObserving) {
      visible = true;
      run();
      return () => {
        alive = false;
      };
    }
    return () => {
      alive = false;
      stopObserving();
      if (dwell != null) clearTimeout(dwell);
    };
  }, [text, autoTranslate]);
  const status = result && result.status;
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", {
      ref: anchorRef,
      className: "mollu-translation__anchor",
      "aria-hidden": "true"
    }),
    renderBody(status, result, {
      showPending,
      showErrors,
      stores,
      guildId,
      autoTranslate,
      badge: badgeFor(settings.current.targetLanguage),
      onTrigger: () => triggerRef.current?.(true)
    })
  );
}
function jitter() {
  return Math.floor(Math.random() * 2e3);
}
function renderBody(status, result, ctx) {
  const { showPending, showErrors, stores, guildId, autoTranslate, onTrigger, badge } = ctx;
  if (status === "idle" && !autoTranslate) {
    return React.createElement(
      "button",
      { type: "button", className: "mollu-translation__trigger", onClick: onTrigger },
      t("block.trigger")
    );
  }
  if (!status || status === "idle" || status === "unknown" || status === "skip") return null;
  if (status === "retry") return null;
  if (status === "pending") {
    return showPending ? React.createElement(
      "div",
      { className: "mollu-translation mollu-translation--pending" },
      t("block.pending")
    ) : null;
  }
  if (status === "error") {
    return showErrors ? React.createElement(
      "button",
      {
        type: "button",
        className: "mollu-translation mollu-translation--error",
        title: t("block.errorTitle", { message: result?.message || "" }),
        onClick: onTrigger
      },
      t("block.error")
    ) : null;
  }
  return React.createElement(
    "div",
    { className: "mollu-translation" },
    React.createElement("span", { className: "mollu-translation__badge" }, badge),
    React.createElement(
      "span",
      { className: "mollu-translation__text" },
      ...renderSegments(result.segments || [{ type: "text", value: result.text }], stores, guildId)
    )
  );
}
function useDisplaySettings(settings) {
  const [display, setDisplay] = React.useState(() => pickDisplay(settings));
  React.useEffect(() => {
    const unsubscribe = settings.onChange((id4) => {
      if (MIRRORED.has(id4)) setDisplay(pickDisplay(settings));
    });
    return () => {
      unsubscribe();
    };
  }, [settings]);
  return display;
}
var MIRRORED = /* @__PURE__ */ new Set(["showPending", "showErrors", "autoTranslate"]);
function pickDisplay(settings) {
  const { showPending, showErrors, autoTranslate } = settings.current;
  return { showPending, showErrors, autoTranslate };
}

// src/message-patch.js
var TRANSLATABLE_TYPES = /* @__PURE__ */ new Set([0, 19]);
var MessagePatch = class {
  constructor({ target, settings, translator, languageDetector, stores }) {
    this._target = target;
    this._settings = settings;
    this._translator = translator;
    this._detector = languageDetector;
    this._stores = stores;
    this._unpatch = null;
  }
  install() {
    const { module: module2, key } = this._target;
    this._unpatch = BdApi.Patcher.after(NAME, module2, key, (_self, args, ret) => {
      try {
        return this._onRender(args?.[0], ret);
      } catch (e) {
        logger.error("render patch failed", e);
        return ret;
      }
    });
  }
  remove() {
    try {
      this._unpatch?.();
    } finally {
      this._unpatch = null;
    }
  }
  _onRender(props, ret) {
    const message = props?.message;
    const guildId = ret ? this._targetGuildId(message) : null;
    if (!guildId) return ret;
    if (!this._detector.needsTranslation(message.content)) return ret;
    const block = React.createElement(TranslationBlock, {
      key: "mollu-translation",
      text: message.content,
      guildId,
      stores: this._stores,
      translator: this._translator,
      settings: this._settings
    });
    return appendChild(ret, block);
  }
  _targetGuildId(message) {
    if (!message || typeof message.content !== "string" || !message.content.trim()) return null;
    if (!TRANSLATABLE_TYPES.has(message.type)) return null;
    const settings = this._settings.current;
    if (!settings.apiKey || this._settings.guildIdSet.size === 0) return null;
    const author = message.author || {};
    if (!settings.translateBots && author.bot) return null;
    if (!settings.translateOwnMessages && author.id && author.id === this._stores.currentUserId()) {
      return null;
    }
    const guildId = this._stores.guildIdForChannel(message.channel_id);
    return guildId && this._settings.guildIdSet.has(guildId) ? guildId : null;
  }
};
function appendChild(ret, child) {
  if (Array.isArray(ret)) return [...ret, child];
  if (ret && ret.props) {
    const children = ret.props.children;
    return children == null ? React.cloneElement(ret, void 0, child) : React.cloneElement(ret, void 0, children, child);
  }
  return ret;
}

// src/ui/styles.js
var STYLES = `
.mollu-translation__anchor {
    display: block;
    height: 0;
    margin: 0;
    padding: 0;
    pointer-events: none;
    overflow-anchor: none;
}
.mollu-translation {
    overflow-anchor: none;
    contain: layout style;
    margin-top: 2px;
    color: var(--text-muted, #949ba4);
    font-size: 0.95rem;
    line-height: 1.375;
    white-space: pre-wrap;
    word-break: break-word;
}
.mollu-translation__badge {
    display: inline-block;
    margin-right: 6px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    vertical-align: 1px;
    color: var(--text-muted, #949ba4);
    background: var(--background-modifier-accent, rgba(148, 155, 164, 0.16));
}
.mollu-translation__emoji {
    width: 1.375em;
    height: 1.375em;
    margin: 0 1px;
    object-fit: contain;
    vertical-align: -0.3em;
}
.mollu-translation__mention {
    padding: 0 2px;
    border-radius: 3px;
    color: var(--mention-foreground, #c9cdfb);
    background: var(--mention-background, rgba(88, 101, 242, 0.24));
}
.mollu-translation__code {
    padding: 0 3px;
    border-radius: 3px;
    font-family: var(--font-code, monospace);
    font-size: 0.85em;
    white-space: pre-wrap;
    background: var(--background-secondary, rgba(0, 0, 0, 0.2));
}
.mollu-translation__trigger {
    display: inline-block;
    margin-top: 2px;
    padding: 0;
    border: none;
    background: none;
    font-size: 0.8rem;
    font-family: inherit;
    line-height: 1.2;
    color: var(--text-muted, #949ba4);
    opacity: 0.75;
    cursor: pointer;
}
.mollu-translation__trigger:hover {
    opacity: 1;
    text-decoration: underline;
}
.mollu-translation--pending {
    opacity: 0.6;
    font-style: italic;
}
.mollu-translation--error {
    display: block;
    padding: 0;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 0.95rem;
    text-align: left;
    color: var(--text-danger, #f23f43);
    cursor: pointer;
}
.mollu-translation--error:hover {
    text-decoration: underline;
}
`;

// src/index.js
var Mollu = class {
  constructor(meta) {
    this._meta = meta;
    this._settings = new Settings();
    this._detector = new LanguageDetector(this._settings);
    this._translator = new Translator({
      settings: this._settings,
      onError: (err) => this._notifyError(err)
    });
    this._patch = null;
    this._lastErrorToast = 0;
  }
  getName() {
    return this._meta?.name ?? NAME;
  }
  getSettingsPanel() {
    return this._settings.buildPanel();
  }
  start() {
    try {
      BdApi.DOM.addStyle(NAME, STYLES);
      this._translator.start();
      if (!hasNativeFetch()) {
        this._toast(t("toast.outdatedBd"), "warning");
      }
      const target = findMessageContent();
      if (!target) {
        logger.error("MessageContent not found; Discord's internals may have changed");
        this._toast(t("toast.noMessageContent"), "error");
        return;
      }
      this._patch = new MessagePatch({
        target,
        settings: this._settings,
        translator: this._translator,
        languageDetector: this._detector,
        stores: createStores()
      });
      this._patch.install();
      if (!this._settings.current.apiKey) {
        this._toast(t("toast.needApiKey"), "info");
      }
      if (this._settings.guildIdSet.size === 0) {
        this._toast(t("toast.needGuilds"), "info");
      }
      const { provider, targetLanguage, autoTranslate } = this._settings.current;
      logger.info(
        `started · provider=${provider} target=${targetLanguage} mode=${autoTranslate ? "auto" : "manual"} servers=${this._settings.guildIdSet.size}`
      );
    } catch (e) {
      logger.error("start failed", e);
    }
  }
  stop() {
    try {
      this._patch?.remove();
    } catch (e) {
      logger.error("unpatch failed", e);
    }
    BdApi.Patcher.unpatchAll(NAME);
    BdApi.DOM.removeStyle(NAME);
    disconnectVisibility();
    this._translator.stop();
    this._patch = null;
    logger.info("stopped");
  }
  _notifyError(err) {
    if (!this._settings.current.showErrors) return;
    const now = Date.now();
    if (now - this._lastErrorToast < ERROR_TOAST_COOLDOWN_MS) return;
    this._lastErrorToast = now;
    this._toast(t("toast.failed", { message: err && err.message || "unknown" }), "error");
  }
  _toast(message, type) {
    try {
      BdApi.UI.showToast(`${NAME}: ${message}`, { type, timeout: 6e3, forceShow: true });
    } catch {
    }
  }
};

if (module.exports && module.exports.default) module.exports = module.exports.default;

