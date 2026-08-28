import { React } from "../discord.js";

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
export function TranslationBlock({ text, translator, settings }) {
    const anchorRef = React.useRef(null);
    const [result, setResult] = React.useState(() => initialResult(translator, text));

    React.useEffect(() => {
        let alive = true;

        const known = translator.peek(text);
        if (known.status === "done" || known.status === "skip") {
            setResult(known);
            return undefined;
        }
        setResult({ status: "idle" });

        const run = () => {
            if (!alive) return;
            setResult({ status: "pending" });
            translator.translate(text).then((res) => {
                if (alive) setResult(res);
            });
        };

        const node = anchorRef.current;
        if (!node || typeof IntersectionObserver === "undefined") {
            run();
            return () => {
                alive = false;
            };
        }

        let dwell = null;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.some((e) => e.isIntersecting);
            if (visible && dwell == null) {
                dwell = setTimeout(() => {
                    observer.disconnect();
                    run();
                }, DWELL_MS);
            } else if (!visible && dwell != null) {
                clearTimeout(dwell);
                dwell = null;
            }
        });
        observer.observe(node);

        return () => {
            alive = false;
            observer.disconnect();
            if (dwell != null) clearTimeout(dwell);
        };
    }, [text]);

    const { showPending, showErrors } = settings.current;
    const status = result && result.status;

    if (status === "idle") {
        return React.createElement("div", {
            ref: anchorRef,
            className: "kat-translation__anchor",
            "aria-hidden": "true",
        });
    }
    if (!status || status === "unknown" || status === "skip") return null;
    if (status === "pending") {
        return showPending
            ? React.createElement("div", { className: "kat-translation kat-translation--pending" }, "번역 중…")
            : null;
    }
    if (status === "error") {
        return showErrors
            ? React.createElement("div", { className: "kat-translation kat-translation--error" }, "번역 실패")
            : null;
    }
    return React.createElement(
        "div",
        { className: "kat-translation" },
        React.createElement("span", { className: "kat-translation__badge" }, "KO"),
        React.createElement("span", { className: "kat-translation__text" }, result.text),
    );
}
