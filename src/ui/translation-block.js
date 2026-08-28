import { React } from "../discord.js";
import { renderSegments } from "./rich-text.js";
import { observeVisibility } from "./visibility.js";
import { MAX_RATE_LIMIT_RETRIES } from "../constants.js";

// A message is only translated once it has actually been in the viewport for
// this long. Scrolling straight past a message never triggers a request.
const DWELL_MS = 350;

function initialResult(translator, text) {
    const known = translator.peek(text);
    return known.status === "done" || known.status === "skip" ? known : { status: "idle" };
}

/**
 * Rendered under a message. While idle it renders a zero-height anchor and
 * watches it with an IntersectionObserver; translation starts only when the
 * anchor becomes visible. Cache hits skip all of that and render immediately.
 */
export function TranslationBlock({ text, translator, settings, stores, guildId }) {
    const anchorRef = React.useRef(null);
    const { showPending, showErrors, autoTranslate } = useDisplaySettings(settings);
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

        const run = () => {
            if (!alive || running) return;
            running = true;
            translator
                .translate(text, {
                    // Only work that has actually left the queue shows "번역 중".
                    // Flipping every queued message at once would grow hundreds
                    // of messages by a line at the same time while scrolling.
                    onStart: () => {
                        if (alive) setResult({ status: "pending" });
                    },
                    shouldRun: () => alive && visible,
                })
                .then((res) => {
                    if (!alive) return;
                    running = false;

                    // Rate limited. The message is still on screen, so nothing
                    // else will re-trigger it: re-queue once the window passes.
                    if (res.status === "retry") {
                        setResult({ status: "idle" });
                        if (visible && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
                            rateLimitRetries += 1;
                            dwell = setTimeout(run, res.after + jitter());
                        } else {
                            setResult({ status: "error", message: "rate limited" });
                        }
                        return;
                    }

                    // Dropped while queued — wait for the message to come back.
                    setResult(res.status === "unknown" ? { status: "idle" } : res);
                });
        };

        triggerRef.current = run;

        // Manual mode: nothing is sent until the reader asks for it, so there
        // is no viewport to watch and the request is always wanted.
        if (!autoTranslate) {
            visible = true;
            return () => {
                alive = false;
            };
        }

        const stopObserving = observeVisibility(anchorRef.current, (isVisible) => {
            visible = isVisible;
            if (isVisible) {
                if (dwell == null && !running) dwell = setTimeout(run, DWELL_MS);
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
    }, [text, autoTranslate]);

    const status = result && result.status;

    // The anchor stays mounted in every state so its node identity — and the
    // visibility subscription attached to it — survives a status change.
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
            onTrigger: () => triggerRef.current?.(),
        }),
    );
}

// Spreads the retries of many blocks waking at once, so they do not all hit the
// provider on the same tick and trip the limit again.
function jitter() {
    return Math.floor(Math.random() * 2000);
}

function renderBody(status, result, { showPending, showErrors, stores, guildId, autoTranslate, onTrigger }) {
    if (status === "idle" && !autoTranslate) {
        return React.createElement(
            "button",
            { type: "button", className: "mollu-translation__trigger", onClick: onTrigger },
            "번역",
        );
    }
    if (!status || status === "idle" || status === "unknown" || status === "skip") return null;
    if (status === "retry") return null;
    if (status === "pending") {
        return showPending
            ? React.createElement(
                  "div",
                  { className: "mollu-translation mollu-translation--pending" },
                  "번역 중…",
              )
            : null;
    }
    if (status === "error") {
        return showErrors
            ? React.createElement(
                  "div",
                  { className: "mollu-translation mollu-translation--error" },
                  "번역 실패",
              )
            : null;
    }
    return React.createElement(
        "div",
        { className: "mollu-translation" },
        React.createElement("span", { className: "mollu-translation__badge" }, "KO"),
        React.createElement(
            "span",
            { className: "mollu-translation__text" },
            ...renderSegments(result.segments || [{ type: "text", value: result.text }], stores, guildId),
        ),
    );
}

/**
 * Mirrors the display-only settings into state, so toggling "번역 중 표시" or
 * "번역 실패 시 표시" updates blocks that are already on screen.
 */
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

// Settings the block reads while rendering, so a change has to re-render it.
const MIRRORED = new Set(["showPending", "showErrors", "autoTranslate"]);

function pickDisplay(settings) {
    const { showPending, showErrors, autoTranslate } = settings.current;
    return { showPending, showErrors, autoTranslate };
}
