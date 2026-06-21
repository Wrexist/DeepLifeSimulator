// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const path = require('path');

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        // Jest globals
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        // Node globals
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        global: "readonly",
        Buffer: "readonly",
        console: "readonly",
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: path.resolve(__dirname, './tsconfig.json'),
        },
      },
    },
    rules: {
      // Allow @/ imports - they're resolved by TypeScript
      'import/no-unresolved': ['off'],
      // Game copy uses apostrophes and quotes; escaping hurts readability in RN Text
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // --- Type-safety guardrails (Round 11 §0.5) -----------------------------
    // Scoped to TS/TSX only: `@typescript-eslint` rules + the `as any`
    // selector are meaningless on plain .js (and the plugin isn't registered
    // for .js, which errors). These encode CLAUDE.md Hard Rule #2 ("No `as any`
    // casts") and the recurring root cause in tasks/lessons.md (untyped
    // internal require() degrades return types to any/never). 'warn' globally
    // during the burndown (~320 `as any` + ~95 internal requires remain) for
    // visibility; ratcheted to 'error' per directory as each is cleaned (see
    // the lib/travel block below — the first fully-clean directory). Flip the
    // global severity to 'error' once Sprint 1 completes the burndown.
    files: ["**/*.{ts,tsx}"],
    rules: {
      'no-restricted-syntax': ['warn',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: "No `as any` casts (CLAUDE.md Hard Rule #2) — use a real type or a type guard. For RN-web style shadows, use a typed helper.",
        },
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value=/^@.(lib|utils|contexts)/]",
          message: "Use a static `import` (or `import type` + a typed lazy getter) for internal modules — require() degrades types to any/never. See tasks/lessons.md.",
        },
      ],
      // Block bare @ts-ignore / @ts-nocheck; require a justification on
      // @ts-expect-error. The 4 existing suppressions are all described
      // @ts-expect-error, so this is non-breaking today.
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': true,
        minimumDescriptionLength: 5,
      }],
    },
  },
  {
    // Ratchet: lib/travel is fully clean of `as any` / internal require()
    // (Round 11 §1.1). Enforce at 'error' so it can never regress. Add more
    // directories here as the burndown clears them.
    files: ["lib/travel/**/*.{ts,tsx}"],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: "No `as any` casts (CLAUDE.md Hard Rule #2) — use a real type or a type guard.",
        },
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value=/^@.(lib|utils|contexts)/]",
          message: "Use a static `import` for internal modules — require() degrades types. See tasks/lessons.md.",
        },
      ],
    },
  },
  {
    files: ["jest.setup.js", "**/*.test.{js,ts,tsx}", "**/__tests__/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: {
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      'react/display-name': 'off',
      // Tests legitimately use `as any` (state-corruption fixtures) and require().
      'no-restricted-syntax': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // Node CommonJS tooling scripts (.js and .cjs). The base config's global blocks
    // target {js,jsx,ts,tsx} only, so .cjs files miss Node globals (__dirname, Buffer,
    // …) and trip no-undef. Declare them here so audit/preflight scripts lint cleanly.
    files: ["scripts/**/*.{js,cjs}"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        Buffer: "readonly",
        console: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
];
