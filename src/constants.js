// meta.json 의 name 과 일치해야 한다. BdApi 호출자 id, 데이터 저장소 이름,
// 주입 <style> id 로 함께 쓰인다.
export const NAME = "Mollu";

// 이름 변경 전에 쓰던 저장소 이름. 여기서 한 번 읽어 오지 않으면 이름을 바꾸는
// 순간 API 키와 대상 서버 설정이 조용히 사라진다.
export const LEGACY_NAMES = ["KoreanAutoTranslator"];

export const DEFAULT_SETTINGS = Object.freeze({
    provider: "deepseek",
    apiKey: "",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    // 켜면 guildIds 를 무시하고 참여 중인 모든 서버를 대상으로 삼는다.
    allGuilds: false,
    guildIds: "",
    // 번역 결과 언어. languages.js 의 code.
    targetLanguage: "ko",
    // "auto" 면 Discord 로캘을 따른다.
    uiLanguage: "auto",
    // 프로바이더별 {apiKey, model, baseUrl}. DEFAULT_SETTINGS 는 인스턴스 사이에
    // 공유되므로, 제자리 수정이 조용히 새어 나가지 않도록 얼려 둔다.
    profiles: Object.freeze({}),
    skipThreshold: 30,
    maxChars: 3000,
    maxConcurrent: 3,
    autoTranslate: true,
    // 전역 단축키. BD 의 keybind 입력이 쓰는 event.key 이름 배열이고, 비우면
    // 단축키를 쓰지 않는다. DEFAULT_SETTINGS 는 공유되므로 함께 얼려 둔다.
    hotkey: Object.freeze(["Control", "Shift", "T"]),
    // 내가 보내는 메시지를 번역해서 내보낸다. 남에게 나가는 글을 고쳐 쓰므로
    // 기본은 꺼짐이고, 대상 서버 안에서만 동작한다.
    translateOutgoing: false,
    outgoingLanguage: "en",
    outgoingHotkey: Object.freeze(["Control", "Shift", "O"]),
    translateBots: true,
    translateOwnMessages: false,
    showPending: true,
    showErrors: false,
    // 켜면 번역하지 않은 메시지마다 그 사유를 콘솔에 남긴다.
    debugLog: false,
});

export const CACHE_LIMIT = 3000;

// stop() 만 믿으면 강제 종료나 크래시에서 그 세션의 번역을 통째로 잃고 다시
// 결제한다. 쓰기가 몰릴 때 저장이 폭주하지 않도록 이만큼 모아서 내보낸다.
export const CACHE_SAVE_DEBOUNCE_MS = 10000;

// 캐시 키에는 대상 언어가 들어간다. 언어를 바꾸면 옛 항목은 자연히 무효가 된다.
// -v2 이전 항목은 토큰이 치환된 번역문을 저장해서 다른 메시지의 멘션이나 링크가
// 표시될 수 있었으므로 이관하지 않고 버린다.
export const CACHE_KEY = "cache-v3";
export const LEGACY_CACHE_KEYS = ["cache", "cache-v2"];

export const ERROR_TOAST_COOLDOWN_MS = 15000;

// 진단 로그는 메시지가 렌더될 때마다 같은 판정을 반복하므로, 남긴 사유를 기억해
// 한 번씩만 찍는다. 이 수를 넘으면 통째로 비운다.
export const TRACE_LIMIT = 500;

// BdApi.Net.fetch 자체 기본값은 8초.
export const REQUEST_TIMEOUT_MS = 30000;

// 한도는 계정 단위라 429 가 나면 거부된 요청뿐 아니라 전체를 멈춘다. 나머지를
// 곧바로 재시도해 봐야 할당량만 더 태운다. 응답이 대기 시간을 알려 주지 않을 때 사용.
export const RATE_LIMIT_PAUSE_MS = 20000;
export const MAX_RATE_LIMIT_PAUSE_MS = 120000;
export const MAX_RATE_LIMIT_RETRIES = 3;

// 네트워크 오류나 5xx 처럼 다시 하면 될 법한 실패는 사용자에게 보이기 전에
// 이만큼 다시 시도한다. 400/401 같은 설정 오류는 재시도해도 같은 답이라 제외.
export const TRANSIENT_RETRIES = 2;
export const TRANSIENT_RETRY_DELAY_MS = 1500;

// 이 시간 동안 같은 텍스트를 재요청하지 않는다. 없으면 메시지가 다시 렌더될
// 때마다 요청이 나간다.
export const FAILURE_BACKOFF_MS = 60000;
export const FAILURE_RECORD_LIMIT = 500;

// 실제 예산은 원문 길이에서 계산하고 여기서 상한만 건다. 프롬프트 인젝션 같은
// 폭주는 막되 정상적으로 긴 번역문은 자르지 않기 위함.
export const MAX_OUTPUT_TOKENS = 4096;
export const OUTPUT_TOKEN_HEADROOM = 256;
