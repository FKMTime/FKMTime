module.exports = {
    root: true,
    env: {browser: true, es2020: true},
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'prettier'
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh', 'simple-import-sort', 'prettier'],
    rules: {
        'prettier/prettier': 'warn',
        'react-refresh/only-export-components': [
            'warn',
            {allowConstantExport: true},
        ],
        'no-console': 'error',
        'simple-import-sort/imports': 'error',
    },
}
