import { chatCompletion } from "./openai-compatible.js";

export const id = "deepseek";
export const label = "DeepSeek";
export const defaults = Object.freeze({
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

function extend(body, { base }) {
    // thinking 은 DeepSeek 확장이다. 다른 OpenAI 호환 서버는 모르는 최상위 필드에
    // 400 을 주므로 DeepSeek 에만 보낸다. deepseek-v4-* 는 추론이 기본 ON 이라
    // 15~20초가 더 걸리는데 번역에는 필요 없다.
    if (/(^|\.)deepseek\.com$/i.test(hostOf(base))) body.thinking = { type: "disabled" };
}

function hostOf(base) {
    try {
        return new URL(base).hostname;
    } catch {
        return "";
    }
}
