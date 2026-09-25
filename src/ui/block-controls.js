// Discord remounts a message whenever it scrolls back into view, so what the reader chose for a
// block has to outlive the block.
export class BlockControls {
    constructor({ translator }) {
        this._translator = translator;
        this._hidden = new Set();
        this._mounted = new Map();
    }

    mount(messageId, handle) {
        let handles = this._mounted.get(messageId);
        if (!handles) {
            handles = new Set();
            this._mounted.set(messageId, handles);
        }
        handles.add(handle);
        return () => {
            handles.delete(handle);
            if (!handles.size && this._mounted.get(messageId) === handles) this._mounted.delete(messageId);
        };
    }

    menuFor(messageId) {
        const handle = this._first(messageId);
        if (!handle) return null;
        const hidden = this._hidden.has(messageId);
        const status = handle.status();
        return {
            hidden,
            canHide: hidden || status === "done" || status === "error",
            canRetranslate: !hidden && this._translator.isCached(handle.text),
        };
    }

    isHidden(messageId) {
        return this._hidden.has(messageId);
    }

    setHidden(messageId, hidden) {
        if (hidden) this._hidden.add(messageId);
        else this._hidden.delete(messageId);
        for (const handle of this._mounted.get(messageId) ?? []) handle.refresh();
    }

    // The cache is keyed by text, so every block showing the same text is redone with it.
    retranslate(messageId) {
        const text = this._first(messageId)?.text;
        if (text == null) return;
        this._translator.forget(text);
        for (const handles of this._mounted.values()) {
            for (const handle of handles) if (handle.text === text) handle.retranslate();
        }
    }

    clear() {
        this._hidden.clear();
    }

    _first(messageId) {
        return this._mounted.get(messageId)?.values().next().value;
    }
}
