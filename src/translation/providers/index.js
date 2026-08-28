import * as deepseek from "./deepseek.js";
import * as gemini from "./gemini.js";

// Registry of translation backends. Add another OpenAI-compatible provider by
// creating a sibling module that exports `id`, `label`, `defaults` and
// `translate`, then listing it here.
export const PROVIDERS = {
    [deepseek.id]: deepseek,
    [gemini.id]: gemini,
};

export const DEFAULT_PROVIDER = deepseek.id;

export function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
}

/** Options for the settings dropdown. */
export const PROVIDER_OPTIONS = Object.values(PROVIDERS).map((provider) => ({
    label: provider.label,
    value: provider.id,
}));
