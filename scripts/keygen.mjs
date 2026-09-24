// Makes the key pair that signs releases. The private key stays outside the repository; the
// public key is written into src/update-key.js so every build can check what it downloads.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keyArg = process.argv.find((arg) => arg.startsWith("--out="));
const out = keyArg
    ? keyArg.slice("--out=".length)
    : join(homedir(), ".config", "mollu", "update-signing-key.pem");

if (existsSync(out) && !process.argv.includes("--force")) {
    console.error(
        `${out} already exists. Builds already in use trust its public key; pass --force to replace it.`,
    );
    process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
writeFileSync(
    join(root, "src", "update-key.js"),
    "// Written by `npm run keygen`. Only a release signed with the matching private key installs.\n" +
        `export const UPDATE_PUBLIC_KEY =\n    "${spki}";\n`,
);

console.log(`private key -> ${out}`);
console.log("public key  -> src/update-key.js");
console.log(
    `\nStore the private key as the MOLLU_SIGNING_KEY secret of the GitHub repository:\n  gh secret set MOLLU_SIGNING_KEY < "${out}"`,
);
console.log(
    "Keep a copy somewhere safe. Without it, no future release can be installed by builds that trust this key.",
);
