// 테스트 프레임워크 없이 돌리는 스모크 체크. BetterDiscord 에 실제로 올려 보는 것을
// 대체하지는 못한다 — webpack 탐색과 React 패칭은 거기서만 확인할 수 있다.

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

// --- 1. 소스 로직 ------------------------------------------------------------

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

const detector = new LanguageDetector({ current: { skipThreshold: 30 } });

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

// --- 2. 번들 로드 ------------------------------------------------------------

installBdApiStub();
// meta.json 에서 유도한다. 이름을 바꿔도 옛 파일을 가리키지 않게.
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
    const panel = instance.getSettingsPanel().type();
    assert.ok(Array.isArray(panel.__spec.settings) && panel.__spec.settings.length > 0);
    assert.equal(typeof panel.__spec.onChange, "function");
});

check("start() and stop() do not throw (webpack lookup fails gracefully)", () => {
    const instance = new Plugin({ name: meta.name });
    instance.start();
    instance.stop();
});

// --- 3. 캐시 / 토큰 복원 회귀 -------------------------------------------------

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
const { CACHE_LIMIT, CACHE_KEY, NAME, LEGACY_NAMES, TRANSIENT_RETRIES } = await import("../src/constants.js");

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

check('cache: a "no translation needed" verdict survives a restart', () => {
    const saved = captureSave(() => {
        const cache = new TranslationCache();
        cache.set("ko\u0001already korean", null);
        cache.set("ko\u0001bonjour", "안녕");
        cache.save();
    });
    // null 을 버리면 "이미 대상 언어" 라는 판정을 세션마다 API 에 다시 물어보게 된다.
    assert.equal(saved.length, 2);

    const reloaded = new TranslationCache();
    const previous = BdApi.Data.load;
    BdApi.Data.load = (_name, key) => (key === CACHE_KEY ? saved : null);
    try {
        reloaded.load();
    } finally {
        BdApi.Data.load = previous;
    }
    assert.ok(reloaded.has("ko\u0001already korean"));
    assert.equal(reloaded.get("ko\u0001already korean"), null);
    assert.equal(reloaded.get("ko\u0001bonjour"), "안녕");
});

check("cache: clearing empties the store and the saved copy", () => {
    const saved = captureSave(() => {
        const cache = new TranslationCache();
        cache.set("ko\u0001hello there", "안녕");
        assert.equal(cache.size, 1);
        cache.clear();
        assert.equal(cache.size, 0);
    });
    // 저장까지 하지 않으면 다음 실행에 그대로 되살아난다.
    assert.deepEqual(saved, []);
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
        assert.equal(calls, 1 + TRANSIENT_RETRIES, "a 5xx is retried before the user sees it");

        const afterFirst = calls;
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal(calls, afterFirst, "the second attempt is served from the failure backoff");

        // Clicking the failure has to get past that backoff.
        assert.equal((await translator.translate("hello there", { ignoreBackoff: true })).status, "error");
        assert.ok(calls > afterFirst, "an explicit retry bypasses the backoff");
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

        // 화면 밖으로 나간 메시지는 미번역으로 응답되며, 실패 백오프가 이를
        // 오류로 취급하면 안 된다.
        const dropped = await translator.translate("something else entirely", {
            shouldRun: () => false,
        });
        assert.equal(dropped.status, "unknown");
        assert.equal(translator._failures.size, 0, "a drop is not a failure");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("translator: a 429 pauses everything instead of failing", async () => {
    const previous = BdApi.Net.fetch;
    let calls = 0;
    BdApi.Net.fetch = async () => {
        calls += 1;
        return new Response(
            JSON.stringify({
                error: {
                    code: 429,
                    status: "RESOURCE_EXHAUSTED",
                    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" }],
                },
            }),
            { status: 429 },
        );
    };
    try {
        const translator = new Translator({ settings: stubSettings() });
        const result = await translator.translate("hello there");

        assert.equal(result.status, "retry", "a quota verdict is not this message's failure");
        assert.equal(result.after, 7000, "the server's retryDelay is honoured");
        assert.ok(translator._pausedUntil > Date.now(), "every other request is held back");
        assert.equal(translator._failures.size, 0, "a 429 must not enter the failure backoff");

        // 두 번째 메시지는 할당량을 더 태우지 않고 대기해야 한다.
        const before = calls;
        const pending = translator.translate("a different message");
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(calls, before, "no provider call while paused");

        translator._pausedUntil = 0;
        assert.equal((await pending).status, "retry");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("provider: a chain of thought never reaches the message list", async () => {
    const previous = BdApi.Net.fetch;
    const reply =
        (content, finish = "stop") =>
        async () =>
            new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }] }), {
                status: 200,
            });
    try {
        // 닫힌 블록: 그 뒤에 오는 것만 남긴다.
        BdApi.Net.fetch = reply("<thought>Let me consider the tone.</thought>안녕하세요");
        assert.equal(
            (await new Translator({ settings: stubSettings() }).translate("hi there")).text,
            "안녕하세요",
        );

        // Gemma 4 의 실제 형태: 예산이 다할 때까지 추론만 하고 번역문은 쓰이지
        // 않는다. 이건 결과가 아니라 오류다.
        BdApi.Net.fetch = reply("<thought>*  Input: ...\n*  Option 1: ...", "length");
        const cut = await new Translator({ settings: stubSettings() }).translate("hi there");
        assert.equal(cut.status, "error");
        assert.match(cut.message, /추론/);
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("translator: a configuration error is not retried", async () => {
    const previous = BdApi.Net.fetch;
    let calls = 0;
    BdApi.Net.fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: "bad model" }), { status: 400 });
    };
    try {
        const translator = new Translator({ settings: stubSettings() });
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal(calls, 1, "a 400 says the same thing every time");

        // A missing key never reaches the network at all.
        calls = 0;
        const settings = stubSettings();
        settings.current.apiKey = "";
        assert.equal((await new Translator({ settings }).translate("hello there")).status, "error");
        assert.equal(calls, 0);
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("deepl: protects placeholders with its own ignore tags", async () => {
    const previous = BdApi.Net.fetch;
    let seen = null;
    BdApi.Net.fetch = async (url, options) => {
        seen = { url, options, body: JSON.parse(options.body) };
        return new Response(
            JSON.stringify({
                translations: [{ detected_source_language: "EN", text: "안녕 <x>0</x> 3 &lt; 5" }],
            }),
            { status: 200 },
        );
    };
    try {
        const settings = stubSettings();
        Object.assign(settings.current, { provider: "deepl", baseUrl: "", model: "" });
        settings.current.apiKey = "abc:fx";

        const result = await new Translator({ settings }).translate("hi <@1> 3 < 5");

        assert.equal(seen.url, "https://api-free.deepl.com/v2/translate", "a :fx key uses the free host");
        assert.equal(seen.options.headers.Authorization, "DeepL-Auth-Key abc:fx");
        assert.equal(seen.body.target_lang, "KO");
        assert.deepEqual(seen.body.ignore_tags, ["x"]);
        assert.equal(seen.body.tag_handling, "xml");
        // The placeholder became a tag DeepL is told to leave alone, and the
        // bare "<" was escaped so the XML parse does not break on it.
        assert.equal(seen.body.text[0], "hi <x>0</x> 3 &lt; 5");
        assert.equal(result.text, "안녕 <@1> 3 < 5");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("deepl: a pro key is sent to the pro host", async () => {
    const previous = BdApi.Net.fetch;
    let url = null;
    BdApi.Net.fetch = async (requested) => {
        url = requested;
        return new Response(JSON.stringify({ translations: [{ text: "안녕" }] }), { status: 200 });
    };
    try {
        const settings = stubSettings();
        Object.assign(settings.current, { provider: "deepl", baseUrl: "", apiKey: "no-suffix-key" });
        await new Translator({ settings }).translate("hello there");
        assert.equal(url, "https://api.deepl.com/v2/translate");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

check("net: a plain-http base url is refused before the key is sent", () => {
    assert.throws(() => normalizeBaseUrl("http://evil.example"), /https/);
    assert.equal(normalizeBaseUrl("  https://api.deepseek.com/  "), "https://api.deepseek.com");
    assert.equal(normalizeBaseUrl("api.deepseek.com"), "https://api.deepseek.com");
});

// --- 4. 렌더링 / 설정 ---------------------------------------------------------

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
    // BdApi 가 최상위 설정을 렌더하는 방식을 그대로 흉내 낸다: value 를 떼고
    // defaultValue 로 넘기며, 입력은 설정 항목 자신의 onChange 로만 보고한다.
    // 패널 레벨 onChange 는 switch 에만 연결되므로, 자기 핸들러가 없는 칸은
    // 모든 편집을 조용히 버린다.
    const settings = new Settings();
    const fields = settings._panelSpec().settings;

    const edits = {
        apiKey: "sk-typed-in-the-panel",
        guildIds: "1339590547421007964",
        model: "deepseek-v4-pro",
        baseUrl: "https://api.example.com",
        skipThreshold: 55,
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

const { setLocale, t } = await import("../src/i18n.js");
const { getLanguage, badgeFor, LANGUAGE_OPTIONS } = await import("../src/languages.js");

check("i18n: strings switch language and interpolate", () => {
    setLocale("ko");
    assert.equal(t("block.pending"), "번역 중…");
    assert.equal(t("toast.failed", { message: "HTTP 429" }), "번역 실패 · HTTP 429");
    setLocale("en");
    assert.equal(t("block.pending"), "Translating…");
    assert.ok(!/[가-힣]/.test(t("settings.provider.note")), "the English table must not leak Korean");
    setLocale("xx");
    assert.equal(t("block.pending"), "Translating…", "an unknown locale falls back to English");
});

check("i18n: every key exists in both tables", () => {
    setLocale("en");
    for (const { value } of LANGUAGE_OPTIONS) assert.ok(value, "language option needs a value");
    const keys = ["block.pending", "block.error", "block.trigger", "toast.failed", "settings.provider"];
    for (const key of keys) {
        setLocale("ko");
        const ko = t(key);
        setLocale("en");
        assert.notEqual(t(key), key, `${key} missing from en`);
        assert.notEqual(ko, key, `${key} missing from ko`);
    }
});

await checkAsync("target language: drives the prompt and the cache key", async () => {
    const previous = BdApi.Net.fetch;
    const prompts = [];
    BdApi.Net.fetch = async (_url, options) => {
        prompts.push(JSON.parse(options.body).messages[0].content);
        return new Response(JSON.stringify({ choices: [{ message: { content: "translated" } }] }), {
            status: 200,
        });
    };
    try {
        const settings = stubSettings();
        settings.current.targetLanguage = "en";
        const translator = new Translator({ settings });
        await translator.translate("안녕하세요 여러분");
        assert.match(prompts[0], /into natural, colloquial English/);

        // Same source, different target: must not reuse the English answer.
        settings.current.targetLanguage = "ja";
        assert.equal(translator.peek("안녕하세요 여러분").status, "unknown");
        await translator.translate("안녕하세요 여러분");
        assert.match(prompts[1], /into natural, colloquial Japanese/);
    } finally {
        BdApi.Net.fetch = previous;
    }
});

check("detector: a missing threshold falls back instead of disabling everything", () => {
    // ratio < NaN is always false, so an unset value used to switch translation
    // off silently — no block, no button, no error.
    for (const skipThreshold of [undefined, null, NaN, "", {}]) {
        const detect = new LanguageDetector({ current: { skipThreshold, targetLanguage: "ko" } });
        assert.equal(detect.needsTranslation("hello everyone"), true, `broken by ${String(skipThreshold)}`);
    }
    // A real 0 still means "never translate", which is a legitimate setting.
    const zero = new LanguageDetector({ current: { skipThreshold: 0, targetLanguage: "ko" } });
    assert.equal(zero.needsTranslation("hello everyone"), false);
});

check("detector: judges against the chosen target language", () => {
    const settings = { current: { skipThreshold: 30, targetLanguage: "ko" } };
    const detect = new LanguageDetector(settings);

    assert.equal(detect.needsTranslation("Hello everyone"), true);
    assert.equal(detect.needsTranslation("안녕하세요 여러분"), false);

    settings.current.targetLanguage = "ja";
    assert.equal(detect.needsTranslation("こんにちは、元気ですか"), false, "already Japanese");
    assert.equal(detect.needsTranslation("안녕하세요 여러분"), true, "Korean needs translating now");

    settings.current.targetLanguage = "en";
    assert.equal(detect.needsTranslation("안녕하세요 여러분"), true);
    assert.equal(
        detect.needsTranslation("Hello everyone"),
        true,
        "a Latin-script target cannot be pre-filtered, so the model decides",
    );

    assert.equal(getLanguage("nope").code, "ko", "an unknown code falls back to the default");
});

check("languages: regional variants are distinct targets", () => {
    assert.equal(getLanguage("pt-BR").name, "Brazilian Portuguese");
    assert.equal(getLanguage("pt-PT").name, "European Portuguese");
    assert.equal(badgeFor("pt-BR"), "PT-BR", "a regional code needs its own badge");
    assert.equal(badgeFor("ko"), "KO");
    assert.ok(
        LANGUAGE_OPTIONS.some((option) => option.value === "pt-BR"),
        "the panel must offer Brazilian Portuguese",
    );
});

check("settings: a target saved before the split becomes Brazilian", () => {
    const previous = BdApi.Data;
    const store = new Map([[`${NAME}::settings`, { targetLanguage: "pt", koreanThreshold: 45 }]]);
    BdApi.Data = {
        load: (name, key) => store.get(`${name}::${key}`) ?? null,
        save: (name, key, value) => store.set(`${name}::${key}`, value),
        delete: (name, key) => store.delete(`${name}::${key}`),
    };
    try {
        const settings = new Settings();
        assert.equal(settings.current.targetLanguage, "pt-BR");
        assert.equal(settings.current.skipThreshold, 45, "the renamed threshold carries over");
        assert.ok(!("koreanThreshold" in settings.current), "the old key is dropped");
    } finally {
        BdApi.Data = previous;
    }
});

check("settings: the model field is hidden for a backend without models", () => {
    const settings = new Settings();
    settings.set("provider", "deepl");
    const ids = settings._panelSpec().settings.map((entry) => entry.id);
    assert.ok(!ids.includes("model"), "DeepL has no model to choose");
    assert.ok(ids.includes("apiKey") && ids.includes("targetLanguage"));

    settings.set("provider", "gemini");
    assert.ok(
        settings._panelSpec().settings.some((entry) => entry.id === "model"),
        "a backend with models still shows the field",
    );
});

check("settings: switching provider swaps defaults and keeps both keys", () => {
    const settings = new Settings();
    settings.set("apiKey", "sk-deepseek");

    settings.set("provider", "gemini");
    assert.equal(settings.current.baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
    assert.equal(settings.current.model, "gemini-3.1-flash-lite");
    assert.equal(settings.current.apiKey, "", "a provider with no saved key starts empty");

    settings.set("apiKey", "gemini-key");
    settings.set("provider", "deepseek");
    assert.equal(settings.current.apiKey, "sk-deepseek", "the first key was remembered");
    assert.equal(settings.current.baseUrl, "https://api.deepseek.com");

    settings.set("provider", "gemini");
    assert.equal(settings.current.apiKey, "gemini-key", "so was the second");
});

await checkAsync("gemini: request shape targets the OpenAI-compatible endpoint", async () => {
    const previous = BdApi.Net.fetch;
    let seen = null;
    BdApi.Net.fetch = async (url, options) => {
        seen = { url, options };
        return new Response(JSON.stringify({ choices: [{ message: { content: "안녕" } }] }), {
            status: 200,
        });
    };
    try {
        const settings = stubSettings();
        Object.assign(settings.current, {
            provider: "gemini",
            model: "gemini-3.1-flash-lite",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        });
        await new Translator({ settings }).translate("hello there");

        assert.equal(seen.url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
        assert.equal(seen.options.headers.Authorization, "Bearer test-key");
        const body = JSON.parse(seen.options.body);
        assert.equal(body.model, "gemini-3.1-flash-lite");
        assert.equal(body.messages[0].role, "system");
        assert.ok(!("thinking" in body), "the DeepSeek-only field must not leak to Google");
        assert.equal(body.reasoning_effort, "none", "gemini-* reasons by default; a translation must not");
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("gemini: gemma never receives reasoning_effort, which it rejects", async () => {
    const previous = BdApi.Net.fetch;
    let body = null;
    BdApi.Net.fetch = async (_url, options) => {
        body = JSON.parse(options.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: "안녕" } }] }), {
            status: 200,
        });
    };
    try {
        const settings = stubSettings();
        Object.assign(settings.current, {
            provider: "gemini",
            model: "gemma-4-31b-it",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        });
        await new Translator({ settings }).translate("hello there");
        // "Thinking budget is not supported for this model." — HTTP 400 으로 거부된다.
        assert.ok(!("reasoning_effort" in body));
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("translator: clearing the cache also lifts the failure backoff", async () => {
    const previous = BdApi.Net.fetch;
    let calls = 0;
    BdApi.Net.fetch = async () => {
        calls += 1;
        return new Response("nope", { status: 400 });
    };
    try {
        const translator = new Translator({ settings: stubSettings() });
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal(calls, 1, "the second attempt is held by the backoff");

        // 캐시를 비우는 이유는 대개 다시 시도하기 위해서다.
        translator.clearCache();
        assert.equal((await translator.translate("hello there")).status, "error");
        assert.equal(calls, 2);
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("translator: every block waiting on the same text is told it started", async () => {
    const previous = BdApi.Net.fetch;
    BdApi.Net.fetch = async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "안녕" } }] }), { status: 200 });
    try {
        const translator = new Translator({ settings: stubSettings() });
        const started = [];
        const both = await Promise.all([
            translator.translate("hello there", { onStart: () => started.push("first") }),
            translator.translate("hello there", { onStart: () => started.push("second") }),
        ]);
        // 요청은 하나로 합쳐도, 합류한 블록이 빈 줄에 앉아 있으면 안 된다.
        assert.deepEqual(started, ["first", "second"]);
        assert.equal(both[0].text, both[1].text);
    } finally {
        BdApi.Net.fetch = previous;
    }
});

await checkAsync("manual mode: nothing is sent until it is asked for", async () => {
    const previous = BdApi.Net.fetch;
    let calls = 0;
    BdApi.Net.fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ choices: [{ message: { content: "안녕" } }] }), {
            status: 200,
        });
    };
    try {
        const settings = stubSettings();
        const translator = new Translator({ settings });

        // 캐시 미스는 무언가가 명시적으로 요청하기 전까지 미스로 남아야 한다.
        assert.equal(translator.peek("hello there").status, "unknown");
        assert.equal(calls, 0, "peek() must never reach the provider");

        // 버튼 핸들러는 observer 가 부르는 것과 같은 translate() 호출이다.
        assert.equal((await translator.translate("hello there")).text, "안녕");
        assert.equal(calls, 1);
    } finally {
        BdApi.Net.fetch = previous;
    }
});

check("settings: the stored api key is never rendered into the panel", () => {
    const settings = new Settings();
    settings.set("apiKey", "  sk-abcdefgh1234  ");

    const field = settings._panelSpec().settings.find((entry) => entry.id === "apiKey");
    assert.equal(field.value, "", "the panel must not carry the key");
    assert.ok(!JSON.stringify(field).includes("abcdefgh"), "no part of the key may leak into the panel");
    assert.ok(field.placeholder.includes("1234"), "a last-4 fingerprint identifies the saved key");

    settings.set("apiKey", ""); // an empty edit means "unchanged"
    assert.equal(settings.current.apiKey, "sk-abcdefgh1234");

    settings.set("apiKey", "-"); // the documented way to erase it
    assert.equal(settings.current.apiKey, "");
});

const { parseHotkey, matchesHotkey, keysFromString } = await import("../src/hotkey.js");

check("hotkey: a combo is parsed, and nonsense disables it instead of throwing", () => {
    // BD 의 keybind 입력이 주는 형태: 누른 순서대로 모은 event.key 배열.
    assert.deepEqual(parseHotkey(["Control", "Shift", "T"]), {
        ctrl: true,
        shift: true,
        alt: false,
        meta: false,
        key: "t",
    });
    assert.deepEqual(parseHotkey(["Alt", "k"]), {
        ctrl: false,
        shift: false,
        alt: true,
        meta: false,
        key: "k",
    });
    assert.equal(parseHotkey(["Meta", "K"]).meta, true, "macOS Command");

    // 문자열로 저장하던 시절의 값도 그대로 읽힌다.
    assert.deepEqual(parseHotkey("Ctrl+Shift+T"), parseHotkey(["Control", "Shift", "T"]));
    assert.deepEqual(keysFromString("Ctrl+Shift+T"), ["Control", "Shift", "T"]);
    assert.deepEqual(keysFromString("cmd+K"), ["Meta", "K"]);

    // 알아볼 수 없으면 단축키만 붙지 않는다. 설정 하나가 플러그인을 멈추면 안 된다.
    assert.equal(parseHotkey([]), null);
    assert.equal(parseHotkey(""), null);
    assert.equal(parseHotkey(["Control", "Shift"]), null, "a modifier alone is not a shortcut");
    assert.equal(parseHotkey(["Control", "T", "K"]), null, "two keys is not a shortcut");
});

check("settings: a hotkey saved as text becomes a recordable keybind", () => {
    const previous = BdApi.Data;
    const store = new Map([[`${NAME}::settings`, { hotkey: "Ctrl+Shift+T", outgoingHotkey: "Alt+K" }]]);
    BdApi.Data = {
        load: (name, key) => store.get(`${name}::${key}`) ?? null,
        save: (name, key, value) => store.set(`${name}::${key}`, value),
        delete: (name, key) => store.delete(`${name}::${key}`),
    };
    try {
        // 문자열이 남아 있으면 BD 의 keybind 입력이 렌더되지 않는다.
        const settings = new Settings();
        assert.deepEqual(settings.current.hotkey, ["Control", "Shift", "T"]);
        assert.deepEqual(settings.current.outgoingHotkey, ["Alt", "K"]);
    } finally {
        BdApi.Data = previous;
    }
});

check("hotkey: only the exact combo fires, and never mid-composition", () => {
    const combo = parseHotkey("Ctrl+Shift+T");
    const event = (overrides) => ({
        key: "T",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        repeat: false,
        isComposing: false,
        ...overrides,
    });

    assert.ok(matchesHotkey(combo, event()));
    assert.ok(!matchesHotkey(combo, event({ altKey: true })), "an extra modifier is a different combo");
    assert.ok(!matchesHotkey(combo, event({ ctrlKey: false })));
    assert.ok(!matchesHotkey(combo, event({ key: "R" })));
    assert.ok(!matchesHotkey(combo, event({ repeat: true })), "holding the key must not spam the toggle");
    // 한글 조합 중의 keydown 을 단축키로 읽으면 타이핑이 망가진다.
    assert.ok(!matchesHotkey(combo, event({ isComposing: true })));
    assert.ok(!matchesHotkey(null, event()));
});

check("settings: the advanced section carries a working cache-clear button", () => {
    let cleared = 0;
    const settings = new Settings({ clearCache: () => (cleared += 1) });
    const advanced = settings._panelSpec().settings.find((entry) => entry.id === "advanced");
    assert.ok(advanced, "the advanced category is missing");

    const button = advanced.settings.find((entry) => entry.id === "clearCache");
    assert.equal(button.type, "button");
    // 값이 없는 항목이라 설정을 쓰는 onChange 가 붙으면 안 된다.
    assert.ok(!("onChange" in button));

    button.onClick();
    assert.equal(cleared, 1);
});

check("settings: the panel is a live component, not a one-shot spec", () => {
    const settings = new Settings();
    const panel = settings.buildPanel();
    assert.equal(typeof panel.type, "function", "a plain spec cannot react to a provider change");

    const rendered = panel.type();
    assert.ok(rendered.__spec.settings.some((entry) => entry.id === "provider"));
    // key 가 바뀌어야 BD 의 비제어 입력이 새 defaultValue 로 다시 마운트된다.
    assert.match(String(rendered.props.key), /^panel-/);
});

check("settings: listeners fire and unsubscribe, and pasted values are trimmed", () => {
    const settings = new Settings();
    const seen = [];
    const unsubscribe = settings.onChange((id, value) => seen.push([id, value]));

    settings.set("showPending", false);
    settings.set("apiKey", "  sk-test  ");
    assert.deepEqual(seen[0], ["showPending", false]);
    assert.equal(settings.current.apiKey, "sk-test");

    unsubscribe();
    settings.set("showErrors", true);
    assert.equal(seen.length, 2, "no callbacks after unsubscribe");
});

// --- 5. 메시지 필터 -----------------------------------------------------------

const { MessagePatch } = await import("../src/message-patch.js");

check("target servers: the list gates by default, the toggle opens every server", () => {
    const inList = "1101573652786446417";

    const guildOf = (overrides, list, msg) => patchWith(overrides, list)._resolve(message(msg)).guildId;

    assert.equal(guildOf({}, inList), inList);
    assert.equal(guildOf({}, "222222222222222222"), undefined, "outside the list");
    assert.equal(guildOf({}), undefined, "an empty list translates nothing");

    assert.equal(guildOf({ allGuilds: true }), inList, "the toggle needs no list");
    assert.equal(
        guildOf({ allGuilds: true }, "", { channel_id: "dm" }),
        undefined,
        "a direct message belongs to no server, with or without the toggle",
    );
    assert.equal(guildOf({ allGuilds: true, apiKey: "" }), undefined, "still needs a key");
    assert.equal(
        guildOf({ allGuilds: true }, "", { author: { id: "me" } }),
        undefined,
        "the toggle must not bypass the author filters",
    );

    // 슬래시 커맨드 응답(20)도 사람이 읽는 본문이다.
    assert.equal(guildOf({ allGuilds: true }, "", { type: 20 }), inList);
    assert.equal(guildOf({ allGuilds: true }, "", { type: 7 }), undefined, "a join notice has no body");
});

check("diagnostics: a skipped message reports why", () => {
    const reasonFor = (overrides, msg) => patchWith(overrides, "")._resolve(message(msg)).reason;

    assert.match(reasonFor({}), /no target server/);
    assert.match(reasonFor({ allGuilds: true }, { author: { id: "me" } }), /own message/);
    assert.match(reasonFor({ allGuilds: true }, { channel_id: "dm" }), /not a server channel/);
    assert.match(reasonFor({ allGuilds: true, apiKey: "" }), /no api key/);
    assert.match(reasonFor({ allGuilds: true }, { content: "   " }), /no text content/);
});

// --- 6. 보내는 메시지 -----------------------------------------------------------

const { OutgoingPatch } = await import("../src/outgoing-patch.js");

check("outgoing: the gate opens only for a target server with the toggle on", () => {
    const inList = "1101573652786446417";
    const pick = (overrides, content = "안녕하세요", channelId = "c") =>
        outgoingWith(overrides, inList)._pick([channelId, { content }]);

    assert.equal(pick({ translateOutgoing: true }), "안녕하세요");

    assert.equal(pick({}), null, "off by default");
    assert.equal(pick({ translateOutgoing: true, apiKey: "" }), null, "no key");
    assert.equal(pick({ translateOutgoing: true }, "안녕하세요", "dm"), null, "not a server channel");
    assert.equal(pick({ translateOutgoing: true }, "   "), null, "nothing to translate");
    // 슬래시 커맨드를 번역하면 명령 자체가 망가진다.
    assert.equal(pick({ translateOutgoing: true }, "/giphy 안녕"), null);
    // 문자로 구분되는 언어라면 이미 그 언어인 글은 보내지 않는다.
    assert.equal(pick({ translateOutgoing: true, outgoingLanguage: "ko" }), null);
    // 라틴 문자 대상 언어는 보내기 전에 구분할 수 없어 한 번은 왕복한다. 결과가
    // 원문과 같으면 그대로 나가고, 그 판정은 캐시된다.
    assert.equal(pick({ translateOutgoing: true }, "hello there"), "hello there");
    assert.equal(
        outgoingWith({ translateOutgoing: true }, "222222222222222222")._pick([
            "c",
            { content: "안녕하세요" },
        ]),
        null,
        "outside the target list",
    );
});

await checkAsync(
    "outgoing: a translation replaces the content, a failure never eats the message",
    async () => {
        const done = { status: "done", text: "hello there" };
        const sent = [];
        const original = function (channelId, message) {
            sent.push(message.content);
            return "sent";
        };

        const patch = outgoingWith({ translateOutgoing: true }, "1101573652786446417", {
            translate: async () => done,
        });
        await patch._onSend(null, ["c", { content: "안녕하세요" }], original);
        assert.deepEqual(sent, ["hello there"]);

        // 번역이 실패해도 원문은 반드시 나가고, 조용히 나가서도 안 된다.
        const failures = [];
        const failing = outgoingWith(
            { translateOutgoing: true },
            "1101573652786446417",
            { translate: async () => ({ status: "error", message: "HTTP 401" }) },
            (message) => failures.push(message),
        );
        await failing._onSend(null, ["c", { content: "안녕하세요" }], original);
        assert.deepEqual(sent, ["hello there", "안녕하세요"]);
        assert.deepEqual(failures, ["HTTP 401"]);

        // translate() 가 약속을 어기고 throw 해도 마찬가지다.
        const throwing = outgoingWith({ translateOutgoing: true }, "1101573652786446417", {
            translate: async () => {
                throw new Error("boom");
            },
        });
        await throwing._onSend(null, ["c", { content: "안녕하세요" }], original);
        assert.deepEqual(sent, ["hello there", "안녕하세요", "안녕하세요"]);
    },
);

check("outgoing: the gate is skipped without a promise when it does not apply", () => {
    const patch = outgoingWith({}, "1101573652786446417");
    const result = patch._onSend(null, ["c", { content: "안녕하세요" }], () => "sent");
    // 보내는 경로 대부분은 그대로 지나가야 한다. Promise 로 감싸면 반환값이 바뀐다.
    assert.equal(result, "sent");
});

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

// --- 헬퍼 --------------------------------------------------------------------

// BetterDiscord 가 플러그인 파일을 평가하는 방식을 흉내 낸다: require/module/exports
// 를 넘기는 Function 으로 감싸 실행한다. Node 의 ESM/CJS 처리를 완전히 피한다.
function loadPlugin(path) {
    const source = readFileSync(path, "utf8");
    const moduleObj = { filename: path, exports: {} };
    const wrapped = new Function("require", "module", "exports", "__filename", "__dirname", source);
    wrapped(() => ({}), moduleObj, moduleObj.exports, path, dirname(path));
    let exported = moduleObj.exports;
    if (exported && exported.default) exported = exported.default;
    return exported;
}

function outgoingWith(overrides, targetGuildId = "", translator = null, onFailure = null) {
    const guildId = "1101573652786446417";
    const settings = {
        current: {
            apiKey: "test-key",
            allGuilds: false,
            maxChars: 3000,
            targetLanguage: "ko",
            translateOutgoing: false,
            outgoingLanguage: "en",
            skipThreshold: 30,
            ...overrides,
        },
        guildIdSet: new Set(targetGuildId ? [targetGuildId] : []),
    };
    return new OutgoingPatch({
        target: {},
        settings,
        translator: translator ?? { translate: async () => ({ status: "unknown" }) },
        languageDetector: new LanguageDetector(settings),
        stores: { guildIdForChannel: (channelId) => (channelId === "dm" ? null : guildId) },
        onFailure: onFailure ?? (() => {}),
    });
}

function patchWith(overrides, targetGuildId = "") {
    const guildId = "1101573652786446417";
    return new MessagePatch({
        target: {},
        translator: {},
        languageDetector: {},
        settings: {
            current: {
                apiKey: "test-key",
                allGuilds: false,
                translateBots: true,
                translateOwnMessages: false,
                ...overrides,
            },
            guildIdSet: new Set(targetGuildId ? [targetGuildId] : []),
        },
        stores: {
            guildIdForChannel: (channelId) => (channelId === "dm" ? null : guildId),
            currentUserId: () => "me",
        },
    });
}

function message(overrides) {
    return { type: 0, content: "hello there", author: { id: "someone" }, channel_id: "c", ...overrides };
}

function stubSettings() {
    return {
        current: {
            provider: "deepseek",
            apiKey: "test-key",
            model: "deepseek-v4-flash",
            baseUrl: "https://api.deepseek.com",
            targetLanguage: "ko",
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
