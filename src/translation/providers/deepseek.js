import { postJson } from "../../lib/net.js";
import { SYSTEM_PROMPT } from "../prompt.js";

// DeepSeek exposes an OpenAI-compatible /chat/completions endpoint, so other
// OpenAI-compatible providers work too by changing `baseUrl` and `model`.
export const id = "deepseek";
export const label = "DeepSeek";

/**
 * @param {{ text: string, settings: object, signal?: AbortSignal }} params
 * @returns {Promise<string>} the raw model output
 */
export async function translate({ text, settings, signal }) {
    if (!settings.apiKey) throw new Error("API 키가 설정되지 않았습니다");

    const base = String(settings.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "");
    const json = await postJson(`${base}/chat/completions`, {
        headers: { Authorization: `Bearer ${settings.apiKey}` },
        signal,
        body: {
            model: settings.model || "deepseek-v4-flash",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: text },
            ],
            temperature: 0.2,
            stream: false,
            // deepseek-v4-* runs with thinking on by default (effort "high"),
            // which adds ~15-20s of latency. Translation needs none of it.
            thinking: { type: "disabled" },
        },
    });

    const output = json?.choices?.[0]?.message?.content;
    if (typeof output !== "string" || !output.trim()) throw new Error("빈 응답");
    return output.trim();
}
