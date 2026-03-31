import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.netlify',
    'coverage',
    'netlify/functions-core/**',
    'netlify/functions/utils/audit-logger-realtime.ts',
    'netlify/functions/utils/mfa.ts',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      // ===== Pragmatic 'any' Rules =====
      // Allow 'any' since TypeScript compiler already provides type safety
      // and strict 'any' enforcement creates too much noise without real value
      '@typescript-eslint/no-explicit-any': 'off',

      // ===== Keep Important Checks =====
      // These catch real bugs and unused code
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],

      // Allow unused expressions (e.g., short-circuit evaluation patterns)
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',

      // React Hooks - keep as warnings to not block builds
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',

      // Allow console statements in development
      'no-console': 'off',
      'preserve-caught-error': 'off',

      // Disable React-in-scope rule (not needed in React 17+)
      'react-refresh/only-export-components': 'warn',

      // ===== Style/Pattern Rules (low priority) =====
      // Allow unnecessary escapes in regex (auto-fixable, cosmetic)
      'no-useless-escape': 'warn',

      // Allow lexical declarations in case blocks (common pattern)
      'no-case-declarations': 'warn',

      // Allow shadowing of restricted names - TypeScript catches actual issues
      'no-shadow-restricted-names': 'warn',
    },
  },
  {
    files: ['netlify/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
])
