// 번역 대상 언어. script 는 "이미 이 언어로 쓰인 메시지" 를 값싸게 걸러내는 데
// 쓴다. 라틴 문자를 쓰는 언어는 서로 구분할 수 없으므로 null 이고, 그 경우
// 판정을 모델에 맡긴다(프롬프트가 이미 대상 언어면 그대로 돌려주게 되어 있고,
// 원문과 같으면 표시하지 않는다).
const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿ﾠ-ￜ]/;
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾝ]/;
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;
const ARABIC = /[؀-ۿݐ-ݿ]/;
const THAI = /[฀-๿]/;
const DEVANAGARI = /[ऀ-ॿ]/;

export const LANGUAGES = [
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
        script: null,
    },
    {
        code: "pt-PT",
        label: "Português de Portugal",
        name: "European Portuguese",
        badge: "PT-PT",
        script: null,
    },
    { code: "ru", label: "Русский (Russian)", name: "Russian", script: CYRILLIC },
    { code: "vi", label: "Tiếng Việt (Vietnamese)", name: "Vietnamese", script: null },
    { code: "th", label: "ไทย (Thai)", name: "Thai", script: THAI },
    { code: "id", label: "Bahasa Indonesia", name: "Indonesian", script: null },
    { code: "ar", label: "العربية (Arabic)", name: "Arabic", script: ARABIC },
    { code: "hi", label: "हिन्दी (Hindi)", name: "Hindi", script: DEVANAGARI },
];

export const DEFAULT_LANGUAGE = "ko";

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));

export function getLanguage(code) {
    return BY_CODE.get(code) || BY_CODE.get(DEFAULT_LANGUAGE);
}

// 번역문 앞에 붙는 짧은 표식. 지역 변종은 코드가 길어 따로 지정한다.
export function badgeFor(code) {
    const language = getLanguage(code);
    return language.badge || language.code.toUpperCase();
}

export const LANGUAGE_OPTIONS = LANGUAGES.map((language) => ({
    label: language.label,
    value: language.code,
}));

function combine(...patterns) {
    return new RegExp(patterns.map((pattern) => pattern.source).join("|"));
}
