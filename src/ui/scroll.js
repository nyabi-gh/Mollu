const SETTLE_MS = 180;
const SCROLLABLE = /auto|scroll|overlay/;

const waiting = new Set();
let lastScrollAt = 0;
let listening = false;
let settle = null;

function scrollParent(node) {
    for (let el = node?.parentElement; el; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight && SCROLLABLE.test(styleOf(el).overflowY)) return el;
    }
    return null;
}

export function blockHeight(node) {
    if (!node) return 0;
    const style = styleOf(node);
    const margins = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
    return node.getBoundingClientRect().height + margins;
}

// Discord's message list does not let the browser anchor its scroll position, so a block
// changing size above the viewport pushes whatever is being read out of place. Put the scroller
// back by exactly what the block took or gave up.
export function keepPlace(node, delta) {
    if (!node || !delta) return;

    const scroller = scrollParent(node);
    if (!scroller) return;
    if (node.getBoundingClientRect().top >= scroller.getBoundingClientRect().top) return;

    scroller.scrollTop += delta;
}

// Above the viewport keepPlace hides the growth and below it nothing visible moves, so the one
// shift a reader actually sees is a block landing on screen. Hold that case until the message
// has scrolled out of the way or the scrolling has stopped.
export function whenSteady(node, run) {
    const scroller = node ? scrollParent(node) : null;
    if (!scroller) {
        run();
        return () => {};
    }
    listen();

    const waiter = () => {
        if (!waiting.has(waiter)) return;
        if (Date.now() - lastScrollAt < SETTLE_MS && onScreen(node, scroller)) return;
        waiting.delete(waiter);
        run();
    };

    waiting.add(waiter);
    waiter();
    return () => waiting.delete(waiter);
}

export function disconnectScroll() {
    if (listening && typeof document !== "undefined") {
        document.removeEventListener("scroll", onScroll, LISTEN_OPTIONS);
    }
    clearTimeout(settle);
    settle = null;
    listening = false;
    lastScrollAt = 0;
    waiting.clear();
}

const LISTEN_OPTIONS = { capture: true, passive: true };

function listen() {
    if (listening || typeof document === "undefined") return;
    document.addEventListener("scroll", onScroll, LISTEN_OPTIONS);
    listening = true;
}

// Scroll events do not bubble, so one capturing listener stands in for every scroller Discord
// happens to be using.
function onScroll() {
    lastScrollAt = Date.now();
    sweep();

    clearTimeout(settle);
    settle = setTimeout(sweep, SETTLE_MS);
    settle?.unref?.();
}

function sweep() {
    for (const waiter of [...waiting]) waiter();
}

function onScreen(node, scroller) {
    const top = node.getBoundingClientRect().top;
    const view = scroller.getBoundingClientRect();
    return top >= view.top && top <= view.bottom;
}

function styleOf(node) {
    try {
        return getComputedStyle(node) || {};
    } catch {
        return {};
    }
}
