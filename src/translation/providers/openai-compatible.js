import { postJson, normalizeBaseUrl } from "../../lib/net.js";
import { MAX_OUTPUT_TOKENS, OUTPUT_TOKEN_HEADROOM } from "../../constants.js";
import { SYSTEM_PROMPT } from "../prompt.js";

// Every backend here speaks OpenAI's /chat/completions. Providers differ only
// in their defaults and in the extra fields they accept, which they add through
// `extend` — a field one vendor requires is a 400 at another.

/**
 * @param {{
 *   text: string, settings: object, signal?: AbortSignal,
 *   defaults: {model: string, baseUrl: string},
 *   extend?: (body: object, context: {base: string, model: string}) => void,
 * }} params
 * @returns {Promise<string>} the raw model output
 */
export async function chatCompletion({ text, settings, signal, defaults, extend }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw new Error("API 키가 설정되지 않았습니다");

    const base = normalizeBaseUrl(settings.baseUrl, defaults.baseUrl);
    const model = String(settings.model || defaults.model).trim();

    const body = {
        model,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
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
