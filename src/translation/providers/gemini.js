import { chatCompletion } from "./openai-compatible.js";

// Google's Gemini API exposes an OpenAI-compatible surface at /v1beta/openai,
// which also serves the Gemma models. The free tier covers both.
export const id = "gemini";
export const label = "Google Gemini / Gemma";
export const defaults = Object.freeze({
    // Gemma 4 31B is an instruction-tuned non-reasoning model with native
    // system-role support, which is all a translation needs.
    model: "gemma-4-31b-it",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
});

/**
 * @param {{ text: string, settings: object, signal?: AbortSignal }} params
 * @returns {Promise<string>} the raw model output
 */
export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

function extend(body, { model }) {
    // gemini-* models reason by default, which a translation gains nothing from.
    // Gemma is not a reasoning model, so the field is not sent to it.
    if (/^gemini-/i.test(model)) body.reasoning_effort = "none";
}
