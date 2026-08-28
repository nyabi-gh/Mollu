import { React } from "../discord.js";
import { renderSegments } from "./rich-text.js";
import { observeVisibility } from "./visibility.js";
import { MAX_RATE_LIMIT_RETRIES } from "../constants.js";
import { badgeFor } from "../languages.js";
import { t } from "../i18n.js";

const DWELL_MS = 350;

function initialResult(translator, text) {
    const known = translator.peek(text);
    return known.status === "done" || known.status === "skip" ? known : { status: "idle" };
}

export function TranslationBlock({ text, translator, settings, stores, guildId }) {
    const anchorRef = React.useRef(null);
    const { showPending, showErrors, autoTranslate, targetLanguage, maxChars } = useDisplaySettings(settings);
    const triggerRef = React.useRef(null);
    const [result, setResult] = React.useState(() => initialResult(translator, text));

    React.useEffect(() => {
        let alive = true;
        let visible = false;
        let dwell = null;
        let running = false;
        let rateLimitRetries = 0;

        const known = translator.peek(text);
        if (known.status === "done" || known.status === "skip") {
            setResult(known);
            return undefined;
        }
        setResult({ status: "idle" });

        const schedule = (delay) => {
            dwell = setTimeout(() => {
                dwell = null;
                run();
            }, delay);
        };

        const run = (force) => {
            if (!alive || running) return;
            running = true;
            if (force) rateLimitRetries = 0;
            translator
                .translate(text, {
                    ignoreBackoff: force === true,

                    onStart: () => {
                        if (alive) setResult({ status: "pending" });
                    },
                    shouldRun: () => alive && visible,
                })
                .then((res) => {
                    if (!alive) return;
                    running = false;

                    if (res.status === "retry") {
                        setResult({ status: "idle" });
                        if (visible && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
                            rateLimitRetries += 1;
                            schedule(res.after + jitter());
                        } else {
                            setResult({ status: "error", message: t("error.rateLimited") });
                        }
                        return;
                    }

                    setResult(res.status === "unknown" ? { status: "idle" } : res);
                });
        };

        triggerRef.current = run;

        if (!autoTranslate) {
            visible = true;
            return () => {
                alive = false;
            };
        }

        const stopObserving = observeVisibility(anchorRef.current, (isVisible) => {
            visible = isVisible;
            if (isVisible) {
                if (dwell == null && !running) schedule(DWELL_MS);
            } else if (dwell != null) {
                clearTimeout(dwell);
                dwell = null;
            }
        });

        if (!stopObserving) {
            visible = true;
            run();
            return () => {
                alive = false;
            };
        }

        return () => {
            alive = false;
            stopObserving();
            if (dwell != null) clearTimeout(dwell);
        };
    }, [text, autoTranslate, targetLanguage, maxChars]);

    const status = result && result.status;

    return React.createElement(
        React.Fragment,
        null,
        React.createElement("div", {
            ref: anchorRef,
            className: "mollu-translation__anchor",
            "aria-hidden": "true",
        }),
        renderBody(status, result, {
            showPending,
            showErrors,
            stores,
            guildId,
            autoTranslate,
            badge: badgeFor(targetLanguage),
            onTrigger: () => triggerRef.current?.(true),
        }),
    );
}

function jitter() {
    return Math.floor(Math.random() * 2000);
}

function renderBody(status, result, ctx) {
    const { showPending, showErrors, stores, guildId, autoTranslate, onTrigger, badge } = ctx;
    if (status === "idle" && !autoTranslate) {
        return React.createElement(
            "button",
            { type: "button", className: "mollu-translation__trigger", onClick: onTrigger },
            t("block.trigger"),
        );
    }
    if (!status || status === "idle" || status === "unknown" || status === "skip") return null;
    if (status === "retry") return null;
    if (status === "pending") {
        return showPending
            ? React.createElement(
                  "div",
                  { className: "mollu-translation mollu-translation--pending" },
                  t("block.pending"),
              )
            : null;
    }
    if (status === "error") {
        return showErrors
            ? React.createElement(
                  "button",
                  {
                      type: "button",
                      className: "mollu-translation mollu-translation--error",
                      title: t("block.errorTitle", { message: result?.message || "" }),
                      onClick: onTrigger,
                  },
                  t("block.error"),
              )
            : null;
    }
    return React.createElement(
        "div",
        { className: "mollu-translation" },
        React.createElement("span", { className: "mollu-translation__badge" }, badge),
        React.createElement(
            "span",
            { className: "mollu-translation__text" },
            ...renderSegments(result.segments || [{ type: "text", value: result.text }], stores, guildId),
        ),
    );
}

function useDisplaySettings(settings) {
    const [display, setDisplay] = React.useState(() => pickDisplay(settings));

    React.useEffect(() => {
        const unsubscribe = settings.onChange((id) => {
            if (MIRRORED.has(id)) setDisplay(pickDisplay(settings));
        });
        return () => {
            unsubscribe();
        };
    }, [settings]);

    return display;
}

const MIRRORED = new Set(["showPending", "showErrors", "autoTranslate", "targetLanguage", "maxChars"]);

function pickDisplay(settings) {
    const { showPending, showErrors, autoTranslate, targetLanguage, maxChars } = settings.current;
    return { showPending, showErrors, autoTranslate, targetLanguage, maxChars };
}
