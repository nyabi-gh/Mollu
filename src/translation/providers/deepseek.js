import { chatCompletion } from "./openai-compatible.js";

export const id = "deepseek";
export const label = "DeepSeek";
export const models = Object.freeze(["deepseek-v4-flash", "deepseek-v4-pro"]);
export const defaults = Object.freeze({
    model: models[0],
    baseUrl: "https://api.deepseek.com",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

function extend(body, { base }) {
    if (/(^|\.)deepseek\.com$/i.test(hostOf(base))) body.thinking = { type: "disabled" };
}

function hostOf(base) {
    try {
        return new URL(base).hostname;
    } catch {
        return "";
    }
}
