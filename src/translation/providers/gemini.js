import { chatCompletion } from "./openai-compatible.js";

// Google's Gemini API exposes an OpenAI-compatible surface at /v1beta/openai,
// which also serves the Gemma models. The free tier covers both.
export const id = "gemini";
export const label = "Google Gemini / Gemma";
export const defaults = Object.freeze({
    // Measured against the live API on a chat-length message: this answers in
    // ~1s with the translation alone. The Gemma 4 models take 9-12s and spend
    // the whole budget emitting a <thought> block instead of a translation,
    // and they cannot be told to stop — see extend() below.
    model: "gemini-3.1-flash-lite",
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
    // The field is not sent to anything else: Gemma rejects it outright with
    // "Thinking budget is not supported for this model." (HTTP 400), even
    // though it reasons — its chain of thought arrives as content instead.
    if (/^gemini-/i.test(model)) body.reasoning_effort = "none";
}
