import { NAME, ERROR_TOAST_COOLDOWN_MS } from "./constants.js";
import { Settings } from "./settings.js";
import { Translator } from "./translation/translator.js";
import { LanguageDetector } from "./translation/language-detector.js";
import { MessagePatch } from "./message-patch.js";
import { Hotkey } from "./hotkey.js";
import { OutgoingPatch, findMessageActions } from "./outgoing-patch.js";
import { findMessageContent, createStores } from "./discord.js";
import { hasNativeFetch } from "./lib/net.js";
import { STYLES } from "./ui/styles.js";
import { disconnectVisibility } from "./ui/visibility.js";
import { t } from "./i18n.js";
import { getLanguage } from "./languages.js";
import { logger } from "./lib/logger.js";

export default class Mollu {
    constructor(meta) {
        this._meta = meta;
        this._settings = new Settings();
        this._detector = new LanguageDetector(this._settings);
        this._translator = new Translator({
            settings: this._settings,
            onError: (err) => this._notifyError(err),
        });
        this._patch = null;
        this._outgoing = null;
        this._hotkeys = [
            new Hotkey({
                settings: this._settings,
                field: "hotkey",
                onTrigger: () => this._toggle("autoTranslate", "toast.autoOn", "toast.autoOff"),
            }),
            new Hotkey({
                settings: this._settings,
                field: "outgoingHotkey",
                onTrigger: () => this._toggle("translateOutgoing", "toast.outgoingOn", "toast.outgoingOff"),
            }),
        ];
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
            // 패치가 실패해도 단축키는 붙여 둔다. 설정을 되돌릴 길이 남아야 한다.
            for (const hotkey of this._hotkeys) hotkey.install();

            // 두 패치가 같은 스토어 파사드를 쓴다. 웹팩 조회를 한 번만 한다.
            const stores = createStores();
            this._installOutgoing(stores);

            if (!hasNativeFetch()) {
                this._toast(t("toast.outdatedBd"), "warning");
            }

            const target = findMessageContent();
            if (!target) {
                logger.error("MessageContent not found; Discord's internals may have changed");
                this._toast(t("toast.noMessageContent"), "error");
                return;
            }

            this._patch = new MessagePatch({
                target,
                settings: this._settings,
                translator: this._translator,
                languageDetector: this._detector,
                stores,
            });
            this._patch.install();

            if (!this._settings.current.apiKey) {
                this._toast(t("toast.needApiKey"), "info");
            }
            const { provider, targetLanguage, autoTranslate, allGuilds } = this._settings.current;
            if (!allGuilds && this._settings.guildIdSet.size === 0) {
                this._toast(t("toast.needGuilds"), "info");
            }

            logger.info(
                `started · provider=${provider} target=${targetLanguage} ` +
                    `mode=${autoTranslate ? "auto" : "manual"} ` +
                    `servers=${allGuilds ? "all" : this._settings.guildIdSet.size} ` +
                    `outgoing=${this._outgoing ? this._settings.current.outgoingLanguage : "unavailable"}`,
            );
        } catch (e) {
            // 여기까지 온 실패는 대개 Discord 내부 구조 변경이다. 조용히 두면
            // "설치는 됐는데 아무 일도 안 일어남" 으로만 보인다.
            logger.error("start failed", e);
            this._toast(t("toast.startFailed", { message: (e && e.message) || "unknown" }), "error");
        }
    }

    stop() {
        try {
            this._patch?.remove();
        } catch (e) {
            logger.error("unpatch failed", e);
        }
        try {
            this._outgoing?.remove();
        } catch (e) {
            logger.error("outgoing unpatch failed", e);
        }
        // 패치 해제가 실패해도 키 리스너는 반드시 떼야 한다. 남으면 플러그인을
        // 껐는데도 단축키가 동작한다.
        for (const hotkey of this._hotkeys) hotkey.remove();
        // 패치는 걸렸는데 _patch 참조를 잃은 경우를 대비한 안전망.
        BdApi.Patcher.unpatchAll(NAME);
        BdApi.DOM.removeStyle(NAME);
        disconnectVisibility();
        this._translator.stop();
        this._patch = null;
        this._outgoing = null;
        logger.info("stopped");
    }

    // 보내는 메시지 번역은 자동 번역과 달리 남에게 나가는 글을 바꾸므로, 찾지
    // 못하면 조용히 없는 기능이 된다. 번역 자체는 그와 무관하게 계속 동작한다.
    _installOutgoing(stores) {
        const target = findMessageActions();
        if (!target) {
            logger.warn("MessageActions not found; outgoing translation is unavailable");
            return;
        }
        this._outgoing = new OutgoingPatch({
            target,
            settings: this._settings,
            translator: this._translator,
            languageDetector: this._detector,
            stores,
            onFailure: (message) => this._toast(t("toast.outgoingFailed", { message }), "error"),
        });
        this._outgoing.install();
    }

    _toggle(id, onKey, offKey) {
        const next = !this._settings.current[id];
        this._settings.set(id, next);
        const language = getLanguage(this._settings.current.outgoingLanguage).label;
        this._toast(t(next ? onKey : offKey, { language }), "info");
    }

    _notifyError(err) {
        if (!this._settings.current.showErrors) return;
        const now = Date.now();
        if (now - this._lastErrorToast < ERROR_TOAST_COOLDOWN_MS) return;
        this._lastErrorToast = now;
        this._toast(t("toast.failed", { message: (err && err.message) || "unknown" }), "error");
    }

    _toast(message, type) {
        try {
            BdApi.UI.showToast(`${NAME}: ${message}`, { type, timeout: 6000, forceShow: true });
        } catch {
            /* ignore */
        }
    }
}
