import { postJson, normalizeBaseUrl, configError } from "../../lib/net.js";
import { MAX_OUTPUT_TOKENS, OUTPUT_TOKEN_HEADROOM } from "../../constants.js";
import { systemPrompt } from "../prompt.js";
import { getLanguage } from "../../languages.js";
import { t } from "../../i18n.js";

export async function chatCompletion({ text, settings, signal, defaults, extend }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw configError(t("error.noApiKey"));

    const base = normalizeBaseUrl(settings.baseUrl, defaults.baseUrl);
    const model = String(settings.model || defaults.model).trim();

    const body = {
        model,
        messages: [
            { role: "system", content: systemPrompt(getLanguage(settings.targetLanguage).name) },
            { role: "user", content: text },
        ],
        temperature: 0.2,
        stream: false,
        max_tokens: outputBudget(text),
    };
    if (extend) extend(body, { base, model });

    const json = await postJson(`${base}/chat/completions`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
        body,
    });

    const choice = json?.choices?.[0];
    const output = stripReasoning(choice?.message?.content);
    if (!output) {
        throw new Error(
            t(choice?.finish_reason === "length" ? "error.reasoningOnly" : "error.emptyResponse"),
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
