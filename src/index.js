import { NAME, ERROR_TOAST_COOLDOWN_MS } from "./constants.js";
import { Settings } from "./settings.js";
import { Translator } from "./translation/translator.js";
import { LanguageDetector } from "./translation/language-detector.js";
import { MessagePatch } from "./message-patch.js";
import { findMessageContent, createStores } from "./discord.js";
import { hasNativeFetch } from "./lib/net.js";
import { STYLES } from "./ui/styles.js";
import { logger } from "./lib/logger.js";

export default class KoreanAutoTranslator {
    constructor(meta) {
        this._meta = meta;
        this._settings = new Settings();
        this._detector = new LanguageDetector(this._settings);
        this._translator = new Translator({
            settings: this._settings,
            onError: (err) => this._notifyError(err),
        });
        this._patch = null;
        this._lastErrorToast = 0;
    }

    getName() {
        return this._meta?.name ?? NAME;
    }

    getSettingsPanel() {
        return this._settings.buildPanel();
    }

    start() {
        try {
            BdApi.DOM.addStyle(NAME, STYLES);
            this._translator.start();

            if (!hasNativeFetch()) {
                this._toast(
                    "BetterDiscord가 오래되어 API 요청이 차단될 수 있습니다. 최신 버전으로 업데이트하세요.",
                    "warning",
                );
            }

            const target = findMessageContent();
            if (!target) {
                logger.error(
                    "MessageContent 모듈을 찾지 못했습니다. Discord 내부 구조가 바뀌었을 수 있습니다.",
                );
                this._toast("메시지 컴포넌트를 찾지 못했습니다. 콘솔 로그를 확인하세요.", "error");
                return;
            }

            this._patch = new MessagePatch({
                target,
                settings: this._settings,
                translator: this._translator,
                languageDetector: this._detector,
                stores: createStores(),
            });
            this._patch.install();

            if (!this._settings.current.apiKey) {
                this._toast("설정에서 DeepSeek API 키를 입력하세요.", "info");
            }
            if (this._settings.guildIdSet.size === 0) {
                this._toast("설정에서 대상 서버 ID를 추가하세요.", "info");
            }

            logger.info(`시작됨 · 대상 서버 ${this._settings.guildIdSet.size}개`);
        } catch (e) {
            logger.error("start 실패", e);
        }
    }

    stop() {
        try {
            this._patch?.remove();
        } catch (e) {
            logger.error("patch 해제 실패", e);
        }
        // Safety net in case a patch was registered but `_patch` was lost.
        BdApi.Patcher.unpatchAll(NAME);
        BdApi.DOM.removeStyle(NAME);
        this._translator.stop();
        this._patch = null;
        logger.info("중지됨");
    }

    _notifyError(err) {
        if (!this._settings.current.showErrors) return;
        const now = Date.now();
        if (now - this._lastErrorToast < ERROR_TOAST_COOLDOWN_MS) return;
        this._lastErrorToast = now;
        this._toast(`번역 실패 · ${(err && err.message) || "unknown"}`, "error");
    }

    _toast(message, type) {
        try {
            BdApi.UI.showToast(`${NAME}: ${message}`, { type, timeout: 6000, forceShow: true });
        } catch {
            /* ignore */
        }
    }
}
