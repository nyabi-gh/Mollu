import { chatCompletion } from "./openai-compatible.js";

export const id = "gemini";
export const label = "Google Gemini / Gemma";
export const defaults = Object.freeze({
    model: "gemini-3.1-flash-lite",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

function extend(body, { model }) {
    if (/^gemini-/i.test(model)) body.reasoning_effort = "none";
}
