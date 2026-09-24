import { chatCompletion } from "./openai-compatible.js";

export const id = "gemini";
export const label = "Google Gemini / Gemma";
export const keyHint = "AIza...";
export const models = Object.freeze(["gemini-3.1-flash-lite"]);
export const defaults = Object.freeze({
    model: models[0],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

// Gemini 3 cannot stop reasoning; "minimal" is the least it accepts. Older Gemini can.
function extend(body, { model }) {
    if (/^gemini-3/i.test(model)) body.reasoning_effort = "minimal";
    else if (/^gemini-/i.test(model)) body.reasoning_effort = "none";
}
