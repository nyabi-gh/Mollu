export class TaskQueue {
    constructor(concurrency) {
        this._limit = typeof concurrency === "function" ? concurrency : () => concurrency;
        this._active = 0;
        this._pending = [];
    }

    // An urgent task starts at once, past the concurrency limit: someone is waiting on it.
    run(task, shouldRun, { urgent = false } = {}) {
        return new Promise((resolve, reject) => {
            const entry = { task, resolve, reject, shouldRun };
            if (urgent) {
                this._start(entry);
                return;
            }
            this._pending.push(entry);
            this._drain();
        });
    }

    clear() {
        const dropped = this._pending;
        this._pending = [];
        for (const { reject } of dropped) {
            const err = new Error("cancelled");
            err.name = "AbortError";
            reject(err);
        }
    }

    _drain() {
        while (this._active < Math.max(1, this._limit() | 0) && this._pending.length > 0) {
            const entry = this._pending.shift();

            if (entry.shouldRun && !entry.shouldRun()) {
                const err = new Error("skipped");
                err.name = "SkippedError";
                entry.reject(err);
                continue;
            }

            this._start(entry);
        }
    }

    _start({ task, resolve, reject }) {
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
