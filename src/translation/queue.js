// 동시 실행 수를 제한해 작업을 돌린다. 상한은 drain 때마다 지연 평가하므로
// 설정을 바꿔도 큐를 다시 만들 필요가 없다.
export class TaskQueue {
    constructor(concurrency) {
        this._limit = typeof concurrency === "function" ? concurrency : () => concurrency;
        this._active = 0;
        this._pending = [];
    }

    // shouldRun 은 작업이 큐 맨 앞에 왔을 때 다시 확인한다. 호출자가 관심을 잃은
    // 작업(화면 밖으로 나간 메시지)은 슬롯을 차지하지 않고 버려진다.
    run(task, shouldRun) {
        return new Promise((resolve, reject) => {
            this._pending.push({ task, resolve, reject, shouldRun });
            this._drain();
        });
    }

    // 대기 중인 호출자를 방치하지 않고 reject 한다. settle 되지 않는 Promise 는
    // UI 를 "번역 중…" 에 영원히 묶어 둔다.
    clear() {
        const dropped = this._pending;
        this._pending = [];
        for (const { reject } of dropped) {
            const err = new Error("취소됨");
            err.name = "AbortError";
            reject(err);
        }
    }

    _drain() {
        while (this._active < Math.max(1, this._limit() | 0) && this._pending.length > 0) {
            const { task, resolve, reject, shouldRun } = this._pending.shift();

            if (shouldRun && !shouldRun()) {
                const err = new Error("건너뜀");
                err.name = "SkippedError";
                reject(err);
                continue;
            }

            this._active += 1;
            Promise.resolve()
                .then(task)
                .then(resolve, reject)
                .finally(() => {
                    this._active -= 1;
                    this._drain();
                });
        }
    }
}
