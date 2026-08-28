// Lightweight sanity checks with no test framework:
//   1. pure source logic (tokenizer round-trip, language detection)
//   2. the bundled plugin loads under a stub BdApi and exposes start/stop/settings
//
// Run with `npm test`. This is not a substitute for loading the plugin in
// BetterDiscord — the webpack lookup and React patching can only be verified there.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

function check(name, fn) {
    try {
        fn();
        console.log(`  ok  ${name}`);
    } catch (e) {
        failures += 1;
        console.error(`FAIL  ${name}\n      ${e.message}`);
    }
}

// --- 1. source logic ---------------------------------------------------------

const { mask, unmask } = await import("../src/translation/tokenizer.js");
const { LanguageDetector } = await import("../src/translation/language-detector.js");

check("tokenizer masks discord tokens and round-trips", () => {
    const original = "hey <@123456789012345678> look `const x = 1` https://example.com/a 😄";
    const { masked, tokens } = mask(original);
    assert.equal(tokens.length, 3, "mention + inline code + url");
    assert.ok(!masked.includes("123456789012345678"), "raw id is hidden from the model");
    assert.equal(unmask(masked, tokens), original);
});

check("tokenizer tolerates the model rewriting brackets", () => {
    const { tokens } = mask("call <@1> now");
    assert.equal(unmask("지금 [0] 호출해", tokens), "지금 <@1> 호출해");
});

const detector = new LanguageDetector({ current: { koreanThreshold: 30 } });

check("language detector: english needs translation", () => {
    assert.equal(detector.needsTranslation("Hello everyone, how are you?"), true);
});
check("language detector: korean is skipped", () => {
    assert.equal(detector.needsTranslation("안녕하세요 여러분 오늘 날씨 좋네요"), false);
});
check("language detector: laughter (jamo) is skipped", () => {
    assert.equal(detector.needsTranslation("ㅋㅋㅋㅋㅋ"), false);
});
check("language detector: japanese needs translation", () => {
    assert.equal(detector.needsTranslation("こんにちは、元気ですか"), true);
});
check("language detector: too short is skipped", () => {
    assert.equal(detector.needsTranslation("k"), false);
});

// --- 2. bundle smoke -------------------------------------------------------

installBdApiStub();
const bundlePath = join(root, "dist", "KoreanAutoTranslator.plugin.js");

let Plugin;
check("bundle loads under stub BdApi (BetterDiscord-style wrapper)", () => {
    Plugin = loadPlugin(bundlePath);
    assert.equal(typeof Plugin, "function", "module.exports is the plugin class");
});

check("plugin instance has the BetterDiscord lifecycle", () => {
    const instance = new Plugin({ name: "KoreanAutoTranslator", version: "1.0.0" });
    assert.equal(typeof instance.start, "function");
    assert.equal(typeof instance.stop, "function");
    assert.equal(typeof instance.getSettingsPanel, "function");
});

check("getSettingsPanel returns a panel spec with an onChange", () => {
    const instance = new Plugin({ name: "KoreanAutoTranslator" });
    const panel = instance.getSettingsPanel();
    assert.ok(Array.isArray(panel.__spec.settings) && panel.__spec.settings.length > 0);
    assert.equal(typeof panel.__spec.onChange, "function");
});

check("start() and stop() do not throw (webpack lookup fails gracefully)", () => {
    const instance = new Plugin({ name: "KoreanAutoTranslator" });
    instance.start();
    instance.stop();
});

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

// --- helpers ------------------------------------------------------------

// Mirrors how BetterDiscord evaluates a plugin file: wrap in a Function with
// require/module/exports and run it. Avoids Node's ESM/CJS handling entirely.
function loadPlugin(path) {
    const source = readFileSync(path, "utf8");
    const moduleObj = { filename: path, exports: {} };
    const wrapped = new Function("require", "module", "exports", "__filename", "__dirname", source);
    wrapped(() => ({}), moduleObj, moduleObj.exports, path, dirname(path));
    let exported = moduleObj.exports;
    if (exported && exported.default) exported = exported.default;
    return exported;
}

function installBdApiStub() {
    const noop = () => {};
    globalThis.BdApi = {
        React: {
            createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
            cloneElement: (el, props, ...children) => ({ ...el, props: { ...el.props, ...props, children } }),
            useState: (init) => [typeof init === "function" ? init() : init, noop],
            useEffect: noop,
            useRef: (v = null) => ({ current: v }),
            Fragment: "Fragment",
        },
        Data: { load: () => null, save: noop, delete: noop },
        DOM: { addStyle: noop, removeStyle: noop },
        UI: {
            buildSettingsPanel: (spec) => ({ __spec: spec }),
            showToast: noop,
        },
        Patcher: { after: () => noop, unpatchAll: noop },
        Logger: { info: noop, warn: noop, error: noop },
        Net: { fetch: async () => new Response("{}", { status: 200 }) },
        Webpack: {
            getStore: () => ({ getChannel: () => null, getCurrentUser: () => null }),
            *getWithKey() {
                yield null;
                yield null;
            },
            Filters: {
                byStrings: () => () => false,
                byComponentType: (f) => f,
                byDisplayName: () => () => false,
            },
        },
    };
}
