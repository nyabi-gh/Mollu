// 멘션 id, 커스텀 이모지 id, 코드, 링크, 타임스탬프처럼 모델을 왕복해도 그대로
// 남아야 하는 토큰들. 번역 전에 【n】 placeholder 로 바꾸고 이후 복원하므로
// 모델은 스노우플레이크 id 를 보지도, 망가뜨리지도 못한다.

const PATTERNS = [
    // 원문에 이미 들어 있는 리터럴 【n】. 먼저 마스킹해야 아래에서 생성하는
    // placeholder 와 충돌하지 않는다.
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
// 우리가 내보내는 형태. 괄호 짝이 맞아야 하므로 "[0】" 는 placeholder 가 아니다.
const EXACT_PLACEHOLDER = /\u3010\s*(\d+)\s*\u3011/g;
// 모델이 【0】 을 종종 바꿔 쓰는 형태들.
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

/** @typedef {{type: "text" | "token", value: string}} Segment */

// 복원된 토큰을 별도 세그먼트로 남긴다. 그래야 UI 가 멘션이나 커스텀 이모지를
// raw 마크업 대신 실제 요소로 렌더할 수 있다.
export function unmaskSegments(text, tokens) {
    const restored = new Set();
    const out = [];
    // 1차는 우리가 내보낸 형태만, 2차는 남은 텍스트만 다시 본다. 그래야 번역문에
    // 정상적으로 등장한 "항목 (1)" 이 토큰 1번으로 치환되지 않는다.
    for (const segment of split(String(text), EXACT_PLACEHOLDER, tokens, restored, true)) {
        if (segment.type === "token") out.push(segment);
        else out.push(...split(segment.value, LOOSE_PLACEHOLDER, tokens, restored, false));
    }
    return out;
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
        // 모르는 인덱스이거나 1차에서 이미 복원된 것은 그냥 텍스트로 두고
        // 아래 마지막 slice 에서 함께 집어 간다.
        if (token === undefined || (!record && restored.has(index))) continue;

        if (match.index > last) out.push({ type: "text", value: input.slice(last, match.index) });
        out.push({ type: "token", value: token });
        if (record) restored.add(index);
        last = match.index + match[0].length;
    }

    if (last < input.length) out.push({ type: "text", value: input.slice(last) });
    return out;
}
