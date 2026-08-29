import {
    NAME,
    ERROR_TOAST_COOLDOWN_MS,
    UPDATE_CHECK_INTERVAL_MS,
    UPDATE_CHECK_DELAY_MS,
} from "./constants.js";
import { Settings } from "./settings.js";
import { Translator } from "./translation/translator.js";
import { LanguageDetector } from "./translation/language-detector.js";
import { MessagePatch } from "./message-patch.js";
import { Hotkey } from "./hotkey.js";
import { OutgoingPatch, findMessageActions } from "./outgoing-patch.js";
import { Updater } from "./updater.js";
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
        this._settings = new Settings({
            clearCache: () => this._confirmClearCache(),
            checkUpdate: () => this._updater.check({ announce: true }),
        });
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
        this._updater = new Updater({
            meta,
            settings: this._settings,
            interval: UPDATE_CHECK_INTERVAL_MS,
            delay: UPDATE_CHECK_DELAY_MS,
            onResult: (result) => this._reportUpdate(result),
        });
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

            for (const hotkey of this._hotkeys) hotkey.install();
            this._updater.start();

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
            const { provider, targetLanguage, autoTranslate, allGuilds, translateDms } =
                this._settings.current;
            if (!allGuilds && this._settings.guildIdSet.size === 0 && !translateDms) {
                this._toast(t("toast.needGuilds"), "info");
            }

            logger.info(
                `started · provider=${provider} target=${targetLanguage} ` +
                    `mode=${autoTranslate ? "auto" : "manual"} ` +
                    `servers=${allGuilds ? "all" : this._settings.guildIdSet.size} ` +
                    `dms=${translateDms ? "on" : "off"} ` +
                    `outgoing=${this._outgoing ? this._settings.current.outgoingLanguage : "unavailable"}`,
            );
        } catch (e) {
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

        for (const hotkey of this._hotkeys) hotkey.remove();
        this._updater.stop();

        BdApi.Patcher.unpatchAll(NAME);
        BdApi.DOM.removeStyle(NAME);
        disconnectVisibility();
        this._translator.stop();
        this._patch = null;
        this._outgoing = null;
        logger.info("stopped");
    }

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

    _confirmClearCache() {
        const count = this._translator.cacheSize;
        const clear = () => {
            this._translator.clearCache();
            this._toast(t("toast.cacheCleared", { count }), "info");
        };
        try {
            BdApi.UI.showConfirmationModal(t("clearCache.title"), t("clearCache.body", { count }), {
                danger: true,
                confirmText: t("clearCache.confirm"),
                cancelText: t("clearCache.cancel"),
                onConfirm: clear,
            });
        } catch (e) {
            logger.warn("confirmation modal unavailable", e);
            clear();
        }
    }

    _reportUpdate({ status, version, message }) {
        if (status === "updated") this._toast(t("toast.updated", { version }), "success");
        else if (status === "current") this._toast(t("toast.upToDate", { version }), "info");
        else if (status === "unavailable") this._toast(t("toast.updateUnavailable"), "warning");
        else this._toast(t("toast.updateFailed", { message: message || "unknown" }), "error");
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
        } catch {}
    }
}
