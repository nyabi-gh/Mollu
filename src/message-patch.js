import { NAME } from "./constants.js";
import { React } from "./discord.js";
import { TranslationBlock } from "./ui/translation-block.js";
import { logger } from "./lib/logger.js";

// Message types we translate: 0 = default, 19 = reply. Everything else
// (joins, boosts, pins, calls, ...) is skipped.
const TRANSLATABLE_TYPES = new Set([0, 19]);

/**
 * Patches `MessageContent`'s render to append a <TranslationBlock/> beneath the
 * message text whenever the message is in a target server and not already
 * Korean. The block itself owns the async translate + re-render.
 */
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
        if (!ret || !this._shouldConsider(message)) return ret;
        if (!this._detector.needsTranslation(message.content)) return ret;

        const block = React.createElement(TranslationBlock, {
            key: "kat-translation",
            text: message.content,
            translator: this._translator,
            settings: this._settings,
        });
        return appendChild(ret, block);
    }

    _shouldConsider(message) {
        if (!message || typeof message.content !== "string" || !message.content.trim()) return false;
        if (!TRANSLATABLE_TYPES.has(message.type)) return false;

        const settings = this._settings.current;
        if (!settings.apiKey || this._settings.guildIdSet.size === 0) return false;

        const author = message.author || {};
        if (!settings.translateBots && author.bot) return false;
        if (!settings.translateOwnMessages && author.id && author.id === this._stores.currentUserId()) {
            return false;
        }

        const guildId = this._stores.guildIdForChannel(message.channel_id);
        return !!guildId && this._settings.guildIdSet.has(guildId);
    }
}

// MessageContent's return is a single element (fragment/div). Production Discord
// does not freeze element props, but cloning is safer than mutating in place.
function appendChild(ret, child) {
    if (Array.isArray(ret)) return [...ret, child];
    if (ret && ret.props) {
        const children = ret.props.children;
        const next =
            children == null ? [child] : Array.isArray(children) ? [...children, child] : [children, child];
        return React.cloneElement(ret, undefined, next);
    }
    return ret;
}
