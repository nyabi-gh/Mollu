import { postJson, normalizeBaseUrl } from "../../lib/net.js";
import { MAX_OUTPUT_TOKENS, OUTPUT_TOKEN_HEADROOM } from "../../constants.js";
import { systemPrompt } from "../prompt.js";
import { getLanguage } from "../../languages.js";
import { t } from "../../i18n.js";

// 여기 백엔드는 모두 OpenAI 의 /chat/completions 를 쓴다. 프로바이더 간 차이는
// 기본값과 extend 로 덧붙이는 벤더 전용 필드뿐이다. 한 벤더가 요구하는 필드가
// 다른 벤더에서는 400 이 된다.
export async function chatCompletion({ text, settings, signal, defaults, extend }) {
    const apiKey = String(settings.apiKey || "").trim();
    if (!apiKey) throw new Error(t("error.noApiKey"));

    const base = normalizeBaseUrl(settings.baseUrl, defaults.baseUrl);
    const model = String(settings.model || defaults.model).trim();

    const body = {
        model,
        messages: [
            { role: "system", content: systemPrompt(getLanguage(settings.targetLanguage).name) },
            { role: "user", content: text },
        ],
        temperature: 0.2,
        stream: false,
        max_tokens: outputBudget(text),
    };
    if (extend) extend(body, { base, model });

    const json = await postJson(`${base}/chat/completions`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
        body,
    });

    const choice = json?.choices?.[0];
    const output = stripReasoning(choice?.message?.content);
    if (!output) {
        // Gemma 4 는 예산을 전부 <thought> 에 쓰고 번역문을 쓰기 전에 잘린다.
        // 오류로 처리해야 추론 과정이 메시지 목록에 노출되지 않는다.
        throw new Error(
            t(choice?.finish_reason === "length" ? "error.reasoningOnly" : "error.emptyResponse"),
        );
    }
    return output;
}

// 본문으로 흘러나온 추론 과정을 제거한다. reasoning_effort 를 지원하는 모델은
// 애초에 추론을 끄지만, 끌 수단이 없는 모델을 위한 방어선이다.
function stripReasoning(value) {
    if (typeof value !== "string") return "";

    let text = value.replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, "");
    // 닫히지 않은 블록은 답이 아예 오지 않았다는 뜻이라 그 뒤에는 아무것도 없다.
    const unclosed = text.search(/<(?:thought|think)>/i);
    if (unclosed !== -1) text = text.slice(0, unclosed);
    return text.trim();
}

// 번역문은 글자 수 기준으로 원문보다 크게 길어지지 않고 토큰 하나가 최소 한 글자를
// 담으므로, 원문 길이 + 여유분이 안전한 상한이다. 짧은 메시지의 폭주도 함께 막힌다.
function outputBudget(text) {
    return Math.min(MAX_OUTPUT_TOKENS, text.length + OUTPUT_TOKEN_HEADROOM);
}
