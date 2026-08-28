/**
 * Runs async tasks with a bounded concurrency. The limit is read lazily on every
 * drain so a settings change takes effect without recreating the queue.
 */
export class TaskQueue {
    constructor(concurrency) {
        this._limit = typeof concurrency === "function" ? concurrency : () => concurrency;
        this._active = 0;
        this._pending = [];
    }

    /**
     * @param {() => Promise<any>} task
     * @param {() => boolean} [shouldRun] checked when the task reaches the front
     *   of the queue; a task whose caller has lost interest (a message scrolled
     *   out of view) is dropped instead of occupying a slot.
     */
    run(task, shouldRun) {
        return new Promise((resolve, reject) => {
            this._pending.push({ task, resolve, reject, shouldRun });
            this._drain();
        });
    }

    /**
     * Drops queued work. Waiting callers are rejected rather than left hanging —
     * a never-settled promise would strand the UI on "번역 중…" forever.
     */
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
