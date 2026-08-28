const ROOT_MARGIN = "200px 0px";

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
