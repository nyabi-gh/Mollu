import js from "@eslint/js";
import globals from "globals";

export default [
    { ignores: ["dist/", "node_modules/"] },
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: {
                ...globals.browser,
                // Injected by BetterDiscord into the plugin's scope.
                BdApi: "readonly",
                // Provided by the CommonJS wrapper BetterDiscord evaluates the
                // bundle in; only referenced by the build footer.
                module: "readonly",
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            eqeqeq: ["error", "always", { null: "ignore" }],
            "no-var": "error",
            "prefer-const": "error",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
    {
        files: ["scripts/**/*.mjs", "eslint.config.mjs"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: { ...globals.node, BdApi: "writable", Response: "readonly" },
        },
        rules: { ...js.configs.recommended.rules },
    },
];
