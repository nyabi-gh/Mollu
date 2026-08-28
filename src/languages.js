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
