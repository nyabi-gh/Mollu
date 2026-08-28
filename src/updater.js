import { NAME } from "./constants.js";
import { getText } from "./lib/net.js";
import { logger } from "./lib/logger.js";

const RAW_HOST = "https://raw.githubusercontent.com";
const MAX_BYTES = 5 * 1024 * 1024;

export function rawUrlFor(source, branch = "main") {
    const match = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(source || ""));
    return match ? `${RAW_HOST}/${match[1]}/${match[2]}/${branch}/dist/${NAME}.plugin.js` : null;
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

export class Updater {
    constructor({ meta, settings, interval, delay, onResult }) {
        this._meta = meta;
        this._settings = settings;
        this._interval = interval;
        this._delay = delay;
        this._onResult = onResult || (() => {});
        this._timers = [];
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

    async check({ announce = false } = {}) {
        const url = rawUrlFor(this._meta?.source);
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

        try {
            writePlugin(text);
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

function writePlugin(text) {
    const fs = require("fs");
    const path = require("path");
    fs.writeFileSync(path.join(BdApi.Plugins.folder, `${NAME}.plugin.js`), text);
}
