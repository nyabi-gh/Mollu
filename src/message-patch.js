import { NAME, TRACE_LIMIT } from "./constants.js";
import { React } from "./discord.js";
import { TranslationBlock } from "./ui/translation-block.js";
import { logger } from "./lib/logger.js";

// 0 = 일반, 19 = 답장, 20 = 슬래시 커맨드 응답. 모두 사람이 읽는 본문이 있다.
// 입장/부스트/고정/통화 등 나머지는 건너뛴다.
const TRANSLATABLE_TYPES = new Set([0, 19, 20]);

export class MessagePatch {
    constructor({ target, settings, translator, languageDetector, stores }) {
        this._target = target;
        this._settings = settings;
        this._translator = translator;
        this._detector = languageDetector;
        this._stores = stores;
        this._unpatch = null;
        this._traced = new Set();
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
        if (!ret) return ret;

        const message = props?.message;
        const { guildId, reason } = this._resolve(message);
        if (!guildId) {
            this._trace(message, reason);
            return ret;
        }
        if (!this._detector.needsTranslation(message.content)) {
            this._trace(message, "already in the target language");
            return ret;
        }

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

    // {guildId} 또는 {reason}. 사유는 진단 로그에만 쓰이고, 꺼져 있으면 버려진다.
    _resolve(message) {
        if (!message || typeof message.content !== "string" || !message.content.trim()) {
            return { reason: "no text content" };
        }
        if (!TRANSLATABLE_TYPES.has(message.type)) {
            return { reason: `message type ${message.type} is not translatable` };
        }

        const settings = this._settings.current;
        if (!settings.apiKey) return { reason: "no api key configured" };
        if (!settings.allGuilds && this._settings.guildIdSet.size === 0) {
            return { reason: "no target server configured" };
        }

        const author = message.author || {};
        if (!settings.translateBots && author.bot) return { reason: "author is a bot" };
        if (!settings.translateOwnMessages && author.id && author.id === this._stores.currentUserId()) {
            return { reason: "own message" };
        }

        // DM 에는 guild_id 가 없다. "모든 서버" 는 서버 채널만 뜻하므로 여기서 걸러진다.
        const guildId = this._stores.guildIdForChannel(message.channel_id);
        if (!guildId) return { reason: "not a server channel" };
        if (!settings.allGuilds && !this._settings.guildIdSet.has(guildId)) {
            return { reason: `server ${guildId} is not in the target list` };
        }
        return { guildId };
    }

    // 같은 메시지가 렌더마다 다시 판정되므로 사유당 한 번만 남긴다.
    _trace(message, reason) {
        if (!this._settings.current.debugLog) return;
        const id = message?.id ?? "?";
        const key = `${id}\u0001${reason}`;
        if (this._traced.has(key)) return;
        if (this._traced.size >= TRACE_LIMIT) this._traced.clear();
        this._traced.add(key);
        logger.info(`not translated · ${id} · ${reason}`);
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
