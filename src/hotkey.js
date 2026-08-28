import { logger } from "./lib/logger.js";

const MODIFIERS = {
    control: "ctrl",
    ctrl: "ctrl",
    shift: "shift",
    alt: "alt",
    option: "alt",
    meta: "meta",
    cmd: "meta",
    command: "meta",
    os: "meta",
};

const KEY_NAMES = {
    ctrl: "Control",
    control: "Control",
    shift: "Shift",
    alt: "Alt",
    option: "Alt",
    cmd: "Meta",
    command: "Meta",
    meta: "Meta",
};

export function keysFromString(raw) {
    return String(raw || "")
        .split("+")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => KEY_NAMES[part.toLowerCase()] ?? (part.length === 1 ? part.toUpperCase() : part));
}

export function parseHotkey(keys) {
    const list = Array.isArray(keys) ? keys : keysFromString(keys);
    if (list.length === 0) return null;

    const combo = { ctrl: false, shift: false, alt: false, meta: false, key: "" };
    for (const entry of list) {
        const name = String(entry ?? "").trim();
        if (!name) continue;

        const modifier = MODIFIERS[name.toLowerCase()];
        if (modifier) {
            combo[modifier] = true;
        } else if (combo.key) {
            return null;
        } else {
            combo.key = name.toLowerCase();
        }
    }
    return combo.key ? combo : null;
}

export function matchesHotkey(combo, event) {
    if (!combo || !event || event.repeat) return false;

    if (event.isComposing) return false;

    if (String(event.key || "").toLowerCase() !== combo.key) return false;

    return (
        event.ctrlKey === combo.ctrl &&
        event.shiftKey === combo.shift &&
        event.altKey === combo.alt &&
        event.metaKey === combo.meta
    );
}

export class Hotkey {
    constructor({ settings, field, onTrigger }) {
        this._settings = settings;
        this._field = field;
        this._onTrigger = onTrigger;
        this._combo = null;
        this._unsubscribe = null;
        this._onKeyDown = (event) => {
            if (!matchesHotkey(this._combo, event)) return;
            event.preventDefault();
            event.stopPropagation();
            this._onTrigger();
        };
    }

    install() {
        if (typeof document === "undefined") return;
        this._apply(this._settings.current[this._field]);
        this._unsubscribe = this._settings.onChange((id, value) => {
            if (id === this._field) this._apply(value);
        });

        document.addEventListener("keydown", this._onKeyDown, true);
    }

    remove() {
        if (typeof document !== "undefined") {
            document.removeEventListener("keydown", this._onKeyDown, true);
        }
        this._unsubscribe?.();
        this._unsubscribe = null;
        this._combo = null;
    }

    _apply(raw) {
        this._combo = parseHotkey(raw);
        if (raw?.length && !this._combo) {
            logger.warn(`unrecognised ${this._field}: ${JSON.stringify(raw)}`);
        }
    }
}
