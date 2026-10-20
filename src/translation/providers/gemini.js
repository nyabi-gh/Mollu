import { chatCompletion } from "./openai-compatible.js";

export const id = "gemini";
export const label = "Google Gemini";
export const keyHint = "AIza...";
export const models = Object.freeze(["gemini-3.5-flash-lite", "gemini-3.8-flash"]);
export const defaults = Object.freeze({
    model: models[0],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

// Gemini 3.x cannot stop reasoning. Flash-Lite goes down to "minimal"; Flash stops at "low".
function extend(body, { model }) {
    body.reasoning_effort = /flash-lite/i.test(model) ? "minimal" : "low";
}
