// A thread follows its parent: excluding a channel covers the threads under it.
export function isExcludedChannel(settings, stores, channelId) {
    const excluded = settings.excludedChannelSet;
    if (!excluded?.size || !channelId) return false;
    return excluded.has(channelId) || excluded.has(stores.parentChannelId?.(channelId));
}
