// Looks ahead below the fold only, far enough that a message is usually translated before it
// is scrolled to: a request takes about a second, and the block then lands off screen
// instead of in front of the reader. Nothing above the viewport is worth a request.
const ROOT_MARGIN = "0px 0px 600px";

let observer = null;
const callbacks = new Map();

function ensure() {
    if (observer || typeof IntersectionObserver === "undefined") return observer;
    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const onChange = callbacks.get(entry.target);
                if (onChange) onChange(entry.isIntersecting);
            }
        },
        { rootMargin: ROOT_MARGIN },
    );
    return observer;
}

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

export function disconnectVisibility() {
    if (observer) observer.disconnect();
    observer = null;
    callbacks.clear();
}
