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

// Never stored as a model name; picking it only opens the text field beside the dropdown.
export const CUSTOM_MODEL = "__custom__";

export function knownModels(providerId) {
    return getProvider(providerId).models ?? [];
}

export function isCustomModel(providerId, model) {
    const models = knownModels(providerId);
    return models.length > 0 && !models.includes(String(model ?? "").trim());
}
