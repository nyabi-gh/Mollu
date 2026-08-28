import { logger } from "./lib/logger.js";

// 설정 패널까지 들어가지 않고 자동 번역을 껐다 켜기 위한 전역 단축키.
// Discord 내부 구조에 기대지 않고 document 의 keydown 하나만 사용한다.

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

// 단축키를 "Ctrl+Shift+T" 문자열로 저장하던 시절의 값을 BD 형식으로 옮긴다.
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

/** @typedef {{ctrl: boolean, shift: boolean, alt: boolean, meta: boolean, key: string}} Combo */

// BD 의 keybind 입력은 누른 순서대로 event.key 를 모아 배열로 준다:
// ["Control", "Shift", "T"]. 비었거나 알아볼 수 없으면 null 이고, 그 경우 단축키는
// 그냥 붙지 않는다. 설정 하나가 플러그인 전체를 멈추면 안 된다.
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
            return null; // 키는 하나뿐이어야 한다
        } else {
            combo.key = name.toLowerCase();
        }
    }
    return combo.key ? combo : null;
}

export function matchesHotkey(combo, event) {
    if (!combo || !event || event.repeat) return false;
    // 한글을 조합하는 중에는 keydown 이 조합 키로 들어온다.
    if (event.isComposing) return false;

    // Shift 를 누르면 event.key 가 대문자로 오므로 소문자로 맞춰 비교한다.
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
        // capture 로 듣는다. Discord 는 자기 단축키를 버블 단계에서 처리하므로,
        // 입력 칸에 포커스가 있어도 우리 조합이 먼저 잡힌다.
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
