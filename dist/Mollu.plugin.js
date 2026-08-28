/**
 * @name Mollu
 * @author nyattic
 * @version 1.0.0
 * @description 지정한 서버에서 한국어가 아닌 메시지를 AI API로 자동 번역해 원문 아래에 표시합니다.
 * @source https://github.com/nyattic/mollu
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
  // Comma/space separated guild ids. Translation only runs in these servers.
  guildIds: "",
  // A message is treated as Korean (and skipped) when its share of Hangul
  // letters is at least this percentage.
  koreanThreshold: 30,
  // Messages longer than this are skipped to bound cost.
  maxChars: 3e3,
  maxConcurrent: 3,
  translateBots: true,
  translateOwnMessages: false,
  showPending: true,
  showErrors: false
});
var CACHE_LIMIT = 3e3;
var CACHE_KEY = "cache-v2";
var LEGACY_CACHE_KEYS = ["cache"];
var ERROR_TOAST_COOLDOWN_MS = 15e3;
var REQUEST_TIMEOUT_MS = 3e4;
var FAILURE_BACKOFF_MS = 6e4;
var FAILURE_RECORD_LIMIT = 500;
var MAX_OUTPUT_TOKENS = 4096;
var OUTPUT_TOKEN_HEADROOM = 256;

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

// src/settings.js
var Settings = class {
  constructor() {
    const stored = safeLoad();
    this._values = normalize({ ...DEFAULT_SETTINGS, ...stored });
    this._guildIdSet = parseGuildIds(this._values.guildIds);
    this._listeners = /* @__PURE__ */ new Set();
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
  _set(id2, value) {
    const next = coerce(id2, value, this._values[id2]);
    if (next === KEEP || next === this._values[id2]) return;
    this._values[id2] = next;
    if (id2 === "guildIds") this._guildIdSet = parseGuildIds(next);
    this._persist();
    for (const listener of this._listeners) {
      try {
        listener(id2, next);
      } catch {
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
          type: "text",
          id: "apiKey",
          name: "DeepSeek API 키",
          // The stored key is never rendered: BetterDiscord's text
          // input has no masked mode, and this panel is a real
          // exposure risk while screen sharing.
          note: v.apiKey ? `저장된 키는 표시되지 않습니다. 새 키를 입력하면 교체되고, 비워 두면 유지됩니다. 지우려면 ${CLEAR_TOKEN} 를 입력하세요.` : "platform.deepseek.com → API Keys 에서 발급합니다.",
          placeholder: v.apiKey ? `저장됨 · ${fingerprint(v.apiKey)}` : "sk-...",
          value: ""
        },
        {
          type: "text",
          id: "model",
          name: "모델 이름",
          note: "예: deepseek-v4-flash(기본·저렴), deepseek-v4-pro(고품질)",
          value: v.model
        },
        {
          type: "text",
          id: "baseUrl",
          name: "API Base URL",
          note: "OpenAI 호환 엔드포인트. 보통 그대로 둡니다.",
          value: v.baseUrl
        },
        {
          type: "text",
          id: "guildIds",
          name: "대상 서버 ID",
          note: "쉼표 또는 공백으로 구분. 개발자 모드를 켠 뒤 서버 아이콘 우클릭 → 서버 ID 복사.",
          value: v.guildIds
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
          markers: [10, 30, 50, 70, 90]
        },
        {
          type: "number",
          id: "maxChars",
          name: "번역할 최대 글자 수",
          note: "이보다 긴 메시지는 건너뜁니다.",
          value: v.maxChars,
          min: 200,
          max: 8e3,
          step: 100
        },
        {
          type: "number",
          id: "maxConcurrent",
          name: "동시 번역 요청 수",
          value: v.maxConcurrent,
          min: 1,
          max: 10
        },
        {
          type: "switch",
          id: "translateBots",
          name: "봇 메시지도 번역",
          value: v.translateBots
        },
        {
          type: "switch",
          id: "translateOwnMessages",
          name: "내 메시지도 번역",
          value: v.translateOwnMessages
        },
        {
          type: "switch",
          id: "showPending",
          name: "번역 중 표시",
          value: v.showPending
        },
        {
          type: "switch",
          id: "showErrors",
          name: "번역 실패 시 표시",
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
var CLEAR_TOKEN = "-";
var KEEP = /* @__PURE__ */ Symbol("keep");
function normalize(values) {
  for (const field of TRIMMED_FIELDS) {
    if (typeof values[field] === "string") values[field] = values[field].trim();
  }
  return values;
}
function coerce(id2, value, previous) {
  if (!TRIMMED_FIELDS.has(id2) || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (id2 !== "apiKey") return trimmed;
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
    String(raw || "").split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{15,25}$/.test(s))
  );
}

// src/translation/tokenizer.js
var PATTERNS = [
  // A literal 【n】 already in the message. Masking it first keeps it from
  // colliding with the placeholders we generate below.
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
  /**
   * @param {() => Promise<any>} task
   * @param {() => boolean} [shouldRun] checked when the task reaches the front
   *   of the queue; a task whose caller has lost interest (a message scrolled
   *   out of view) is dropped instead of occupying a slot.
   */
  run(task, shouldRun) {
    return new Promise((resolve, reject) => {
      this._pending.push({ task, resolve, reject, shouldRun });
      this._drain();
    });
  }
  /**
   * Drops queued work. Waiting callers are rejected rather than left hanging —
   * a never-settled promise would strand the UI on "번역 중…" forever.
   */
  clear() {
    const dropped = this._pending;
    this._pending = [];
    for (const { reject } of dropped) {
      const err = new Error("취소됨");
      err.name = "AbortError";
      reject(err);
    }
  }
  _drain() {
    while (this._active < Math.max(1, this._limit() | 0) && this._pending.length > 0) {
      const { task, resolve, reject, shouldRun } = this._pending.shift();
      if (shouldRun && !shouldRun()) {
        const err = new Error("건너뜀");
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

// src/translation/providers/deepseek.js
var deepseek_exports = {};
__export(deepseek_exports, {
  id: () => id,
  label: () => label,
  translate: () => translate
});

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
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
function normalizeBaseUrl(raw, fallback = "") {
  const input = String(raw ?? "").trim() || String(fallback);
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`API Base URL이 올바르지 않습니다: ${input}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`지원하지 않는 프로토콜입니다: ${url.protocol}`);
  }
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error("http:// 주소로는 API 키가 평문으로 전송됩니다. https:// 를 사용하세요.");
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
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
    // The `timeout` option is BdApi.Net.fetch's; standard fetch ignores it,
    // so the fallback path gets the same deadline through its signal.
    signal: hasNativeFetch() ? signal : withDeadline(signal, timeout),
    timeout
  });
  const text = await res.text().catch(() => "");
  const ok = typeof res.ok === "boolean" ? res.ok : res.status >= 200 && res.status < 300;
  if (!ok) {
    if (text) logger.warn(`HTTP ${res.status} body:`, text.slice(0, 500));
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
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
var SYSTEM_PROMPT = [
  "You are a translation engine embedded in a Discord chat client.",
  "Translate the user's message into natural, colloquial Korean (한국어).",
  "",
  "Rules:",
  "- Output ONLY the translated text. No explanations, no notes, no surrounding quotes, no romanization.",
  "- Preserve Markdown (*, _, ~~, `, #, >, lists), emoji, line breaks and spacing exactly as in the source.",
  "- Tokens shaped like 【0】 or 【1】 are placeholders. Copy each one verbatim, keep it in the same position, and never translate or renumber it.",
  "- Keep the register of the source: casual stays casual, formal stays formal. Render internet slang naturally in Korean.",
  "- If the message is already written in Korean, return it unchanged."
].join("\n");

// src/translation/providers/deepseek.js
var id = "deepseek";
var label = "DeepSeek";
var DEFAULT_BASE_URL = "https://api.deepseek.com";
var DEFAULT_MODEL = "deepseek-v4-flash";
async function translate({ text, settings, signal }) {
  const apiKey = String(settings.apiKey || "").trim();
  if (!apiKey) throw new Error("API 키가 설정되지 않았습니다");
  const base = normalizeBaseUrl(settings.baseUrl, DEFAULT_BASE_URL);
  const body = {
    model: settings.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text }
    ],
    temperature: 0.2,
    stream: false,
    max_tokens: outputBudget(text)
  };
  if (isDeepSeekHost(base)) body.thinking = { type: "disabled" };
  const json = await postJson(`${base}/chat/completions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
    body
  });
  const output = json?.choices?.[0]?.message?.content;
  if (typeof output !== "string" || !output.trim()) throw new Error("빈 응답");
  return output.trim();
}
function outputBudget(text) {
  return Math.min(MAX_OUTPUT_TOKENS, text.length + OUTPUT_TOKEN_HEADROOM);
}
function isDeepSeekHost(base) {
  try {
    return /(^|\.)deepseek\.com$/i.test(new URL(base).hostname);
  } catch {
    return false;
  }
}

// src/translation/providers/index.js
var PROVIDERS = {
  [id]: deepseek_exports
};
var DEFAULT_PROVIDER = id;
function getProvider(providerId) {
  return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
}

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
  }
  start() {
    this._cache.load();
  }
  stop() {
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
  /**
   * Synchronous cache lookup for the first render.
   * @returns {TranslationResult}
   */
  peek(text) {
    const { masked, tokens } = mask(text);
    if (this._cache.has(masked)) return this._restore(this._cache.get(masked), tokens);
    if (text.length > this._settings.current.maxChars) return skip();
    return { status: "unknown" };
  }
  /**
   * @param {string} text
   * @param {{onStart?: () => void, shouldRun?: () => boolean}} [hooks]
   *   `onStart` fires when the request actually leaves the queue, so the UI
   *   can show "번역 중" for in-flight work only. `shouldRun` is re-checked at
   *   that moment and drops work whose message has scrolled away.
   * @returns {Promise<TranslationResult>} never rejects.
   */
  translate(text, hooks = {}) {
    const { masked, tokens } = mask(text);
    if (this._cache.has(masked)) {
      return Promise.resolve(this._restore(this._cache.get(masked), tokens));
    }
    if (text.length > this._settings.current.maxChars) return Promise.resolve(skip());
    if (this._isBackingOff(masked)) {
      return Promise.resolve(error("최근 실패로 재시도를 미루는 중"));
    }
    let job = this._inflight.get(masked);
    if (!job) {
      job = this._queue.run(() => {
        if (hooks.onStart) hooks.onStart();
        return this._callProvider(masked);
      }, hooks.shouldRun).then(
        (raw) => this._resolveSuccess(masked, raw),
        (err) => this._resolveFailure(masked, err)
      ).finally(() => this._inflight.delete(masked));
      this._inflight.set(masked, job);
    }
    return job.then(
      (outcome) => outcome.status === "done" ? this._restore(outcome.masked, tokens) : outcome
    );
  }
  /** Turn a masked cache/job value into a result for one specific message. */
  _restore(maskedValue, tokens) {
    if (typeof maskedValue !== "string") return skip();
    const segments = unmaskSegments(maskedValue, tokens);
    const text = segments.map((segment) => segment.value).join("").trim();
    return text ? done(text, trimEdges(segments)) : skip();
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
  /** @returns {{status: "done", masked: string} | {status: "skip"}} */
  _resolveSuccess(maskedKey, raw) {
    const maskedTranslation = stripWrappingQuotes(raw, maskedKey).trim();
    if (!maskedTranslation || normalize2(maskedTranslation) === normalize2(maskedKey)) {
      this._cache.set(maskedKey, null);
      return skip();
    }
    this._cache.set(maskedKey, maskedTranslation);
    return { status: "done", masked: maskedTranslation };
  }
  _resolveFailure(maskedKey, err) {
    const message = err && err.message || String(err);
    if (err && err.name === "AbortError") return error(message);
    if (err && err.name === "SkippedError") return { status: "unknown" };
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
var HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿ﾠ-ￜ]/;
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
    let hangul = 0;
    for (const ch of letters) {
      if (HANGUL.test(ch)) hangul += 1;
    }
    const ratio = hangul / letters.length;
    return ratio < this._settings.current.koreanThreshold / 100;
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
    // The three lookups below resolve mentions for display. `null` means
    // "unknown", and the caller falls back to the raw token.
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
    const [, animated, name, id2] = emoji;
    return React.createElement("img", {
      key,
      className: "mollu-translation__emoji",
      src: `${EMOJI_CDN}/${id2}.${animated ? "gif" : "webp"}?size=44&quality=lossless`,
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
  const { showPending, showErrors } = useDisplaySettings(settings);
  const [result, setResult] = React.useState(() => initialResult(translator, text));
  React.useEffect(() => {
    let alive = true;
    let visible = false;
    let dwell = null;
    let running = false;
    const known = translator.peek(text);
    if (known.status === "done" || known.status === "skip") {
      setResult(known);
      return void 0;
    }
    setResult({ status: "idle" });
    const run = () => {
      if (!alive || running) return;
      running = true;
      translator.translate(text, {
        // Only work that has actually left the queue shows "번역 중".
        // Flipping every queued message at once would grow hundreds
        // of messages by a line at the same time while scrolling.
        onStart: () => {
          if (alive) setResult({ status: "pending" });
        },
        shouldRun: () => alive && visible
      }).then((res) => {
        if (!alive) return;
        running = false;
        setResult(res.status === "unknown" ? { status: "idle" } : res);
      });
    };
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
  }, [text]);
  const status = result && result.status;
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", {
      ref: anchorRef,
      className: "mollu-translation__anchor",
      "aria-hidden": "true"
    }),
    renderBody(status, result, { showPending, showErrors, stores, guildId })
  );
}
function renderBody(status, result, { showPending, showErrors, stores, guildId }) {
  if (!status || status === "idle" || status === "unknown" || status === "skip") return null;
  if (status === "pending") {
    return showPending ? React.createElement(
      "div",
      { className: "mollu-translation mollu-translation--pending" },
      "번역 중…"
    ) : null;
  }
  if (status === "error") {
    return showErrors ? React.createElement(
      "div",
      { className: "mollu-translation mollu-translation--error" },
      "번역 실패"
    ) : null;
  }
  return React.createElement(
    "div",
    { className: "mollu-translation" },
    React.createElement("span", { className: "mollu-translation__badge" }, "KO"),
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
    const unsubscribe = settings.onChange((id2) => {
      if (id2 === "showPending" || id2 === "showErrors") setDisplay(pickDisplay(settings));
    });
    return () => {
      unsubscribe();
    };
  }, [settings]);
  return display;
}
function pickDisplay(settings) {
  const { showPending, showErrors } = settings.current;
  return { showPending, showErrors };
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
  /** @returns {string|null} the target guild this message belongs to, if any */
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
    /* A translation appears after the message is laid out. Excluding it from
       scroll anchoring lets the browser hold on to real message content
       instead, so arriving translations do not shove the viewport around. */
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
.mollu-translation--pending {
    opacity: 0.6;
    font-style: italic;
}
.mollu-translation--error {
    color: var(--text-danger, #f23f43);
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
        this._toast(
          "BetterDiscord가 오래되어 API 요청이 차단될 수 있습니다. 최신 버전으로 업데이트하세요.",
          "warning"
        );
      }
      const target = findMessageContent();
      if (!target) {
        logger.error(
          "MessageContent 모듈을 찾지 못했습니다. Discord 내부 구조가 바뀌었을 수 있습니다."
        );
        this._toast("메시지 컴포넌트를 찾지 못했습니다. 콘솔 로그를 확인하세요.", "error");
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
        this._toast("설정에서 DeepSeek API 키를 입력하세요.", "info");
      }
      if (this._settings.guildIdSet.size === 0) {
        this._toast("설정에서 대상 서버 ID를 추가하세요.", "info");
      }
      logger.info(`시작됨 · 대상 서버 ${this._settings.guildIdSet.size}개`);
    } catch (e) {
      logger.error("start 실패", e);
    }
  }
  stop() {
    try {
      this._patch?.remove();
    } catch (e) {
      logger.error("patch 해제 실패", e);
    }
    BdApi.Patcher.unpatchAll(NAME);
    BdApi.DOM.removeStyle(NAME);
    disconnectVisibility();
    this._translator.stop();
    this._patch = null;
    logger.info("중지됨");
  }
  _notifyError(err) {
    if (!this._settings.current.showErrors) return;
    const now = Date.now();
    if (now - this._lastErrorToast < ERROR_TOAST_COOLDOWN_MS) return;
    this._lastErrorToast = now;
    this._toast(`번역 실패 · ${err && err.message || "unknown"}`, "error");
  }
  _toast(message, type) {
    try {
      BdApi.UI.showToast(`${NAME}: ${message}`, { type, timeout: 6e3, forceShow: true });
    } catch {
    }
  }
};

if (module.exports && module.exports.default) module.exports = module.exports.default;

