// Signs the built plugin for the updater. The private key comes from MOLLU_SIGNING_KEY (a PEM)
// or --key=<path>, and the signature is checked against src/update-key.js before it is written.
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const meta = JSON.parse(readFileSync(join(root, "meta.json"), "utf8"));
const plugin = join(root, "dist", `${meta.name}.plugin.js`);

const keyArg = process.argv.find((arg) => arg.startsWith("--key="));
const pem = keyArg ? readFileSync(keyArg.slice("--key=".length), "utf8") : process.env.MOLLU_SIGNING_KEY;
if (!pem) {
    console.error("No signing key: set MOLLU_SIGNING_KEY or pass --key=<path>.");
    process.exit(1);
}

const { UPDATE_PUBLIC_KEY } = await import("../src/update-key.js");
if (!UPDATE_PUBLIC_KEY) {
    console.error("src/update-key.js has no public key; run `npm run keygen` first.");
    process.exit(1);
}

const bytes = readFileSync(plugin);
const signature = sign("sha256", bytes, { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });

const publicKey = createPublicKey({
    key: Buffer.from(UPDATE_PUBLIC_KEY, "base64"),
    format: "der",
    type: "spki",
});
if (!verify("sha256", bytes, { key: publicKey, dsaEncoding: "ieee-p1363" }, signature)) {
    console.error("The signing key does not match the public key in src/update-key.js.");
    process.exit(1);
}

writeFileSync(`${plugin}.sig`, signature.toString("base64") + "\n");
console.log(`signed ${plugin}.sig`);
