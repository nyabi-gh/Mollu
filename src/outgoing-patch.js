import { NAME, DISCORD_MESSAGE_LIMIT } from "./constants.js";
import { waitForLazyModule } from "./discord.js";
import { logger } from "./lib/logger.js";
import { t } from "./i18n.js";

const SLOW_NOTICE_MS = 1500;

export function findMessageActions() {
    try {
        return BdApi.Webpack.getByKeys("sendMessage", "editMessage") ?? null;
    } catch (e) {
        logger.warn("MessageActions lookup threw", e);
        return null;
    }
}

export function waitForMessageActions(signal) {
    return waitForLazyModule({
        label: "MessageActions",
        signal,
        buildFilters: () => [BdApi.Webpack.Filters.byKeys("sendMessage", "editMessage")],
        resolve: findMessageActions,
    });
}

export class OutgoingPatch {
    constructor({ target, settings, translator, languageDetector, stores, onFailure, onSlow }) {
        this._target = target;
        this._settings = settings;
        this._translator = translator;
        this._detector = languageDetector;
        this._stores = stores;
        this._onFailure = onFailure || (() => {});
        this._onSlow = onSlow || (() => {});
        this._unpatch = null;
        this._tails = new Map();
    }

    install() {
        this._unpatch = BdApi.Patcher.instead(NAME, this._target, "sendMessage", (self, args, original) =>
            this._onSend(self, args, original),
        );
    }

    remove() {
        try {
            this._unpatch?.();
        } finally {
            this._unpatch = null;
        }
    }

    // A message that needs no translation must not overtake one still being translated, so
    // every send in a channel waits its turn behind the one before it.
    _onSend(self, args, original) {
        let text = null;
        try {
            text = this._pick(args);
        } catch (e) {
            logger.error("outgoing gate failed", e);
        }

        const channelId = args?.[0];
        const before = this._tails.get(channelId);
        if (!text && !before) return original.apply(self, args);

        const turn = (before ?? Promise.resolve()).then(() =>
            text ? this._translateInto(args, text) : null,
        );
        const sent = turn.then(() => original.apply(self, args));

        const tail = turn.catch(() => {});
        this._tails.set(channelId, tail);
        tail.then(() => {
            if (this._tails.get(channelId) === tail) this._tails.delete(channelId);
        });
        return sent;
    }

    async _translateInto(args, text) {
        const slow = setTimeout(() => this._onSlow(), SLOW_NOTICE_MS);
        try {
            const result = await this._translator.translate(text, {
                language: this._settings.current.outgoingLanguage,
                ignoreBackoff: true,
                urgent: true,
            });
            if (result.status === "done" && result.text) {
                if (result.text.length > DISCORD_MESSAGE_LIMIT) {
                    this._onFailure(t("error.tooLongToSend", { limit: DISCORD_MESSAGE_LIMIT }));
                    return;
                }
                args[1] = { ...args[1], content: result.text };
                this._remember(text, result.text);
            } else if (result.status === "retry") {
                this._onFailure(t("error.busy"));
            } else if (result.status === "error") {
                this._onFailure(result.message);
            }
        } catch (e) {
            logger.error("outgoing translation failed", e);
            this._onFailure((e && e.message) || "unknown");
        } finally {
            clearTimeout(slow);
        }
    }

    // The message goes out already translated, so the block under it would pay for a round
    // trip back to what was typed. Hand over the pair instead.
    _remember(original, sent) {
        const { targetLanguage } = this._settings.current;
        if (this._detector.needsTranslation(original, targetLanguage)) return;
        this._translator.remember?.(sent, original, targetLanguage);
    }

    _pick(args) {
        const settings = this._settings.current;
        if (!settings.translateOutgoing || !settings.apiKey) return null;

        const [channelId, message] = args;
        const content = message?.content;
        if (typeof content !== "string" || !content.trim()) return null;

        if (content.startsWith("/")) return null;
        if (content.length > settings.maxChars) return null;

        const guildId = this._stores.guildIdForChannel(channelId);
        if (!guildId) {
            if (!settings.translateDms || !this._stores.isDirectMessage?.(channelId)) return null;
        } else if (!settings.allGuilds && !this._settings.guildIdSet.has(guildId)) {
            return null;
        }

        if (!this._detector.needsTranslation(content, settings.outgoingLanguage)) return null;
        return content;
    }
}
