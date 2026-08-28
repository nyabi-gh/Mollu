// Discord-specific tokens that must survive a round trip through the model
// unchanged (mention ids, custom-emoji ids, code, links, timestamps).
// They are replaced with 【n】 placeholders before translation and restored
// afterwards, so the model never sees — or mangles — a raw snowflake id.

const PATTERNS = [
    // A literal 【n】 already in the message. Masking it first keeps it from
    // colliding with the placeholders we generate below.
    "\\u3010\\d+\\u3011",
    "```[\\s\\S]*?```", // fenced code block
    "`[^`\\n]+`", // inline code
    "<a?:\\w+:\\d+>", // custom emoji
    "<@[!&]?\\d+>", // user / role mention
    "<#\\d+>", // channel mention
    "<id:[a-z]+>", // guild navigation mention
    "<t:\\d+(?::[tTdDfFR])?>", // unix timestamp
    "@(?:everyone|here)", // mass mention
    "https?://\\S+", // url
];

export const MASK_PATTERN = PATTERNS.join("|");
export const CODE_PATTERN = "```[\\s\\S]*?```|`[^`\\n]+`";

const OPEN = "\u3010"; // 【
const CLOSE = "\u3011"; // 】

const MASK_RE = new RegExp(MASK_PATTERN, "g");
// The shape we emit. Bracket pairs must match, so "[0】" is not a placeholder.
const EXACT_PLACEHOLDER = /\u3010\s*(\d+)\s*\u3011/g;
// Shapes the model sometimes rewrites 【0】 into.
const LOOSE_PLACEHOLDER = /\[\s*(\d+)\s*\]|\(\s*(\d+)\s*\)|\uff08\s*(\d+)\s*\uff09/g;

/** @returns {{ masked: string, tokens: string[] }} */
export function mask(text) {
    MASK_RE.lastIndex = 0;
    const tokens = [];
    const masked = String(text).replace(MASK_RE, (match) => {
        tokens.push(match);
        return `${OPEN}${tokens.length - 1}${CLOSE}`;
    });
    return { masked, tokens };
}

/** @typedef {{type: "text" | "token", value: string}} Segment */

/**
 * Restore placeholders, keeping the restored tokens as separate segments so the
 * UI can render a mention or a custom emoji as a real element instead of the
 * raw `<@123>` / `<:name:123>` markup. Tolerates the model rewriting 【0】 as
 * [0] or （0）.
 *
 * @returns {Segment[]}
 */
export function unmaskSegments(text, tokens) {
    const restored = new Set();
    const out = [];
    // Pass 1 handles the shape we emit; pass 2 only reconsiders the leftover
    // text, so ordinary "항목 (1)" in a translation is not swallowed and
    // replaced with token #1.
    for (const segment of split(String(text), EXACT_PLACEHOLDER, tokens, restored, true)) {
        if (segment.type === "token") out.push(segment);
        else out.push(...split(segment.value, LOOSE_PLACEHOLDER, tokens, restored, false));
    }
    return out;
}

/** Restore placeholders into a plain string. */
export function unmask(text, tokens) {
    return unmaskSegments(text, tokens)
        .map((segment) => segment.value)
        .join("");
}

function split(input, regex, tokens, restored, record) {
    const out = [];
    let last = 0;
    regex.lastIndex = 0;

    for (let match = regex.exec(input); match !== null; match = regex.exec(input)) {
        const index = Number(match.slice(1).find((group) => group !== undefined));
        const token = tokens[index];
        // An unknown index, or one already restored in pass 1, stays literal
        // text and is picked up by the trailing slice below.
        if (token === undefined || (!record && restored.has(index))) continue;

        if (match.index > last) out.push({ type: "text", value: input.slice(last, match.index) });
        out.push({ type: "token", value: token });
        if (record) restored.add(index);
        last = match.index + match[0].length;
    }

    if (last < input.length) out.push({ type: "text", value: input.slice(last) });
    return out;
}
