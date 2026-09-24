import { chatCompletion } from "./openai-compatible.js";

export const id = "openai";
export const label = "OpenAI";
export const keyHint = "sk-proj-...";
export const models = Object.freeze(["gpt-6-luna", "gpt-6-sol", "gpt-6-astra"]);
export const defaults = Object.freeze({
    model: models[0],
    baseUrl: "https://api.openai.com/v1",
});

// Astra cannot go below "low"; the others can switch reasoning off.
const LEAST_EFFORT = { "gpt-6-astra": "low" };

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

// GPT-6 models reason, so they take no temperature and count reasoning against
// max_completion_tokens rather than max_tokens.
function extend(body, { model }) {
    delete body.temperature;
    body.max_completion_tokens = body.max_tokens;
    delete body.max_tokens;
    body.reasoning_effort = LEAST_EFFORT[model] ?? "none";
}
