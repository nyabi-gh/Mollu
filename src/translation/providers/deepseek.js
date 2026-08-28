import { chatCompletion } from "./openai-compatible.js";

export const id = "deepseek";
export const label = "DeepSeek";
export const defaults = Object.freeze({
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
});

/**
 * @param {{ text: string, settings: object, signal?: AbortSignal }} params
 * @returns {Promise<string>} the raw model output
 */
export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

function extend(body, { base }) {
    // `thinking` is a DeepSeek extension. OpenAI-compatible servers reject
    // unknown top-level fields with a 400, so it is only sent to DeepSeek.
    // deepseek-v4-* runs with thinking on by default (effort "high"), which
    // adds ~15-20s of latency. Translation needs none of it.
    if (/(^|\.)deepseek\.com$/i.test(hostOf(base))) body.thinking = { type: "disabled" };
}

function hostOf(base) {
    try {
        return new URL(base).hostname;
    } catch {
        return "";
    }
}
