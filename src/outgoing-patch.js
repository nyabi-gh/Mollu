import { NAME } from "./constants.js";
import { logger } from "./lib/logger.js";

// 내가 보내는 메시지를 보내기 직전에 번역해 원문 대신 내보낸다. 실제로 남에게
// 나가는 글을 고쳐 쓰는 유일한 곳이라, 어디서 실패하든 원문은 반드시 나간다.

export function findMessageActions() {
    try {
        return BdApi.Webpack.getByKeys("sendMessage", "editMessage") ?? null;
    } catch (e) {
        logger.warn("MessageActions lookup threw", e);
        return null;
    }
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

    // 번역하지 않는 경우에는 원래 호출을 그대로 돌려준다. async 로 감싸면 반환값이
    // Promise 로 바뀌므로, 보내는 경로의 대부분은 건드리지 않고 지나가게 한다.
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
                // 보내는 사람이 기다리고 있다. 실패 백오프에 걸려 조용히 원문이
                // 나가는 것보다 한 번 더 시도하는 편이 낫다.
                ignoreBackoff: true,
            });
            if (result.status === "done" && result.text) {
                args[1] = { ...args[1], content: result.text };
            } else if (result.status === "error" || result.status === "retry") {
                this._onFailure(result.message);
            }
        } catch (e) {
            // translate() 는 reject 하지 않기로 되어 있지만, 여기서 새어 나가면
            // 메시지 자체가 사라진다.
            logger.error("outgoing translation failed", e);
            this._onFailure((e && e.message) || "unknown");
        }
        return original.apply(self, args);
    }

    // 번역해서 보낼 원문, 아니면 null.
    _pick(args) {
        const settings = this._settings.current;
        if (!settings.translateOutgoing || !settings.apiKey) return null;

        const [channelId, message] = args;
        const content = message?.content;
        if (typeof content !== "string" || !content.trim()) return null;
        // 슬래시 커맨드와 봇 접두사는 손대면 그대로 망가진다.
        if (content.startsWith("/")) return null;
        if (content.length > settings.maxChars) return null;

        const guildId = this._stores.guildIdForChannel(channelId);
        if (!guildId) return null;
        if (!settings.allGuilds && !this._settings.guildIdSet.has(guildId)) return null;

        if (!this._detector.needsTranslation(content, settings.outgoingLanguage)) return null;
        return content;
    }
}
