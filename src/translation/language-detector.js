import { MASK_PATTERN } from "./tokenizer.js";

// Hangul syllables + jamo (including half-width and extended blocks).
const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿ﾠ-ￜ]/;

/**
 * Decides whether a message should be translated. A message counts as Korean
 * (and is skipped) when the share of Hangul among its letters reaches the
 * configured threshold. Non-letters, code, links and Discord tokens are ignored
 * so "lol <@123> 😄" is judged only on "lol".
 */
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
        const stripped = text
            .replace(new RegExp(MASK_PATTERN, "g"), " ")
            .replace(/[^\p{L}]/gu, "");
        return Array.from(stripped);
    }
}
