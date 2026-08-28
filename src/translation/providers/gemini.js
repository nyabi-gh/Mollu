import { chatCompletion } from "./openai-compatible.js";

// Gemini API 는 /v1beta/openai 에 OpenAI 호환 엔드포인트를 제공하며 Gemma 모델도
// 같은 곳에서 제공한다. 둘 다 무료 티어 대상이다.
export const id = "gemini";
export const label = "Google Gemini / Gemma";
export const defaults = Object.freeze({
    // 실제 API 로 채팅 길이 메시지를 측정한 결과 약 1초에 번역문만 돌려준다.
    // gemma-4-* 는 9~12초가 걸리고 예산을 전부 <thought> 블록에 써서 번역문이
    // 나오지 않는데, 추론을 끌 수도 없다(아래 extend 참고).
    model: "gemini-3.1-flash-lite",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
});

export function translate(params) {
    return chatCompletion({ ...params, defaults, extend });
}

function extend(body, { model }) {
    // gemini-* 는 추론이 기본 ON 인데 번역에는 이득이 없다. 그 외에는 보내지 않는다.
    // Gemma 는 추론 모델이면서도 이 필드를 HTTP 400 "Thinking budget is not
    // supported for this model." 로 거부하고, 추론 과정을 본문으로 내보낸다.
    if (/^gemini-/i.test(model)) body.reasoning_effort = "none";
}
