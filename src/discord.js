import { logger } from "./lib/logger.js";

// Discord's own React instance. Components must be built with this one.
export const React = BdApi.React;

/**
 * Small read-only facade over the Flux stores the plugin needs. Kept here so the
 * rest of the code never touches BdApi.Webpack directly.
 */
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
        // The three lookups below resolve mentions for display. `null` means
        // "unknown", and the caller falls back to the raw token.
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

/**
 * Locate Discord's `MessageContent` component so its render can be patched.
 *
 * Discord ships production builds without `displayName` and with hashed CSS
 * class names, so we match on stable substrings of the component's source and
 * fall back through a few marker sets. `byComponentType` unwraps
 * memo/forwardRef before the string check.
 *
 * @returns {{ module: object, key: string } | null} arguments for BdApi.Patcher
 */
export function findMessageContent() {
    const { Filters } = BdApi.Webpack;

    // MessageContent's function destructures these props:
    //   {className, message, children, content, onUpdate, contentRef, compact}
    // `contentRef` + `onUpdate` + `compact` together are effectively unique to it.
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

    // Last resort: some builds still expose the displayName.
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
    if (value && typeof value.type === "function") return { module: value, key: "type" }; // React.memo
    if (value && typeof value.render === "function") return { module: value, key: "render" }; // forwardRef
    if (typeof value === "function") return { module: owner, key }; // bare function component
    return null;
}
