import { NAME } from "./constants.js";
import { waitForLazyModule } from "./discord.js";
import { logger } from "./lib/logger.js";

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
    constructor({ target, settings, translator, languageDetector, stores, onFailure }) {
        this._target = target;
        this._settings = settings;
        this._translator = translator;
        this._detector = languageDetector;
        this._stores = stores;
        this._onFailure = onFailure || (() => {});
        this._unpatch = null;
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

    _onSend(self, args, original) {
        let text = null;
        try {
            text = this._pick(args);
        } catch (e) {
            logger.error("outgoing gate failed", e);
        }
        if (!text) return original.apply(self, args);
        return this._translateThenSend(self, args, original, text);
    }

    async _translateThenSend(self, args, original, text) {
        try {
            const result = await this._translator.translate(text, {
                language: this._settings.current.outgoingLanguage,

                ignoreBackoff: true,
            });
            if (result.status === "done" && result.text) {
                args[1] = { ...args[1], content: result.text };
            } else if (result.status === "error" || result.status === "retry") {
                this._onFailure(result.message);
            }
        } catch (e) {
            logger.error("outgoing translation failed", e);
            this._onFailure((e && e.message) || "unknown");
        }
        return original.apply(self, args);
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
