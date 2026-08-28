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

    run(task) {
        return new Promise((resolve, reject) => {
            this._pending.push({ task, resolve, reject });
            this._drain();
        });
    }

    clear() {
        this._pending = [];
    }

    _drain() {
        while (this._active < Math.max(1, this._limit() | 0) && this._pending.length > 0) {
            const { task, resolve, reject } = this._pending.shift();
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
