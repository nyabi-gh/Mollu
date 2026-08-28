import { postJson, normalizeBaseUrl } from "../../lib/net.js";
import { MAX_OUTPUT_TOKENS, OUTPUT_TOKEN_HEADROOM } from "../../constants.js";
import { SYSTEM_PROMPT } from "../prompt.js";

// DeepSeek exposes an OpenAI-compatible /chat/completions endpoint, so other
// OpenAI-compatible providers work too by changing `baseUrl` and `model`.
export const id = "deepseek";
export const label = "DeepSeek";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

/**
 * @param {{ text: string, settings: object, signal?: AbortSignal }} params
 * @returns {Promise<string>} the raw model output
 */
export async function translate({ text, settings, signal }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw new Error("API 키가 설정되지 않았습니다");

    const base = normalizeBaseUrl(settings.baseUrl, DEFAULT_BASE_URL);

    const body = {
        model: settings.model || DEFAULT_MODEL,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
        ],
        temperature: 0.2,
        stream: false,
        max_tokens: outputBudget(text),
    };

    // `thinking` is a DeepSeek extension. OpenAI-compatible servers reject
    // unknown top-level fields with a 400, so it is only sent to DeepSeek.
    // deepseek-v4-* runs with thinking on by default (effort "high"), which adds
    // ~15-20s of latency. Translation needs none of it.
    if (isDeepSeekHost(base)) body.thinking = { type: "disabled" };

    const json = await postJson(`${base}/chat/completions`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
        body,
    });

    const output = json?.choices?.[0]?.message?.content;
    if (typeof output !== "string" || !output.trim()) throw new Error("빈 응답");
    return output.trim();
}

// Korean output is never much longer than its source in characters, and one
// token covers at least one character, so source length + headroom is a safe
// upper bound that still caps a runaway generation on a short message.
function outputBudget(text) {
    return Math.min(MAX_OUTPUT_TOKENS, text.length + OUTPUT_TOKEN_HEADROOM);
}

function isDeepSeekHost(base) {
    try {
        return /(^|\.)deepseek\.com$/i.test(new URL(base).hostname);
    } catch {
        return false;
    }
}
