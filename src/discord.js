import { logger } from "./lib/logger.js";

export const React = BdApi.React;

export function createStores() {
    const ChannelStore = BdApi.Webpack.getStore("ChannelStore");
    const UserStore = BdApi.Webpack.getStore("UserStore");
    const GuildStore = BdApi.Webpack.getStore("GuildStore");

    return {
        guildIdForChannel(channelId) {
            try {
                return ChannelStore?.getChannel?.(channelId)?.guild_id ?? null;
            } catch {
                return null;
            }
        },
        currentUserId() {
            try {
                return UserStore?.getCurrentUser?.()?.id ?? null;
            } catch {
                return null;
            }
        },

        userName(userId) {
            try {
                const user = UserStore?.getUser?.(userId);
                return user?.globalName || user?.username || null;
            } catch {
                return null;
            }
        },
        channelName(channelId) {
            try {
                return ChannelStore?.getChannel?.(channelId)?.name ?? null;
            } catch {
                return null;
            }
        },
        roleName(guildId, roleId) {
            try {
                return GuildStore?.getGuild?.(guildId)?.roles?.[roleId]?.name ?? null;
            } catch {
                return null;
            }
        },
    };
}

export function findMessageContent() {
    const { Filters } = BdApi.Webpack;

    const markerSets = [
        ["contentRef", "onUpdate", "compact"],
        ["contentRef", "onUpdate", "message", "content"],
        ["className", "message", "children", "content", "onUpdate", "contentRef", "compact"],
        ["messageContent", "onUpdate", "contentRef"],
    ];

    for (const markers of markerSets) {
        const target = tryWithKey(Filters.byComponentType(Filters.byStrings(...markers)));
        if (target) {
            logger.info(`MessageContent resolved via [${markers.join(", ")}] -> key "${target.key}"`);
            return target;
        }
    }

    if (typeof Filters.byDisplayName === "function") {
        const target = tryWithKey(Filters.byDisplayName("MessageContent"));
        if (target) {
            logger.info(`MessageContent resolved via displayName -> key "${target.key}"`);
            return target;
        }
    }

    return null;
}

function tryWithKey(filter) {
    let owner;
    let key;
    try {
        [owner, key] = BdApi.Webpack.getWithKey(filter);
    } catch (e) {
        logger.warn("getWithKey threw", e);
        return null;
    }
    if (!owner || !key) return null;

    const value = owner[key];
    if (value && typeof value.type === "function") return { module: value, key: "type" };
    if (value && typeof value.render === "function") return { module: value, key: "render" };
    if (typeof value === "function") return { module: owner, key };
    return null;
}
