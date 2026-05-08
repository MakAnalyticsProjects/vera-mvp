// ESLint flat config for the @vera/web app.
//
// Next.js 16 dropped the built-in `next lint` wrapper, so we configure
// ESLint directly. Kept deliberately minimal: TypeScript + React + Next.js
// + React-hooks rules, no style plugins (Prettier handles formatting).
//
// Run with `pnpm --filter @vera/web lint` (script in package.json).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

export default [
  // Ignored everywhere so lint doesn't touch generated/build output.
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'next-env.d.ts',
      'prisma/migrations/**',
    ],
  },

  // Base recommended JS rules.
  js.configs.recommended,

  // TypeScript rules — ts-eslint flat presets.
  ...tseslint.configs.recommended,

  // App source: TS + React + Next.js + hooks rules.
  {
    files: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'middleware.ts', 'types/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      // React 19 + Next.js automatic JSX runtime — these rules are obsolete.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // Hooks rules of thumb.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Next.js essential set.
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Project-specific:
      // We allow `_` prefix to mark intentionally-unused args/vars.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // CLAUDE.md forbids `any`. Errors land here instead of in tsc.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // Prisma seed + scripts run in Node only — relax the React rules.
  {
    files: ['prisma/**/*.ts', 'scripts/**/*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },

  // Auth.js v5 has TS inference quirks in monorepo workspaces. The
  // `lib/auth.ts` and `middleware.ts` files use a small set of `any`
  // escape hatches that are documented inline. Don't penalize.
  {
    files: ['lib/auth.ts', 'lib/auth.config.ts', 'middleware.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
