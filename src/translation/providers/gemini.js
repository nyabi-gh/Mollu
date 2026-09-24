import { chatCompletion } from "./openai-compatible.js";

export const id = "gemini";
export const label = "Google Gemini";
export const keyHint = "AIza...";
export const models = Object.freeze(["gemini-3.1-flash-lite"]);
export const defaults = Object.freeze({
    model: models[0],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

// Gemini 3.1 cannot stop reasoning; "minimal" is the least it accepts.
function extend(body) {
    body.reasoning_effort = "minimal";
}
