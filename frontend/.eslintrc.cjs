module.exports = {
    root: true,
    env: {browser: true, es2020: true},
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'prettier'
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs', 'src/vite-env.d.ts', 'src/main.tsx'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh', 'simple-import-sort', 'prettier'],
    rules: {
        'prettier/prettier': 'warn',
        'no-shadow': 'error',
        'react-refresh/only-export-components': [
            'warn',
            {allowConstantExport: true},
        ],
        'no-console': 'error',
        'simple-import-sort/imports': 'error',
    },
}
