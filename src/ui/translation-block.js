import { React } from "../discord.js";
import { renderSegments } from "./rich-text.js";
import { observeVisibility } from "./visibility.js";
import { MAX_RATE_LIMIT_RETRIES } from "../constants.js";
import { badgeFor } from "../languages.js";
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

        // 타이머가 발화하면 핸들을 비운다. 남겨 두면 아래 재예약 조건에 걸려
        // 다시 화면에 들어와도 요청이 나가지 않는다.
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
                            schedule(res.after + jitter());
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
        // 대상 언어나 길이 제한이 바뀌면 판정이 달라진다. 이미 화면에 있는
        // 블록도 그 자리에서 다시 판단해야 설정이 즉시 반영된 것처럼 보인다.
    }, [text, autoTranslate, targetLanguage, maxChars]);

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
            badge: badgeFor(targetLanguage),
            onTrigger: () => triggerRef.current?.(true),
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
        // 실패는 막다른 길이면 안 된다. 눌러서 다시 시도할 수 있게 한다.
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

// 블록이 렌더 중에 읽거나 번역 여부를 다시 정하는 데 쓰는 설정. 바뀌면 다시
// 렌더해야 한다. skipThreshold 는 여기 없다 — 그 판정은 블록이 붙기 전에
// message-patch.js 에서 끝나므로 메시지가 다시 렌더되어야 반영된다.
const MIRRORED = new Set(["showPending", "showErrors", "autoTranslate", "targetLanguage", "maxChars"]);

function pickDisplay(settings) {
    const { showPending, showErrors, autoTranslate, targetLanguage, maxChars } = settings.current;
    return { showPending, showErrors, autoTranslate, targetLanguage, maxChars };
}
