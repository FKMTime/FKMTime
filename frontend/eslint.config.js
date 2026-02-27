import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.es2020,
                React: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'simple-import-sort': simpleImportSort,
            prettier: prettierPlugin,
        },
        rules: {
            ...typescript.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'prettier/prettier': 'warn',
            'no-shadow': 'error',
            'react-refresh/only-export-components': [
                'warn',
                {allowConstantExport: true},
            ],
            'no-console': 'error',
            'simple-import-sort/imports': 'error',
        },
    },
    {
        files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },
    prettier,
    {
        ignores: ['dist', 'src/vite-env.d.ts', 'src/main.tsx'],
    },
];
