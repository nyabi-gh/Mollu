import { MASK_PATTERN } from "./tokenizer.js";

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿ﾠ-ￜ]/;

// 호이스팅: needsTranslation() 은 대상 서버 모든 메시지의 매 렌더마다 실행되는데,
// 호출마다 이 패턴을 재컴파일하는 것이 비용의 대부분이었다.
const MASK_RE = new RegExp(MASK_PATTERN, "g");
const NON_LETTER = /[^\p{L}]/gu;

// 글자가 아닌 것, 코드, 링크, Discord 토큰은 판정에서 제외한다. 그래서
// "lol <@123> 😄" 는 "lol" 만 보고 판단한다.
export class LanguageDetector {
    constructor(settings) {
        this._settings = settings;
    }

    needsTranslation(text) {
        if (typeof text !== "string") return false;
        const letters = this._letters(text);
        if (letters.length < 2) return false;

        let hangul = 0;
        for (const ch of letters) {
            if (HANGUL.test(ch)) hangul += 1;
        }
        const ratio = hangul / letters.length;
        return ratio < this._settings.current.koreanThreshold / 100;
    }

    _letters(text) {
        MASK_RE.lastIndex = 0;
        NON_LETTER.lastIndex = 0;
        return Array.from(text.replace(MASK_RE, " ").replace(NON_LETTER, ""));
    }
}
