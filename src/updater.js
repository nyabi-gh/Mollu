import { NAME } from "./constants.js";
import { getText } from "./lib/net.js";
import { logger } from "./lib/logger.js";
import { UPDATE_PUBLIC_KEY } from "./update-key.js";

const GITHUB_HOST = "https://github.com";
const MAX_BYTES = 5 * 1024 * 1024;

export function downloadUrlFor(source) {
    const match = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(source || ""));
    if (!match) return null;
    return `${GITHUB_HOST}/${match[1]}/${match[2]}/releases/latest/download/${NAME}.plugin.js`;
}

export function readVersion(text) {
    if (typeof text !== "string" || !new RegExp(`@name\\s+${NAME}\\s`).test(text)) return null;
    const match = /@version\s+(\S+)/.exec(text);
    return match ? match[1] : null;
}

export function isNewer(remote, current) {
    const parse = (value) =>
        String(value)
            .split(".")
            .map((part) => Number.parseInt(part, 10) || 0);
    const from = parse(remote);
    const to = parse(current);
    for (let i = 0; i < Math.max(from.length, to.length); i += 1) {
        const diff = (from[i] ?? 0) - (to[i] ?? 0);
        if (diff !== 0) return diff > 0;
    }
    return false;
}

// A plugin runs with Node's reach, so a release is installed only when it carries a signature
// made with the key whose public half ships in this build. A hijacked account or release page
// cannot produce one.
export async function verifySignature(text, signature, publicKey = UPDATE_PUBLIC_KEY) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !publicKey || typeof signature !== "string") return false;
    try {
        const key = await subtle.importKey(
            "spki",
            fromBase64(publicKey),
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"],
        );
        return await subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            key,
            fromBase64(signature.trim()),
            new TextEncoder().encode(text),
        );
    } catch (e) {
        logger.warn("could not check the update signature", e);
        return false;
    }
}

export class Updater {
    constructor({
        meta,
        settings,
        interval,
        delay,
        onResult,
        confirm,
        publicKey = UPDATE_PUBLIC_KEY,
        write = writePlugin,
    }) {
        this._meta = meta;
        this._settings = settings;
        this._interval = interval;
        this._delay = delay;
        this._onResult = onResult || (() => {});
        this._confirm = confirm || (() => false);
        this._publicKey = publicKey;
        this._write = write;
        this._timers = [];
        this._running = null;
        // Versions already offered or warned about, so a background check every few hours
        // does not ask again about something the user already saw.
        this._seen = new Set();
    }

    start() {
        this._schedule(setTimeout(() => this._tick(), this._delay));
        this._schedule(setInterval(() => this._tick(), this._interval));
    }

    stop() {
        for (const timer of this._timers) {
            clearTimeout(timer);
            clearInterval(timer);
        }
        this._timers = [];
    }

    check({ announce = false } = {}) {
        if (!this._running) {
            this._running = this._check(announce).finally(() => {
                this._running = null;
            });
        }
        return this._running;
    }

    async _check(announce) {
        const url = downloadUrlFor(this._meta?.source);
        if (!url) {
            logger.warn(`no update url; meta.source is not a github repository: ${this._meta?.source}`);
            if (announce) this._onResult({ status: "unavailable" });
            return null;
        }

        let text;
        try {
            text = await getText(url);
        } catch (e) {
            logger.warn("update check failed:", (e && e.message) || e);
            if (e && e.status === 404) {
                if (announce) this._onResult({ status: "unavailable" });
                return null;
            }
            if (announce) this._onResult({ status: "failed", message: (e && e.message) || "unknown" });
            return null;
        }

        const version = readVersion(text);
        if (!version || text.length > MAX_BYTES) {
            logger.warn(`the file at ${url} is not a ${NAME} build`);
            if (announce) this._onResult({ status: "failed", message: "unexpected file" });
            return null;
        }

        const current = this._meta?.version ?? "0";
        if (!isNewer(version, current)) {
            if (announce) this._onResult({ status: "current", version: current });
            return null;
        }

        const firstTime = !this._seen.has(version);
        if (!announce && !firstTime) return null;
        this._seen.add(version);

        let signature = null;
        try {
            signature = await getText(`${url}.sig`);
        } catch (e) {
            logger.warn(`v${version} has no signature:`, (e && e.message) || e);
        }
        if (signature == null) {
            this._onResult({ status: "unsigned", version });
            return null;
        }
        if (!(await verifySignature(text, signature, this._publicKey))) {
            logger.error(`v${version} failed its signature check; not installing it`);
            this._onResult({ status: "badSignature", version });
            return null;
        }

        if (!(await this._confirm({ version, current }))) {
            logger.info(`v${version} is verified; the user chose not to install it now`);
            return null;
        }

        try {
            this._write(text);
        } catch (e) {
            logger.error("could not write the plugin file", e);
            this._onResult({ status: "failed", message: (e && e.message) || "unknown" });
            return null;
        }

        logger.info(`updated to v${version}; BetterDiscord will reload the plugin`);
        this._onResult({ status: "updated", version });
        return version;
    }

    _schedule(timer) {
        timer?.unref?.();
        this._timers.push(timer);
    }

    _tick() {
        if (this._settings.current.autoUpdate) this.check();
    }
}

function fromBase64(value) {
    return Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));
}

function writePlugin(text) {
    const fs = require("fs");
    const path = require("path");
    fs.writeFileSync(path.join(BdApi.Plugins.folder, `${NAME}.plugin.js`), text);
}
