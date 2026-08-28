import { NAME } from "./constants.js";
import { React } from "./discord.js";
import { TranslationBlock } from "./ui/translation-block.js";
import { logger } from "./lib/logger.js";

// 0 = 일반, 19 = 답장. 입장/부스트/고정/통화 등 나머지는 건너뛴다.
const TRANSLATABLE_TYPES = new Set([0, 19]);

export class MessagePatch {
    constructor({ target, settings, translator, languageDetector, stores }) {
        this._target = target;
        this._settings = settings;
        this._translator = translator;
        this._detector = languageDetector;
        this._stores = stores;
        this._unpatch = null;
    }

    install() {
        const { module, key } = this._target;
        this._unpatch = BdApi.Patcher.after(NAME, module, key, (_self, args, ret) => {
            try {
                return this._onRender(args?.[0], ret);
            } catch (e) {
                logger.error("render patch failed", e);
                return ret;
            }
        });
    }

    remove() {
        try {
            this._unpatch?.();
        } finally {
            this._unpatch = null;
        }
    }

    _onRender(props, ret) {
        const message = props?.message;
        const guildId = ret ? this._targetGuildId(message) : null;
        if (!guildId) return ret;
        if (!this._detector.needsTranslation(message.content)) return ret;

        const block = React.createElement(TranslationBlock, {
            key: "mollu-translation",
            text: message.content,
            guildId,
            stores: this._stores,
            translator: this._translator,
            settings: this._settings,
        });
        return appendChild(ret, block);
    }

    _targetGuildId(message) {
        if (!message || typeof message.content !== "string" || !message.content.trim()) return null;
        if (!TRANSLATABLE_TYPES.has(message.type)) return null;

        const settings = this._settings.current;
        if (!settings.apiKey || this._settings.guildIdSet.size === 0) return null;

        const author = message.author || {};
        if (!settings.translateBots && author.bot) return null;
        if (!settings.translateOwnMessages && author.id && author.id === this._stores.currentUserId()) {
            return null;
        }

        const guildId = this._stores.guildIdForChannel(message.channel_id);
        return guildId && this._settings.guildIdSet.has(guildId) ? guildId : null;
    }
}

// props 를 제자리에서 고치는 대신 복제한다.
function appendChild(ret, child) {
    if (Array.isArray(ret)) return [...ret, child];
    if (ret && ret.props) {
        const children = ret.props.children;
        // 배열 하나가 아니라 개별 인자로 넘긴다. 그래야 React 가 Discord 자체
        // 자식 요소들에 key 를 요구하지 않는다.
        return children == null
            ? React.cloneElement(ret, undefined, child)
            : React.cloneElement(ret, undefined, children, child);
    }
    return ret;
}
