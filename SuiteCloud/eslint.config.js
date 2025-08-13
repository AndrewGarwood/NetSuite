import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";

export default [
    js.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
        parser: tsParser,
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            project: "./tsconfig.json"
        },
        globals: {
            // Node.js globals
            global: "readonly",
            process: "readonly",
            Buffer: "readonly",
            console: "readonly",
            setTimeout: "readonly",
            clearTimeout: "readonly",
            setInterval: "readonly",
            clearInterval: "readonly",
            require: "readonly",
            module: "readonly",
            __filename: "readonly",
            __dirname: "readonly"
        }
        },
        plugins: {
        "@typescript-eslint": tsPlugin,
        "import": importPlugin
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            // Path alias resolution
            "import/no-unresolved": "error",
            // Relax strict rules for development
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-require-imports": "off",
            "no-empty": "off",
            "no-unused-labels": "off",
            "no-undef": "off",
            "no-redeclare": "off",
            "@typescript-eslint/no-duplicate-enum-values": "off",
            "no-prototype-builtins": "warn",
            "no-useless-escape": "warn",
            "no-constant-binary-expression": "warn"
        },
        settings: {
            "import/resolver": {
                "typescript": {
                "alwaysTryTypes": true,
                "project": "./tsconfig.json"
                }
            }
        }
    },
    {
        // Ignore certain files that might not be in the main tsconfig
        ignores: [
            "node_modules/**",
            "dist/**",
            "*.js",
            "**/*.js"
        ]
    }
];
