import * as deepseek from "./deepseek.js";

// Registry of translation backends. Add another OpenAI-compatible provider by
// creating a sibling module that exports `id`, `label` and `translate`, then
// listing it here.
export const PROVIDERS = {
    [deepseek.id]: deepseek,
};

export const DEFAULT_PROVIDER = deepseek.id;

export function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
}
