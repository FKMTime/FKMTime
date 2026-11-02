import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import prettier from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
    { ignores: ["dist", "src/vite-env.d.ts", "src/main.tsx"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    prettierConfig,
    {
        languageOptions: { globals: globals.browser },
        plugins: {
            prettier,
            "react-refresh": reactRefresh,
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            "prettier/prettier": "warn",
            "no-shadow": "error",
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],
            "no-console": "error",
            "simple-import-sort/imports": "error",
            // Added by eslint-plugin-react-hooks 7, turned off until existing code is fixed
            "react-hooks/immutability": "off",
            "react-hooks/incompatible-library": "off",
            "react-hooks/purity": "off",
            "react-hooks/refs": "off",
            "react-hooks/set-state-in-effect": "off",
        },
    },
];
