import { MASK_PATTERN } from "./tokenizer.js";
import { getLanguage } from "../languages.js";

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

        const { script } = getLanguage(this._settings.current.targetLanguage);
        // 라틴 문자 대상 언어는 보내기 전에 구분할 수 없다. 모델에 맡기고,
        // 원문과 같은 결과가 오면 표시하지 않는 경로로 처리한다.
        if (!script) return true;

        let inTarget = 0;
        for (const ch of letters) {
            if (script.test(ch)) inTarget += 1;
        }
        return inTarget / letters.length < this._settings.current.skipThreshold / 100;
    }

    _letters(text) {
        MASK_RE.lastIndex = 0;
        NON_LETTER.lastIndex = 0;
        return Array.from(text.replace(MASK_RE, " ").replace(NON_LETTER, ""));
    }
}
