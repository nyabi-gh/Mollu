const STRINGS = {
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
        "toast.startFailed": "Could not start · {message}. Check the console log.",
        "toast.autoOn": "Automatic translation on",
        "toast.autoOff": "Automatic translation off · manual mode",
        "toast.outgoingOn": "Your messages will be sent in {language}",
        "toast.outgoingOff": "Your messages will be sent as you type them",
        "toast.outgoingFailed": "Sent untranslated · {message}",
        "toast.cacheCleared": "Cleared {count} cached translations",
        "toast.updated": "Updated to v{version}",
        "toast.upToDate": "Already up to date (v{version})",
        "toast.updateUnavailable": "No update source is configured for this build",
        "toast.updateFailed": "Could not check for updates · {message}",

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
        "settings.provider.note":
            "Switching fills in that backend's model and base URL. Each backend's API key is remembered separately.",
        "settings.apiKey": "{provider} API key",
        "settings.apiKey.note":
            "The saved key is never shown. Type a new one to replace it, leave it blank to keep it, or type {clear} to erase it.",
        "settings.apiKey.saved": "saved · {fingerprint}",
        "settings.model": "Model",
        "settings.baseUrl": "API base URL",
        "settings.baseUrl.note": "OpenAI-compatible endpoint. Filled in when you pick a backend.",
        "settings.allGuilds": "Translate in every server",
        "settings.allGuilds.note":
            "Ignores the list below and translates in every server you are in. Direct messages are left alone either way.",
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
        "settings.hotkey": "Automatic translation shortcut",
        "settings.hotkey.note":
            "Toggles automatic translation without opening this panel. Click the field and press the keys; clear it to use no shortcut.",
        "settings.translateOutgoing": "Translate the messages I send",
        "settings.translateOutgoing.note":
            "Replaces what you type with its translation before it is sent, in the target servers only. Other people never see the original, so leave this off unless you mean it.",
        "settings.outgoingLanguage": "Send my messages in",
        "settings.outgoingLanguage.note":
            "What you type is translated into this language. A message already written in it is sent untouched.",
        "settings.outgoingHotkey": "Outgoing translation shortcut",
        "settings.outgoingHotkey.note":
            "Toggles the switch above without opening this panel. Click the field and press the keys; clear it to use no shortcut.",
        "settings.translateBots": "Translate bot messages",
        "settings.translateOwnMessages": "Translate my own messages",
        "settings.showPending": "Show while translating",
        "settings.showErrors": "Show translation failures",
        "settings.advanced": "Advanced",
        "settings.autoUpdate": "Update automatically",
        "settings.autoUpdate.note":
            "Checks the repository in the plugin's metadata every few hours and installs a newer build. BetterDiscord reloads the plugin on its own once the file is replaced.",
        "settings.checkUpdate": "Updates",
        "settings.checkUpdate.note": "Check now, whether or not automatic updates are on.",
        "settings.checkUpdate.action": "Check",
        "settings.clearCache": "Translation cache",
        "settings.clearCache.note":
            "Translations are reused instead of being requested again. Clearing makes every message pay for a fresh request, so do it when a translation is wrong or you changed backends.",
        "settings.clearCache.action": "Clear",
        "clearCache.title": "Clear the translation cache?",
        "clearCache.body":
            "{count} saved translations will be deleted. Messages already on screen will be sent to the API again, at the usual cost.",
        "clearCache.confirm": "Clear",
        "clearCache.cancel": "Cancel",
        "settings.debugLog": "Log why a message was skipped",
        "settings.debugLog.note":
            "Writes the reason a message was not translated to the console (Ctrl+Shift+I). Turn this on when nothing appears and you cannot tell why.",

        "keySource.deepseek": "Get one at platform.deepseek.com → API Keys.",
        "keySource.gemini": "Get one at aistudio.google.com → Get API key. It has a free tier.",
        "keySource.deepl":
            "Get one at deepl.com/pro-api. The free plan allows 500,000 characters a month and needs no model.",
        "modelHint.deepseek": "e.g. deepseek-v4-flash (cheap), deepseek-v4-pro (higher quality)",
        "modelHint.gemini":
            "e.g. gemini-3.1-flash-lite (default, ~1s). gemma-4-* reasons and cannot be told not to, so it takes 9-12s and returns its reasoning instead of a translation.",
        "language.auto": "Match Discord",
    },
    ko: {
        "block.pending": "번역 중…",
        "block.error": "번역 실패",
        "block.errorTitle": "{message} — 클릭하면 다시 시도합니다",
        "error.retryLater": "재시도를 기다리는 중",
        "block.trigger": "번역",

        "toast.outdatedBd":
            "BetterDiscord가 오래되어 API 요청이 차단될 수 있습니다. 최신 버전으로 업데이트하세요.",
        "toast.noMessageContent": "메시지 컴포넌트를 찾지 못했습니다. 콘솔 로그를 확인하세요.",
        "toast.needApiKey": "설정에서 API 키를 입력하세요.",
        "toast.needGuilds": "설정에서 대상 서버 ID를 추가하세요.",
        "toast.failed": "번역 실패 · {message}",
        "toast.startFailed": "시작하지 못했습니다 · {message}. 콘솔 로그를 확인하세요.",
        "toast.autoOn": "자동 번역 켜짐",
        "toast.autoOff": "자동 번역 꺼짐 · 수동 모드",
        "toast.outgoingOn": "보내는 메시지를 {language} 로 번역합니다",
        "toast.outgoingOff": "보내는 메시지를 입력한 그대로 보냅니다",
        "toast.outgoingFailed": "번역하지 못해 원문 그대로 보냈습니다 · {message}",
        "toast.cacheCleared": "번역 캐시 {count}개를 비웠습니다",
        "toast.updated": "v{version} 로 업데이트했습니다",
        "toast.upToDate": "이미 최신 버전입니다 (v{version})",
        "toast.updateUnavailable": "이 빌드에는 업데이트 주소가 설정되어 있지 않습니다",
        "toast.updateFailed": "업데이트를 확인하지 못했습니다 · {message}",

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
        "settings.provider.note":
            "바꾸면 모델·URL 이 그 백엔드의 기본값으로 맞춰집니다. 각 백엔드의 API 키는 따로 기억합니다.",
        "settings.apiKey": "{provider} API 키",
        "settings.apiKey.note":
            "저장된 키는 표시되지 않습니다. 새 키를 입력하면 교체되고, 비워 두면 유지됩니다. 지우려면 {clear} 를 입력하세요.",
        "settings.apiKey.saved": "저장됨 · {fingerprint}",
        "settings.model": "모델 이름",
        "settings.baseUrl": "API Base URL",
        "settings.baseUrl.note": "OpenAI 호환 엔드포인트. 백엔드를 고르면 자동으로 채워집니다.",
        "settings.allGuilds": "모든 서버에서 번역",
        "settings.allGuilds.note":
            "아래 목록을 무시하고 참여 중인 모든 서버에서 번역합니다. 어느 쪽이든 DM 은 대상이 아닙니다.",
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
        "settings.hotkey": "자동 번역 단축키",
        "settings.hotkey.note":
            "설정 창을 열지 않고 자동 번역을 껐다 켭니다. 칸을 누른 뒤 원하는 키를 누르세요. 지우면 단축키를 쓰지 않습니다.",
        "settings.translateOutgoing": "보내는 메시지도 번역",
        "settings.translateOutgoing.note":
            "대상 서버에 한해, 입력한 글을 번역문으로 바꿔서 보냅니다. 상대는 원문을 볼 수 없으니 필요할 때만 켜세요.",
        "settings.outgoingLanguage": "보낼 때 번역할 언어",
        "settings.outgoingLanguage.note":
            "입력한 글을 이 언어로 번역해 보냅니다. 이미 이 언어로 쓴 메시지는 그대로 나갑니다.",
        "settings.outgoingHotkey": "보내는 메시지 번역 단축키",
        "settings.outgoingHotkey.note":
            "설정 창을 열지 않고 위 스위치를 껐다 켭니다. 칸을 누른 뒤 원하는 키를 누르세요. 지우면 쓰지 않습니다.",
        "settings.translateBots": "봇 메시지도 번역",
        "settings.translateOwnMessages": "내 메시지도 번역",
        "settings.showPending": "번역 중 표시",
        "settings.showErrors": "번역 실패 시 표시",
        "settings.advanced": "고급",
        "settings.autoUpdate": "자동 업데이트",
        "settings.autoUpdate.note":
            "플러그인 정보에 적힌 저장소를 몇 시간마다 확인해 더 새로운 빌드를 설치합니다. 파일이 바뀌면 BetterDiscord 가 알아서 다시 불러옵니다.",
        "settings.checkUpdate": "업데이트",
        "settings.checkUpdate.note": "자동 업데이트와 무관하게 지금 바로 확인합니다.",
        "settings.checkUpdate.action": "확인",
        "settings.clearCache": "번역 캐시",
        "settings.clearCache.note":
            "한 번 번역한 문장은 다시 요청하지 않고 캐시를 씁니다. 비우면 모든 메시지가 다시 요청되므로, 번역이 이상하거나 백엔드를 바꿨을 때 사용하세요.",
        "settings.clearCache.action": "비우기",
        "clearCache.title": "번역 캐시를 비울까요?",
        "clearCache.body":
            "저장된 번역 {count}개가 삭제됩니다. 화면에 있는 메시지는 다시 API 로 전송되고 그만큼 비용이 듭니다.",
        "clearCache.confirm": "비우기",
        "clearCache.cancel": "취소",
        "settings.debugLog": "번역하지 않은 사유 기록",
        "settings.debugLog.note":
            "메시지를 번역하지 않은 이유를 콘솔(Ctrl+Shift+I)에 남깁니다. 아무것도 안 나오는데 이유를 알 수 없을 때 켜세요.",

        "keySource.deepseek": "platform.deepseek.com → API Keys 에서 발급합니다.",
        "keySource.gemini": "aistudio.google.com → Get API key 에서 발급합니다. 무료 티어가 있습니다.",
        "keySource.deepl":
            "deepl.com/pro-api 에서 발급합니다. 무료 플랜은 월 50만 자이고 모델 선택이 없습니다.",
        "modelHint.deepseek": "예: deepseek-v4-flash(저렴), deepseek-v4-pro(고품질)",
        "modelHint.gemini":
            "예: gemini-3.1-flash-lite(기본·약 1초). gemma-4-* 는 추론을 끌 수 없어 9~12초가 걸리고 번역문 대신 추론이 나옵니다.",
        "language.auto": "Discord 설정에 맞춤",
    },
};

export const UI_LANGUAGES = ["en", "ko"];

let active = "en";

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
