import { React } from "../discord.js";
import { renderSegments } from "./rich-text.js";
import { observeVisibility } from "./visibility.js";
import { MAX_RATE_LIMIT_RETRIES } from "../constants.js";
import { t } from "../i18n.js";

// 이 시간만큼 실제로 화면에 머문 메시지만 번역한다. 스크롤로 스쳐 지나간
// 메시지는 요청을 만들지 않는다.
const DWELL_MS = 350;

function initialResult(translator, text) {
    const known = translator.peek(text);
    return known.status === "done" || known.status === "skip" ? known : { status: "idle" };
}

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
                    // 큐를 실제로 떠난 작업만 "번역 중" 을 띄운다. 큐에 넣는
                    // 시점에 띄우면 스크롤 중 수백 개 메시지가 동시에 한 줄씩
                    // 커지면서 화면이 밀린다.
                    onStart: () => {
                        if (alive) setResult({ status: "pending" });
                    },
                    shouldRun: () => alive && visible,
                })
                .then((res) => {
                    if (!alive) return;
                    running = false;

                    // 한도 초과. 메시지가 아직 화면에 있으면 다시 트리거될 일이
                    // 없으므로, 대기 시간이 지난 뒤 직접 다시 큐에 넣는다.
                    if (res.status === "retry") {
                        setResult({ status: "idle" });
                        if (visible && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
                            rateLimitRetries += 1;
                            dwell = setTimeout(run, res.after + jitter());
                        } else {
                            setResult({ status: "error", message: t("error.rateLimited") });
                        }
                        return;
                    }

                    // 큐에서 버려진 경우 — 메시지가 다시 보일 때까지 기다린다.
                    setResult(res.status === "unknown" ? { status: "idle" } : res);
                });
        };

        triggerRef.current = run;

        // 수동 모드에서는 사용자가 누르기 전까지 아무것도 보내지 않으므로,
        // 관찰할 뷰포트가 없고 요청은 항상 유효하다.
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

    // 앵커는 모든 상태에서 마운트를 유지한다. 그래야 노드 identity 와 거기 붙은
    // 가시성 구독이 상태 변화를 넘어 살아남는다.
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
            badge: settings.current.targetLanguage.toUpperCase(),
            onTrigger: () => triggerRef.current?.(),
        }),
    );
}

// 동시에 깨어난 블록들의 재시도를 흩뜨린다. 안 그러면 같은 틱에 몰려 나가 또
// 한도를 친다.
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
                  "div",
                  { className: "mollu-translation mollu-translation--error" },
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

// 표시용 설정을 state 로 미러링한다. 그래야 토글이 이미 화면에 있는 블록에도
// 즉시 반영된다.
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

// 블록이 렌더 중에 읽는 설정. 바뀌면 다시 렌더해야 한다.
const MIRRORED = new Set(["showPending", "showErrors", "autoTranslate"]);

function pickDisplay(settings) {
    const { showPending, showErrors, autoTranslate } = settings.current;
    return { showPending, showErrors, autoTranslate };
}
