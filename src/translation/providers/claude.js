import { postJson, normalizeBaseUrl, configError } from "../../lib/net.js";
import { MAX_OUTPUT_TOKENS } from "../../constants.js";
import { systemPrompt } from "../prompt.js";
import { getLanguage } from "../../languages.js";
import { logger } from "../../lib/logger.js";
import { t } from "../../i18n.js";

export const id = "claude";
export const label = "Anthropic Claude";
export const keyHint = "sk-ant-...";
export const models = Object.freeze(["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]);
export const defaults = Object.freeze({ model: models[0], baseUrl: "https://api.anthropic.com" });

const API_VERSION = "2023-06-01";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export async function translate({ text, settings, signal }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw configError(t("error.noApiKey"));

    const root = normalizeBaseUrl(settings.baseUrl, defaults.baseUrl).replace(/\/v1$/, "");
    const model = String(settings.model || defaults.model).trim();

    // Only tokens actually produced are billed, so a generous cap costs nothing.
    const body = {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt(getLanguage(settings.targetLanguage).name),
        messages: [{ role: "user", content: text }],
    };
    // The newer models think by default and take no temperature; low effort keeps a
    // translation from turning into a deliberation. Haiku 4.5 has no effort control at all.
    if (!/^claude-haiku/i.test(model)) body.output_config = { effort: "low" };

    const headers = {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
    };
    // Opus 5 can decline on its safety classifiers; the API then retries on the model it
    // recommends for that kind of refusal instead of returning nothing.
    if (model === "claude-opus-5") {
        body.fallbacks = "default";
        headers["anthropic-beta"] = FALLBACK_BETA;
    }

    const json = await send(`${root}/v1/messages`, { headers, signal, body });

    if (json?.stop_reason === "refusal") throw new Error(t("error.refused"));
    const output = (Array.isArray(json?.content) ? json.content : [])
        .filter((block) => block?.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("")
        .trim();
    if (!output) {
        logger.warn(
            `${model} gave no answer (stop_reason ${json?.stop_reason ?? "none"}, ` +
                `usage ${JSON.stringify(json?.usage ?? null)})`,
        );
        throw new Error(
            t(json?.stop_reason === "max_tokens" ? "error.reasoningOnly" : "error.emptyResponse"),
        );
    }
    return output;
}

// An older model typed in by hand can refuse the effort setting; ask again without it.
async function send(url, { headers, signal, body }) {
    try {
        return await postJson(url, { headers, signal, body });
    } catch (err) {
        if (!(
            err?.status === 400 &&
            body.output_config &&
            /effort|output_config/i.test(String(err.body || ""))
        )) {
            throw err;
        }
        logger.warn(`${body.model} rejected the effort setting; asking again without it`);
        const retry = { ...body };
        delete retry.output_config;
        return postJson(url, { headers, signal, body: retry });
    }
}
