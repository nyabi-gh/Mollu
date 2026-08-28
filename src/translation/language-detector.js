import { MASK_PATTERN } from "./tokenizer.js";
import { getLanguage } from "../languages.js";
import { DEFAULT_SETTINGS } from "../constants.js";

const MASK_RE = new RegExp(MASK_PATTERN, "g");
const NON_LETTER = /[^\p{L}]/gu;

export class LanguageDetector {
    constructor(settings) {
        this._settings = settings;
    }

    needsTranslation(text, language) {
        if (typeof text !== "string") return false;
        const letters = this._letters(text);
        if (letters.length < 2) return false;

        const { script } = getLanguage(language ?? this._settings.current.targetLanguage);

        if (!script) return true;

        let inTarget = 0;
        for (const ch of letters) {
            if (script.test(ch)) inTarget += 1;
        }
        return inTarget / letters.length < this._threshold();
    }

    _threshold() {
        const raw = this._settings.current.skipThreshold;

        const configured = typeof raw === "number" ? raw : Number.parseFloat(raw);
        const percent = Number.isFinite(configured) ? configured : DEFAULT_SETTINGS.skipThreshold;
        return percent / 100;
    }

    _letters(text) {
        MASK_RE.lastIndex = 0;
        NON_LETTER.lastIndex = 0;
        return Array.from(text.replace(MASK_RE, " ").replace(NON_LETTER, ""));
    }
}
