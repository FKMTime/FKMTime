import prettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  // src/generated is Prisma Client, written by `prisma generate`
  { ignores: ['dist', 'eslint.config.mjs', 'src/generated'] },
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'module',
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-shadow': 'error',
      'simple-import-sort/imports': 'error',
    },
  },
];
