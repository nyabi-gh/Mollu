import { postJson, normalizeBaseUrl, configError } from "../../lib/net.js";
import { getLanguage } from "../../languages.js";
import { t } from "../../i18n.js";

export const id = "deepl";
export const label = "DeepL";
export const models = Object.freeze([]);

const FREE_BASE = "https://api-free.deepl.com";
const PRO_BASE = "https://api.deepl.com";

export const defaults = Object.freeze({ model: "", baseUrl: FREE_BASE });

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

function endpoint(apiKey, baseUrl) {
    const base = normalizeBaseUrl(baseUrl, FREE_BASE);
    const isFreeKey = apiKey.endsWith(":fx");
    if (!isFreeKey && base === FREE_BASE) return PRO_BASE;
    if (isFreeKey && base === PRO_BASE) return FREE_BASE;
    return base;
}

const PLACEHOLDER = /【(\d+)】/g;
const PROTECTED = /<x>(\d+)<\/x>/g;

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
