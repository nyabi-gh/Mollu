// UI 문자열. 이 플러그인은 한국어 사용자만 쓰는 게 아니므로 패널과 토스트는
// 번역해 두고, 로그 메시지는 진단용이라 영어로 통일한다.

const STRINGS = {
    en: {
        "block.pending": "Translating…",
        "block.error": "Translation failed",
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

        "settings.provider": "Translation backend",
        "settings.provider.note":
            "Switching fills in that backend's model and base URL. Each backend's API key is remembered separately. The fields below only refresh after you close and reopen this panel.",
        "settings.apiKey": "{provider} API key",
        "settings.apiKey.note":
            "The saved key is never shown. Type a new one to replace it, leave it blank to keep it, or type {clear} to erase it.",
        "settings.apiKey.saved": "saved · {fingerprint}",
        "settings.model": "Model",
        "settings.baseUrl": "API base URL",
        "settings.baseUrl.note": "OpenAI-compatible endpoint. Filled in when you pick a backend.",
        "settings.guildIds": "Target server ids",
        "settings.guildIds.note":
            "Separated by commas or spaces. Turn on Developer Mode, then right-click a server icon → Copy Server ID.",
        "settings.targetLanguage": "Translate into",
        "settings.targetLanguage.note":
            "Messages not already in this language are translated into it. Languages written in the Latin alphabet cannot be told apart before sending, so every message is sent once and skipped if it comes back unchanged.",
        "settings.uiLanguage": "Plugin language",
        "settings.uiLanguage.note": "Language of this panel and the plugin's own messages.",
        "settings.threshold": "Treat as already translated above",
        "settings.threshold.note":
            "A message is skipped when this share of its letters is already in the target language's script.",
        "settings.maxChars": "Maximum characters to translate",
        "settings.maxChars.note": "Longer messages are skipped.",
        "settings.maxConcurrent": "Concurrent requests",
        "settings.autoTranslate": "Automatic translation",
        "settings.autoTranslate.note":
            "Off is manual mode: a Translate button appears under each message and only what you press is sent. Use it to save tokens or stay inside a free-tier quota.",
        "settings.translateBots": "Translate bot messages",
        "settings.translateOwnMessages": "Translate my own messages",
        "settings.showPending": "Show while translating",
        "settings.showErrors": "Show translation failures",

        "keySource.deepseek": "Get one at platform.deepseek.com → API Keys.",
        "keySource.gemini": "Get one at aistudio.google.com → Get API key. It has a free tier.",
        "modelHint.deepseek": "e.g. deepseek-v4-flash (cheap), deepseek-v4-pro (higher quality)",
        "modelHint.gemini":
            "e.g. gemini-3.1-flash-lite (default, ~1s). gemma-4-* reasons and cannot be told not to, so it takes 9-12s and returns its reasoning instead of a translation.",
        "language.auto": "Match Discord",
    },
    ko: {
        "block.pending": "번역 중…",
        "block.error": "번역 실패",
        "block.trigger": "번역",

        "toast.outdatedBd":
            "BetterDiscord가 오래되어 API 요청이 차단될 수 있습니다. 최신 버전으로 업데이트하세요.",
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

        "settings.provider": "번역 백엔드",
        "settings.provider.note":
            "바꾸면 모델·URL 이 그 백엔드의 기본값으로 맞춰집니다. 각 백엔드의 API 키는 따로 기억합니다. 아래 칸의 표시는 설정 창을 닫았다 열어야 갱신됩니다.",
        "settings.apiKey": "{provider} API 키",
        "settings.apiKey.note":
            "저장된 키는 표시되지 않습니다. 새 키를 입력하면 교체되고, 비워 두면 유지됩니다. 지우려면 {clear} 를 입력하세요.",
        "settings.apiKey.saved": "저장됨 · {fingerprint}",
        "settings.model": "모델 이름",
        "settings.baseUrl": "API Base URL",
        "settings.baseUrl.note": "OpenAI 호환 엔드포인트. 백엔드를 고르면 자동으로 채워집니다.",
        "settings.guildIds": "대상 서버 ID",
        "settings.guildIds.note":
            "쉼표 또는 공백으로 구분. 개발자 모드를 켠 뒤 서버 아이콘 우클릭 → 서버 ID 복사.",
        "settings.targetLanguage": "번역할 언어",
        "settings.targetLanguage.note":
            "이 언어가 아닌 메시지를 이 언어로 번역합니다. 라틴 문자를 쓰는 언어끼리는 보내기 전에 구분할 수 없어, 메시지마다 한 번은 전송한 뒤 원문 그대로 돌아오면 표시하지 않습니다.",
        "settings.uiLanguage": "플러그인 언어",
        "settings.uiLanguage.note": "이 설정 패널과 플러그인 표시 문구의 언어입니다.",
        "settings.threshold": "번역 생략 기준 비율",
        "settings.threshold.note": "메시지의 글자 중 이 비율 이상이 대상 언어 문자면 번역하지 않습니다.",
        "settings.maxChars": "번역할 최대 글자 수",
        "settings.maxChars.note": "이보다 긴 메시지는 건너뜁니다.",
        "settings.maxConcurrent": "동시 번역 요청 수",
        "settings.autoTranslate": "자동 번역",
        "settings.autoTranslate.note":
            "끄면 수동 모드가 됩니다. 메시지 아래에 번역 버튼만 나오고, 누른 것만 전송합니다. 토큰을 아끼거나 무료 티어 한도를 지킬 때 쓰세요.",
        "settings.translateBots": "봇 메시지도 번역",
        "settings.translateOwnMessages": "내 메시지도 번역",
        "settings.showPending": "번역 중 표시",
        "settings.showErrors": "번역 실패 시 표시",

        "keySource.deepseek": "platform.deepseek.com → API Keys 에서 발급합니다.",
        "keySource.gemini": "aistudio.google.com → Get API key 에서 발급합니다. 무료 티어가 있습니다.",
        "modelHint.deepseek": "예: deepseek-v4-flash(저렴), deepseek-v4-pro(고품질)",
        "modelHint.gemini":
            "예: gemini-3.1-flash-lite(기본·약 1초). gemma-4-* 는 추론을 끌 수 없어 9~12초가 걸리고 번역문 대신 추론이 나옵니다.",
        "language.auto": "Discord 설정에 맞춤",
    },
};

export const UI_LANGUAGES = ["en", "ko"];

let active = "en";

// "auto" 는 Discord(=브라우저) 로캘을 따른다. 지원하지 않는 로캘이면 영어.
export function setLocale(preference) {
    const wanted = preference === "auto" || !preference ? detect() : preference;
    active = STRINGS[wanted] ? wanted : "en";
}

export function getLocale() {
    return active;
}

export function t(key, vars) {
    const table = STRINGS[active] || STRINGS.en;
    const template = table[key] ?? STRINGS.en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
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
