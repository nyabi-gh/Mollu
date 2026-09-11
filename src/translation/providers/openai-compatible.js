import { postJson, normalizeBaseUrl, configError } from "../../lib/net.js";
import { MAX_OUTPUT_TOKENS, OUTPUT_TOKEN_HEADROOM, MAX_BODY_RETUNES } from "../../constants.js";
import { systemPrompt } from "../prompt.js";
import { getLanguage } from "../../languages.js";
import { logger } from "../../lib/logger.js";
import { t } from "../../i18n.js";

export async function chatCompletion({ text, settings, signal, defaults, extend }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw configError(t("error.noApiKey"));

    const base = normalizeBaseUrl(settings.baseUrl, defaults.baseUrl);
    const model = String(settings.model || defaults.model).trim();

    const target = getLanguage(settings.targetLanguage);
    const body = {
        model,
        messages: [
            { role: "system", content: systemPrompt(target.name) },
            { role: "user", content: text },
        ],
        temperature: 0.2,
        stream: false,
        max_tokens: outputBudget(text, target),
    };
    if (extend) extend(body, { base, model });

    const json = await send(`${base}/chat/completions`, { apiKey, signal, body });

    const choice = json?.choices?.[0];
    const output = stripReasoning(choice?.message?.content);
    if (!output) {
        throw new Error(
            t(choice?.finish_reason === "length" ? "error.reasoningOnly" : "error.emptyResponse"),
        );
    }
    return output;
}

// A model this build has never seen can refuse a field every request carries: OpenAI's
// reasoning models reject `temperature` and want `max_completion_tokens`. The 400 names
// the field, so drop it and ask again instead of losing the translation over it.
async function send(url, { apiKey, signal, body }) {
    let payload = body;
    for (let retunes = 0; ; retunes += 1) {
        try {
            return await postJson(url, {
                headers: { Authorization: `Bearer ${apiKey}` },
                signal,
                body: payload,
            });
        } catch (err) {
            const retuned = retunes < MAX_BODY_RETUNES ? withoutRejectedField(payload, err) : null;
            if (!retuned) throw err;
            logger.warn(`${payload.model} rejected "${retuned.field}"; asking again without it`);
            payload = retuned.body;
        }
    }
}

// Only fields that shape the answer are negotiable; anything else -- the model name above
// all -- is a real configuration problem and has to surface as one.
const TUNABLE = new Set(["temperature", "top_p", "max_tokens", "stream", "reasoning_effort", "thinking"]);

const RENAMED = new Map([["max_tokens", "max_completion_tokens"]]);

function withoutRejectedField(body, err) {
    if (!err || err.status !== 400) return null;

    const field = rejectedField(err.body);
    if (!TUNABLE.has(field) || !Object.hasOwn(body, field)) return null;

    const next = { ...body };
    delete next[field];

    const renamed = RENAMED.get(field);
    // The renamed budget counts reasoning against itself, so it gets the whole allowance.
    if (renamed && !Object.hasOwn(body, renamed)) next[renamed] = MAX_OUTPUT_TOKENS;
    return { body: next, field };
}

const UNSUPPORTED = /Unsupported (?:parameter|value): '([a-z_]+)'/i;

function rejectedField(body) {
    if (typeof body !== "string" || !body) return "";

    try {
        const param = JSON.parse(body)?.error?.param;
        if (typeof param === "string") return param;
    } catch {}

    const match = UNSUPPORTED.exec(body);
    return match ? match[1] : "";
}

const REASONING_PAIR = /<(thought|think)>[\s\S]*?<\/\1>/gi;
const REASONING_OPEN = /<(?:thought|think)>/i;
const REASONING_CLOSE = /<\/(?:thought|think)>/gi;

function stripReasoning(value) {
    if (typeof value !== "string") return "";

    let text = value.replace(REASONING_PAIR, "");

    // A closer whose opener the backend stripped leaves reasoning in front of the answer.
    const reasoningEnds = lastCloseEnd(text);
    if (reasoningEnds !== -1) text = text.slice(reasoningEnds);

    // An opener with no closer means the answer never arrived; guessing which half of the
    // leaked reasoning to show would put the model's notes on screen as the message.
    const unclosed = text.search(REASONING_OPEN);
    if (unclosed !== -1) text = text.slice(0, unclosed);

    return text.trim();
}

function lastCloseEnd(text) {
    REASONING_CLOSE.lastIndex = 0;
    let end = -1;
    for (let match = REASONING_CLOSE.exec(text); match; match = REASONING_CLOSE.exec(text)) {
        end = match.index + match[0].length;
    }
    return end;
}

// text.length counts the source's characters, not the answer's tokens.
function outputBudget(text, language) {
    const estimate = text.length * (language.tokensPerChar ?? 1) + OUTPUT_TOKEN_HEADROOM;
    return Math.min(MAX_OUTPUT_TOKENS, Math.ceil(estimate));
}
