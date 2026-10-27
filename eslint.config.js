// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

/**
 * Framework adapters whose call signatures are imposed by a third party
 * (Express middleware arity, comparator functions). These are the ONLY files
 * where functions may declare more than one parameter.
 */
const ARITY_ADAPTERS = [
  'apps/server/src/shared/http/express-adapter.ts',
  '**/shared/lib/compare.ts',
]

const NO_CLASSES = {
  selector: 'ClassDeclaration',
  message: 'Functional style: model data with types and behaviour with functions, not classes.',
}

const NO_RAW_JSX = {
  selector: 'JSXOpeningElement[name.type="JSXIdentifier"][name.name=/^[a-z]/]',
  message:
    'Primitive HTML elements are only allowed inside shared/ui. Use a component from @/shared/ui (built on Base UI).',
}

const NO_HOOKS_IN_VIEWS = {
  selector: 'CallExpression[callee.name=/^use[A-Z]/]',
  message: 'Views are pure: hooks may only be called in a *.controller.ts(x) file.',
}

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'data/**',
      '.e2e-data/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', 'apps/*/vitest.config.ts', 'packages/*/vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      'max-params': ['error', 1],
      'no-restricted-syntax': ['error', NO_CLASSES],
      'no-param-reassign': [
        'error',
        { props: true, ignorePropertyModificationsFor: ['event', 'res', 'video'] },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ARITY_ADAPTERS,
    rules: { 'max-params': 'off' },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/shared/ui/**'],
    rules: { 'no-restricted-syntax': ['error', NO_CLASSES, NO_RAW_JSX] },
  },
  {
    files: ['apps/web/src/**/*.view.tsx'],
    rules: { 'no-restricted-syntax': ['error', NO_CLASSES, NO_RAW_JSX, NO_HOOKS_IN_VIEWS] },
  },
  {
    files: ['**/__test__/**', 'e2e/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Test libraries expose `any` (supertest bodies, asymmetric matchers like expect.any).
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Tests deliberately reject with non-Error values to cover defensive branches.
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
)
