import { postJson, normalizeBaseUrl, configError } from "../../lib/net.js";
import { getLanguage } from "../../languages.js";
import { t } from "../../i18n.js";

// DeepL 은 OpenAI 호환이 아니다. 채팅 모델이 아니므로 시스템 프롬프트도 모델
// 선택도 없고, 대신 placeholder 를 XML 태그로 감싸 번역에서 제외시킬 수 있다.
// LLM 에게 "그대로 두라" 고 부탁하는 것보다 확실하다.
export const id = "deepl";
export const label = "DeepL";
export const usesModel = false;

const FREE_BASE = "https://api-free.deepl.com";
const PRO_BASE = "https://api.deepl.com";

export const defaults = Object.freeze({ model: "", baseUrl: FREE_BASE });

// languages.js 의 코드 -> DeepL target_lang. EN 과 PT 는 지역 없이 쓰면 폐기 예정
// 취급이라 변종을 지정한다.
const TARGET_LANG = {
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
    hi: "HI",
};

export async function translate({ text, settings, signal }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw configError(t("error.noApiKey"));

    const targetLang = TARGET_LANG[settings.targetLanguage];
    if (!targetLang) {
        throw configError(
            t("error.unsupportedLanguage", {
                language: getLanguage(settings.targetLanguage).label,
                provider: label,
            }),
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
                preserve_formatting: true,
            },
        });
    } catch (err) {
        if (err && err.status === 456) throw configError(t("error.quotaExceeded"));
        throw err;
    }

    const output = json?.translations?.[0]?.text;
    if (typeof output !== "string" || !output.trim()) throw new Error(t("error.emptyResponse"));
    return restore(output).trim();
}

// 무료 키는 :fx 로 끝나고 전용 호스트만 받는다. 사용자가 기본값을 그대로 둔 채
// 다른 종류의 키를 넣은 경우를 바로잡는다.
function endpoint(apiKey, baseUrl) {
    const base = normalizeBaseUrl(baseUrl, FREE_BASE);
    const isFreeKey = apiKey.endsWith(":fx");
    if (!isFreeKey && base === FREE_BASE) return PRO_BASE;
    if (isFreeKey && base === PRO_BASE) return FREE_BASE;
    return base;
}

const PLACEHOLDER = /【(\d+)】/g;
const PROTECTED = /<x>(\d+)<\/x>/g;

// tag_handling: "xml" 은 본문을 XML 로 파싱하므로, 채팅에 흔한 < 나 & 가 그대로
// 있으면 깨진다. 먼저 이스케이프한 뒤 우리 태그를 넣는다.
function protect(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(PLACEHOLDER, (whole, index) => `<x>${index}</x>`);
}

function restore(text) {
    return text
        .replace(PROTECTED, (whole, index) => `【${index}】`)
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}
