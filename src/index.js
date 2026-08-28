import { NAME, ERROR_TOAST_COOLDOWN_MS } from "./constants.js";
import { Settings } from "./settings.js";
import { Translator } from "./translation/translator.js";
import { LanguageDetector } from "./translation/language-detector.js";
import { MessagePatch } from "./message-patch.js";
import { findMessageContent, createStores } from "./discord.js";
import { hasNativeFetch } from "./lib/net.js";
import { STYLES } from "./ui/styles.js";
import { disconnectVisibility } from "./ui/visibility.js";
import { t } from "./i18n.js";
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
                stores: createStores(),
            });
            this._patch.install();

            if (!this._settings.current.apiKey) {
                this._toast(t("toast.needApiKey"), "info");
            }
            if (this._settings.guildIdSet.size === 0) {
                this._toast(t("toast.needGuilds"), "info");
            }

            logger.info(`started · ${this._settings.guildIdSet.size} target server(s)`);
        } catch (e) {
            logger.error("start failed", e);
        }
    }

    stop() {
        try {
            this._patch?.remove();
        } catch (e) {
            logger.error("unpatch failed", e);
        }
        // 패치는 걸렸는데 _patch 참조를 잃은 경우를 대비한 안전망.
        BdApi.Patcher.unpatchAll(NAME);
        BdApi.DOM.removeStyle(NAME);
        disconnectVisibility();
        this._translator.stop();
        this._patch = null;
        logger.info("stopped");
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
