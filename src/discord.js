import { logger } from "./lib/logger.js";

export const React = BdApi.React;

const DM_CHANNEL_TYPES = new Set([1, 3]);

const MESSAGE_CONTENT_MARKERS = [
    ["contentRef", "onUpdate", "compact"],
    ["contentRef", "onUpdate", "message", "content"],
    ["className", "message", "children", "content", "onUpdate", "contentRef", "compact"],
    ["messageContent", "onUpdate", "contentRef"],
];

export function createStores() {
    const found = new Map();

    // Discord loads its stores in chunks, so one that is missing right now may exist a moment
    // later; only a successful lookup is cached.
    const store = (name) => {
        const cached = found.get(name);
        if (cached) return cached;
        let value;
        try {
            value = BdApi.Webpack.getStore(name) ?? null;
        } catch (e) {
            logger.warn(`${name} lookup threw`, e);
            return null;
        }
        if (value) found.set(name, value);
        return value;
    };

    return {
        guildIdForChannel(channelId) {
            try {
                return store("ChannelStore")?.getChannel?.(channelId)?.guild_id ?? null;
            } catch {
                return null;
            }
        },
        isDirectMessage(channelId) {
            try {
                return DM_CHANNEL_TYPES.has(store("ChannelStore")?.getChannel?.(channelId)?.type);
            } catch {
                return false;
            }
        },
        currentUserId() {
            try {
                return store("UserStore")?.getCurrentUser?.()?.id ?? null;
            } catch {
                return null;
            }
        },

        userName(userId) {
            try {
                const user = store("UserStore")?.getUser?.(userId);
                return user?.globalName || user?.username || null;
            } catch {
                return null;
            }
        },
        channelName(channelId) {
            try {
                return store("ChannelStore")?.getChannel?.(channelId)?.name ?? null;
            } catch {
                return null;
            }
        },
        roleName(guildId, roleId) {
            try {
                return store("GuildStore")?.getGuild?.(guildId)?.roles?.[roleId]?.name ?? null;
            } catch {
                return null;
            }
        },
    };
}

export function findMessageContent() {
    const { Filters } = BdApi.Webpack;

    for (const markers of MESSAGE_CONTENT_MARKERS) {
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

// Discord only loads the chat chunk once a channel is opened, so a client that starts on the
// friends list has no MessageContent to patch yet. Wait for the chunk instead of giving up.
export function waitForMessageContent(signal) {
    return waitForLazyModule({
        label: "MessageContent",
        signal,
        searchExports: true,
        buildFilters: () => {
            const { Filters } = BdApi.Webpack;
            const filters = MESSAGE_CONTENT_MARKERS.map((markers) =>
                Filters.byComponentType(Filters.byStrings(...markers)),
            );
            if (typeof Filters.byDisplayName === "function") {
                filters.push(Filters.byDisplayName("MessageContent"));
            }
            return filters;
        },
        resolve: findMessageContent,
    });
}

// Resolves once a module matching one of the filters is loaded, then re-runs the ordinary
// lookup so the caller gets exactly what it would have found at start. Never resolves while
// the module stays absent; the caller drops the wait by aborting the signal.
export function waitForLazyModule({ label, signal, buildFilters, resolve, searchExports = false }) {
    const waitForModule = BdApi.Webpack?.waitForModule;
    if (typeof waitForModule !== "function") {
        logger.warn(`BdApi.Webpack.waitForModule is unavailable; cannot wait for ${label}`);
        return Promise.resolve(null);
    }

    let filters;
    try {
        filters = buildFilters();
    } catch (e) {
        logger.warn(`could not build the ${label} filters`, e);
        return Promise.resolve(null);
    }

    const matches = (exports) => {
        for (const filter of filters) {
            try {
                if (filter(exports)) return true;
            } catch {}
        }
        return false;
    };

    let pending;
    try {
        pending = waitForModule.call(BdApi.Webpack, matches, { signal, searchExports });
    } catch (e) {
        logger.warn(`waitForModule threw while waiting for ${label}`, e);
        return Promise.resolve(null);
    }
    if (!pending || typeof pending.then !== "function") return Promise.resolve(null);

    return pending.then(
        () => (signal?.aborted ? null : resolve()),
        (e) => {
            logger.warn(`waiting for ${label} failed`, e);
            return null;
        },
    );
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
