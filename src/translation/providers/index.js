import * as deepseek from "./deepseek.js";
import * as gemini from "./gemini.js";

// OpenAI 호환 프로바이더를 추가하려면 id, label, defaults, translate 를 내보내는
// 형제 모듈을 만들어 여기에 등록하면 된다.
export const PROVIDERS = {
    [deepseek.id]: deepseek,
    [gemini.id]: gemini,
};

export const DEFAULT_PROVIDER = deepseek.id;

export function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
}

export const PROVIDER_OPTIONS = Object.values(PROVIDERS).map((provider) => ({
    label: provider.label,
    value: provider.id,
}));
