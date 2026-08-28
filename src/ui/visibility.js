// 번역 블록 전체가 IntersectionObserver 하나를 공유한다. 활발한 채널에서는
// 블록이 수백 개 마운트된 채로 있어, 메시지마다 observer 를 만들면 스크롤 중
// 비용이 눈에 띈다.

// 뷰포트에 닿은 뒤에야 요청을 시작하면 스크롤 중 번역문이 눈에 띄게 늦게 붙는다.
// 화면 밖 한 화면 정도를 미리 잡아 둔다.
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

// 반환값은 관찰 해제 함수. IntersectionObserver 를 못 쓰면 null.
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
