import * as deepseek from "./deepseek.js";
import * as gemini from "./gemini.js";
import * as deepl from "./deepl.js";

export const PROVIDERS = {
    [deepseek.id]: deepseek,
    [gemini.id]: gemini,
    [deepl.id]: deepl,
};

export const DEFAULT_PROVIDER = deepseek.id;

export function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
}

export const PROVIDER_OPTIONS = Object.values(PROVIDERS).map((provider) => ({
    label: provider.label,
    value: provider.id,
}));

export function modelOptions(providerId, current) {
    const { models = [] } = getProvider(providerId);
    const values = models.includes(current) || !current ? models : [...models, current];
    return values.length < 2 ? [] : values.map((model) => ({ label: model, value: model }));
}
