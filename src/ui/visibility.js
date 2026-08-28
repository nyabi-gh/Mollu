// One IntersectionObserver for every translation block, instead of one per
// message. A busy channel keeps hundreds of blocks mounted, and an observer
// each is a measurable cost while scrolling.

let observer = null;
const callbacks = new Map();

function ensure() {
    if (observer || typeof IntersectionObserver === "undefined") return observer;
    observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const onChange = callbacks.get(entry.target);
            if (onChange) onChange(entry.isIntersecting);
        }
    });
    return observer;
}

/**
 * @returns {(() => void) | null} unobserve, or null when unsupported
 */
export function observeVisibility(node, onChange) {
    const target = ensure();
    if (!target || !node) return null;

    callbacks.set(node, onChange);
    target.observe(node);

    return () => {
        target.unobserve(node);
        callbacks.delete(node);
    };
}

/** Tears the shared observer down when the plugin stops. */
export function disconnectVisibility() {
    if (observer) observer.disconnect();
    observer = null;
    callbacks.clear();
}
