const PATTERNS = [
    "\\u3010\\d+\\u3011",
    "```[\\s\\S]*?```",
    "`[^`\\n]+`",
    "<a?:\\w+:\\d+>",
    "<@[!&]?\\d+>",
    "<#\\d+>",
    "<id:[a-z]+>",
    "<t:\\d+(?::[tTdDfFR])?>",
    "@(?:everyone|here)",
    "https?://\\S+",
];

export const MASK_PATTERN = PATTERNS.join("|");
export const CODE_PATTERN = "```[\\s\\S]*?```|`[^`\\n]+`";

const OPEN = "\u3010";
const CLOSE = "\u3011";

const MASK_RE = new RegExp(MASK_PATTERN, "g");
const EXACT_PLACEHOLDER = /\u3010\s*(\d+)\s*\u3011/g;
const LOOSE_PLACEHOLDER = /\[\s*(\d+)\s*\]|\(\s*(\d+)\s*\)|\uff08\s*(\d+)\s*\uff09/g;

export function mask(text) {
    MASK_RE.lastIndex = 0;
    const tokens = [];
    const masked = String(text).replace(MASK_RE, (match) => {
        tokens.push(match);
        return `${OPEN}${tokens.length - 1}${CLOSE}`;
    });
    return { masked, tokens };
}

export function unmaskSegments(text, tokens) {
    const restored = new Set();
    const out = [];

    for (const segment of split(String(text), EXACT_PLACEHOLDER, tokens, restored, true)) {
        if (segment.type === "token") out.push(segment);
        else out.push(...split(segment.value, LOOSE_PLACEHOLDER, tokens, restored, false));
    }
    return out;
}

const SOURCE_PLACEHOLDER = /\u3010(\d+)\u3011/g;

function placeholderCount(maskedSource) {
    SOURCE_PLACEHOLDER.lastIndex = 0;
    let count = 0;
    while (SOURCE_PLACEHOLDER.exec(String(maskedSource)) !== null) count += 1;
    return count;
}

export function missingPlaceholders(maskedTranslation, maskedSource) {
    const count = placeholderCount(maskedSource);
    if (count === 0) return [];

    const placeholders = Array.from({ length: count }, (_, i) => `${OPEN}${i}${CLOSE}`);
    const restored = new Set();
    for (const segment of unmaskSegments(maskedTranslation, placeholders)) {
        if (segment.type === "token") restored.add(segment.index);
    }
    return placeholders.map((_, i) => i).filter((i) => !restored.has(i));
}

export function appendPlaceholders(maskedTranslation, indices) {
    if (indices.length === 0) return maskedTranslation;
    const tail = indices.map((i) => `${OPEN}${i}${CLOSE}`).join(" ");
    return `${maskedTranslation.replace(/\s+$/, "")} ${tail}`;
}

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

        if (token === undefined || (!record && restored.has(index))) continue;

        if (match.index > last) out.push({ type: "text", value: input.slice(last, match.index) });
        out.push({ type: "token", value: token, index });
        if (record) restored.add(index);
        last = match.index + match[0].length;
    }

    if (last < input.length) out.push({ type: "text", value: input.slice(last) });
    return out;
}
