import { React } from "../discord.js";

// Tokens come back from the translation exactly as they appeared in the source
// (see translation/tokenizer.js). Rendering them as plain text would show raw
// `<@123>` / `<:name:123>` markup, so each shape is turned into an element.
// Anything unrecognised — or any name lookup that misses — falls back to the
// literal token, which is what the previous behaviour was.

const CUSTOM_EMOJI = /^<(a)?:(\w+):(\d+)>$/;
const USER_MENTION = /^<@!?(\d+)>$/;
const ROLE_MENTION = /^<@&(\d+)>$/;
const CHANNEL_MENTION = /^<#(\d+)>$/;
const TIMESTAMP = /^<t:(\d+)(?::([tTdDfFR]))?>$/;
const FENCED_CODE = /^```(?:[\w+-]*\n)?([\s\S]*?)```$/;
const INLINE_CODE = /^`([^`\n]+)`$/;

const EMOJI_CDN = "https://cdn.discordapp.com/emojis";

/**
 * @param {Array<{type: "text" | "token", value: string}>} segments
 * @param {{userName: Function, channelName: Function, roleName: Function}} stores
 * @param {string|null} guildId owning guild, needed to resolve role mentions
 * @returns {Array<React.ReactNode>}
 */
export function renderSegments(segments, stores, guildId) {
    return segments.map((segment, index) =>
        segment.type === "token" ? renderToken(segment.value, stores, guildId, index) : segment.value,
    );
}

function renderToken(token, stores, guildId, key) {
    const emoji = CUSTOM_EMOJI.exec(token);
    if (emoji) {
        const [, animated, name, id] = emoji;
        return React.createElement("img", {
            key,
            className: "mollu-translation__emoji",
            src: `${EMOJI_CDN}/${id}.${animated ? "gif" : "webp"}?size=44&quality=lossless`,
            alt: `:${name}:`,
            title: `:${name}:`,
            draggable: false,
        });
    }

    const user = USER_MENTION.exec(token);
    if (user) return mention(key, stores?.userName?.(user[1]), "@", token);

    const role = ROLE_MENTION.exec(token);
    if (role) return mention(key, guildId ? stores?.roleName?.(guildId, role[1]) : null, "@", token);

    const channel = CHANNEL_MENTION.exec(token);
    if (channel) return mention(key, stores?.channelName?.(channel[1]), "#", token);

    const timestamp = TIMESTAMP.exec(token);
    if (timestamp) {
        const formatted = formatTimestamp(Number(timestamp[1]), timestamp[2]);
        return formatted == null
            ? token
            : React.createElement("span", { key, className: "mollu-translation__mention" }, formatted);
    }

    const code = FENCED_CODE.exec(token) || INLINE_CODE.exec(token);
    if (code) {
        return React.createElement("code", { key, className: "mollu-translation__code" }, code[1]);
    }

    return token;
}

function mention(key, name, sigil, fallback) {
    if (!name) return fallback;
    return React.createElement("span", { key, className: "mollu-translation__mention" }, `${sigil}${name}`);
}

// Discord's <t:unix:style> styles. Rendered with the viewer's own locale.
const TIME_STYLES = {
    t: { timeStyle: "short" },
    T: { timeStyle: "medium" },
    d: { dateStyle: "short" },
    D: { dateStyle: "long" },
    f: { dateStyle: "long", timeStyle: "short" },
    F: { dateStyle: "full", timeStyle: "short" },
};

function formatTimestamp(seconds, style) {
    if (!Number.isFinite(seconds)) return null;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return null;

    try {
        if (style === "R") return relativeTime(date);
        return new Intl.DateTimeFormat(undefined, TIME_STYLES[style] || TIME_STYLES.f).format(date);
    } catch {
        return null;
    }
}

const RELATIVE_UNITS = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
];

function relativeTime(date) {
    const delta = (date.getTime() - Date.now()) / 1000;
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    for (const [unit, size] of RELATIVE_UNITS) {
        if (Math.abs(delta) >= size || unit === "second") {
            return formatter.format(Math.round(delta / size), unit);
        }
    }
    return null;
}
