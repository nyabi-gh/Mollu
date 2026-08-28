// Discord-specific tokens that must survive a round trip through the model
// unchanged (mention ids, custom-emoji ids, code, links, timestamps).
// They are replaced with 【n】 placeholders before translation and restored
// afterwards, so the model never sees — or mangles — a raw snowflake id.

const PATTERNS = [
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

/** @returns {{ masked: string, tokens: string[] }} */
export function mask(text) {
    const re = new RegExp(MASK_PATTERN, "g");
    const tokens = [];
    const masked = text.replace(re, (match) => {
        tokens.push(match);
        return `${OPEN}${tokens.length - 1}${CLOSE}`;
    });
    return { masked, tokens };
}

/** Restore placeholders. Tolerates the model rewriting 【0】 as [0] or （0）. */
export function unmask(text, tokens) {
    return String(text).replace(/[\u3010[(（]\s*(\d+)\s*[\u3011)）\]]/g, (whole, index) => {
        const token = tokens[Number(index)];
        return token === undefined ? whole : token;
    });
}
