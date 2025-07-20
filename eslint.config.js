import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import tsdoc from 'eslint-plugin-tsdoc';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'],
        createDefaultProgram: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier: prettier,
      tsdoc: tsdoc,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...typescript.configs['recommended-requiring-type-checking'].rules,
      ...typescript.configs.strict.rules,
      ...prettierConfig.rules,
      'max-len': 'off',
      'tsdoc/syntax': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // 'no-console': 'warn', // Allow console statements
    },
  },
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        Audio: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['api/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        localStorage: 'readonly',
        Audio: 'readonly',
        console: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    files: ['setup/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        global: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.eslintrc.cjs',
      'coverage/**',
      'dist/**',
      'build/**',
      '*.html',
      'eslint.config.js',
    ],
  },
];
