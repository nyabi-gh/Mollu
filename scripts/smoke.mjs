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

async function checkAsync(name, fn) {
    try {
        await fn();
        console.log(`  ok  ${name}`);
    } catch (e) {
        failures += 1;
        console.error(`FAIL  ${name}\n      ${e.message}`);
    }
}

// --- 1. source logic ---------------------------------------------------------

const { mask, unmask } = await import("../src/translation/tokenizer.js");
const { LanguageDetector } = await import("../src/translation/language-detector.js");
const { normalizeBaseUrl } = await import("../src/lib/net.js");

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

check("tokenizer: a literal 【0】 in the source does not collide", () => {
    const original = "【0】 https://example.com/x";
    const { masked, tokens } = mask(original);
    assert.equal(masked, "【0】 【1】");
    assert.equal(unmask(masked, tokens), original);
});

check("tokenizer: ordinary '(1)' in a translation is not swallowed", () => {
    const { tokens } = mask("see https://a.example and https://b.example");
    assert.equal(
        unmask("【0】 와 【1】 를 보세요 (1)", tokens),
        "https://a.example 와 https://b.example 를 보세요 (1)",
    );
});

check("tokenizer: mismatched brackets are not placeholders", () => {
    const { tokens } = mask("call <@1> now");
    assert.equal(unmask("[0】 호출", tokens), "[0】 호출");
});

const { TaskQueue } = await import("../src/translation/queue.js");

await checkAsync("queue: clear() rejects waiting tasks instead of hanging", async () => {
    const queue = new TaskQueue(() => 1);
    const first = queue.run(() => new Promise((r) => setTimeout(() => r("a"), 20)));
    const second = queue.run(() => Promise.resolve("b"));
    queue.clear();
    await assert.rejects(second, (e) => e.name === "AbortError");
    assert.equal(await first, "a");
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
// Derived from meta.json so a rename cannot leave this pointing at a stale file.
const meta = JSON.parse(readFileSync(join(root, "meta.json"), "utf8"));
const bundlePath = join(root, "dist", `${meta.name}.plugin.js`);

let Plugin;
check("bundle loads under stub BdApi (BetterDiscord-style wrapper)", () => {
    Plugin = loadPlugin(bundlePath);
    assert.equal(typeof Plugin, "function", "module.exports is the plugin class");
});

check("plugin instance has the BetterDiscord lifecycle", () => {
    const instance = new Plugin({ name: meta.name, version: meta.version });
    assert.equal(typeof instance.start, "function");
    assert.equal(typeof instance.stop, "function");
    assert.equal(typeof instance.getSettingsPanel, "function");
});

check("getSettingsPanel returns a panel spec with an onChange", () => {
    const instance = new Plugin({ name: meta.name });
    const panel = instance.getSettingsPanel();
    assert.ok(Array.isArray(panel.__spec.settings) && panel.__spec.settings.length > 0);
    assert.equal(typeof panel.__spec.onChange, "function");
});

check("start() and stop() do not throw (webpack lookup fails gracefully)", () => {
    const instance = new Plugin({ name: meta.name });
    instance.start();
    instance.stop();
});

// --- 3. cache / token-restore regressions ----------------------------------

await checkAsync("queue: work whose caller lost interest is dropped, not run", async () => {
    const queue = new TaskQueue(() => 1);
    let ran = 0;
    const block = queue.run(() => new Promise((r) => setTimeout(r, 20)));
    const skipped = queue.run(
        () => {
            ran += 1;
        },
        () => false,
    );
    const kept = queue.run(() => {
        ran += 1;
        return "ok";
    });

    await assert.rejects(skipped, (e) => e.name === "SkippedError");
    await block;
    assert.equal(await kept, "ok", "a dropped task must not block the queue");
    assert.equal(ran, 1, "the dropped task never ran");
});

const { TranslationCache } = await import("../src/translation/cache.js");
const { Translator } = await import("../src/translation/translator.js");
const { CACHE_LIMIT, CACHE_KEY, NAME, LEGACY_NAMES } = await import("../src/constants.js");

check("cache: save() keeps the newest entries, not the oldest", () => {
    const saved = captureSave(() => {
        const cache = new TranslationCache();
        for (let i = 0; i < CACHE_LIMIT + 5; i += 1) cache.set(`k${i}`, `v${i}`);
        cache.save();
    });
    assert.equal(saved.length, CACHE_LIMIT);
    assert.ok(
        saved.some(([key]) => key === `k${CACHE_LIMIT + 4}`),
        "the most recent translation must survive trimming",
    );
    assert.ok(!saved.some(([key]) => key === "k0"), "the oldest entry is dropped first");
});

await checkAsync("translator: a shared cache key restores each message's own tokens", async () => {
    const previous = BdApi.Net.fetch;
    BdApi.Net.fetch = async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "안녕 【0】" } }] }), {
            status: 200,
        });
    try {
        const translator = new Translator({ settings: stubSettings() });
        const first = await translator.translate("hi <@111111111111111111>");
        const second = await translator.translate("hi <@222222222222222222>"); // same masked key
        assert.equal(first.text, "안녕 <@111111111111111111>");
        assert.equal(second.text, "안녕 <@222222222222222222>");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("translator: a failed translation is not retried immediately", async () => {
    const previous = BdApi.Net.fetch;
    let calls = 0;
    BdApi.Net.fetch = async () => {
        calls += 1;
        return new Response("nope", { status: 500 });
    };
    try {
        const translator = new Translator({ settings: stubSettings() });
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal(calls, 1, "the second attempt must be served from the failure backoff");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("translator: pending is reported on start, not on enqueue", async () => {
    const previous = BdApi.Net.fetch;
    BdApi.Net.fetch = async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "안녕" } }] }), { status: 200 });
    try {
        const translator = new Translator({ settings: stubSettings() });

        let started = false;
        const promise = translator.translate("hello there", { onStart: () => (started = true) });
        assert.equal(started, false, "enqueueing must not announce a start");
        await promise;
        assert.equal(started, true);

        // A message that scrolled away is answered as un-translated, and the
        // failure backoff must not treat that as an error.
        const dropped = await translator.translate("something else entirely", {
            shouldRun: () => false,
        });
        assert.equal(dropped.status, "unknown");
        assert.equal(translator._failures.size, 0, "a drop is not a failure");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

check("net: a plain-http base url is refused before the key is sent", () => {
    assert.throws(() => normalizeBaseUrl("http://evil.example"), /https/);
    assert.equal(normalizeBaseUrl("  https://api.deepseek.com/  "), "https://api.deepseek.com");
    assert.equal(normalizeBaseUrl("api.deepseek.com"), "https://api.deepseek.com");
});

// --- 4. rendering / settings ------------------------------------------------

const { renderSegments } = await import("../src/ui/rich-text.js");
const { Settings } = await import("../src/settings.js");

check("rich text: discord tokens render as elements, not raw markup", () => {
    const stores = {
        userName: (id) => (id === "1" ? "냐비" : null),
        channelName: () => "일반",
        roleName: () => null,
    };
    const nodes = renderSegments(
        [
            { type: "text", value: "안녕 " },
            { type: "token", value: "<@1>" },
            { type: "token", value: "<@2>" },
            { type: "token", value: "<#9>" },
            { type: "token", value: "<:hi:5>" },
            { type: "token", value: "`x = 1`" },
        ],
        stores,
        "g1",
    );

    assert.equal(nodes[0], "안녕 ");
    assert.deepEqual(nodes[1].props.children, ["@냐비"]);
    assert.equal(nodes[2], "<@2>", "an unknown user falls back to the raw token");
    assert.deepEqual(nodes[3].props.children, ["#일반"]);
    assert.equal(nodes[4].type, "img");
    assert.ok(nodes[4].props.src.includes("/5.webp"), nodes[4].props.src);
    assert.equal(nodes[5].type, "code");
    assert.deepEqual(nodes[5].props.children, ["x = 1"]);
});

await checkAsync("translator: only a real wrapping quote is stripped", async () => {
    const previous = BdApi.Net.fetch;
    const reply = (content) => async () =>
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    try {
        BdApi.Net.fetch = reply('"안녕하세요"');
        assert.equal(
            (await new Translator({ settings: stubSettings() }).translate("hello")).text,
            "안녕하세요",
        );

        BdApi.Net.fetch = reply('"가" 그리고 "나"');
        assert.equal(
            (await new Translator({ settings: stubSettings() }).translate("a and b")).text,
            '"가" 그리고 "나"',
            "a string that merely starts and ends with a quote keeps both",
        );
    } finally {
        BdApi.Net.fetch = previous;
    }
});

check("translator: an over-long message is re-checked after maxChars is raised", () => {
    const settings = stubSettings();
    settings.current.maxChars = 10;
    const translator = new Translator({ settings });
    assert.equal(translator.peek("this message is definitely too long").status, "skip");
    settings.current.maxChars = 3000;
    assert.equal(
        translator.peek("this message is definitely too long").status,
        "unknown",
        "the skip must not have been cached",
    );
});

check("settings: data saved under the previous plugin name is carried over", () => {
    const previous = BdApi.Data;
    const store = new Map([
        [`${LEGACY_NAMES[0]}::settings`, { apiKey: "sk-old", guildIds: "123456789012345678" }],
    ]);
    BdApi.Data = {
        load: (name, key) => store.get(`${name}::${key}`) ?? null,
        save: (name, key, value) => store.set(`${name}::${key}`, value),
        delete: (name, key) => store.delete(`${name}::${key}`),
    };
    try {
        const settings = new Settings();
        assert.equal(settings.current.apiKey, "sk-old", "the key must survive a rename");
        assert.deepEqual([...settings.guildIdSet], ["123456789012345678"]);
        assert.ok(store.has(`${NAME}::settings`), "carried-over values are rewritten under the new name");
    } finally {
        BdApi.Data = previous;
    }
});

check("settings: every panel field persists, not just the switches", () => {
    // Mirrors how BdApi renders a top-level setting: it strips `value`, passes
    // `defaultValue`, and the input reports through the setting's own
    // onChange. The panel-level onChange is wired for `switch` only, so a
    // field without its own handler silently discards every edit.
    const settings = new Settings();
    const fields = settings.buildPanel().__spec.settings;

    const edits = {
        apiKey: "sk-typed-in-the-panel",
        guildIds: "1339590547421007964",
        model: "deepseek-v4-pro",
        baseUrl: "https://api.example.com",
        koreanThreshold: 55,
        maxChars: 1200,
        maxConcurrent: 5,
        translateBots: false,
        showPending: false,
    };

    for (const [id, value] of Object.entries(edits)) {
        const field = fields.find((entry) => entry.id === id);
        assert.ok(field, `panel is missing "${id}"`);
        assert.equal(typeof field.onChange, "function", `"${id}" has no onChange of its own`);
        field.onChange(value);
        assert.equal(settings.current[id], value, `"${id}" did not persist`);
    }

    assert.deepEqual([...settings.guildIdSet], [edits.guildIds]);
});

check("settings: the stored api key is never rendered into the panel", () => {
    const settings = new Settings();
    settings._set("apiKey", "  sk-abcdefgh1234  ");

    const field = settings.buildPanel().__spec.settings.find((entry) => entry.id === "apiKey");
    assert.equal(field.value, "", "the panel must not carry the key");
    assert.ok(!JSON.stringify(field).includes("abcdefgh"), "no part of the key may leak into the panel");
    assert.ok(field.placeholder.includes("1234"), "a last-4 fingerprint identifies the saved key");

    settings._set("apiKey", ""); // an empty edit means "unchanged"
    assert.equal(settings.current.apiKey, "sk-abcdefgh1234");

    settings._set("apiKey", "-"); // the documented way to erase it
    assert.equal(settings.current.apiKey, "");
});

check("settings: listeners fire and unsubscribe, and pasted values are trimmed", () => {
    const settings = new Settings();
    const seen = [];
    const unsubscribe = settings.onChange((id, value) => seen.push([id, value]));

    settings._set("showPending", false);
    settings._set("apiKey", "  sk-test  ");
    assert.deepEqual(seen[0], ["showPending", false]);
    assert.equal(settings.current.apiKey, "sk-test");

    unsubscribe();
    settings._set("showErrors", true);
    assert.equal(seen.length, 2, "no callbacks after unsubscribe");
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

function stubSettings() {
    return {
        current: {
            provider: "deepseek",
            apiKey: "test-key",
            model: "deepseek-v4-flash",
            baseUrl: "https://api.deepseek.com",
            maxChars: 3000,
            maxConcurrent: 2,
        },
    };
}

function captureSave(fn) {
    const previous = BdApi.Data.save;
    let captured = null;
    BdApi.Data.save = (_name, key, value) => {
        if (key === CACHE_KEY) captured = value;
    };
    try {
        fn();
    } finally {
        BdApi.Data.save = previous;
    }
    assert.ok(Array.isArray(captured), "cache.save() wrote nothing");
    return captured;
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
