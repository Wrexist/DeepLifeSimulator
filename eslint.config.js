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
    /**
     * Ratchet: these directories are fully clean of `as any` and internal
     * `require()`. Enforced at 'error' so they can never regress.
     *
     * `lib/travel` was the first (Round 11 §1.1) and sat alone for months. On
     * 2026-08-14 a count showed 48 of lib's 58 directories were ALREADY clean
     * and simply unprotected — the burndown had been happening as a side effect
     * of ordinary work, and nothing was locking it in. Four more
     * (`ambitions`, `config`, `legacy`, `notifications`) were cleared in the
     * same change to join them.
     *
     * Three of the six that were held back — `economy`, `social`, `timeMachine`
     * — joined on 2026-08-14. Their ten lazy `require()` calls were checked one
     * at a time against the STATIC import graph, asking of each "does the target
     * already reach this file?". None did: not one was a cycle-breaker. The
     * modules they pulled in were also confirmed side-effect-free at top level,
     * so making them eager changes nothing at startup — a lazy require defers
     * module EVALUATION, not just typing, and that half is invisible to a type
     * checker.
     *
     * Add directories here as the burndown clears them. The remaining three —
     * events, prestige, simulation — are still held back by internal
     * `require()`, and are the ones where a cycle is actually plausible.
     */
    files: [
      "lib/ads/**/*.{ts,tsx}", "lib/ambitions/**/*.{ts,tsx}", "lib/analytics/**/*.{ts,tsx}",
      "lib/avatar/**/*.{ts,tsx}", "lib/banking/**/*.{ts,tsx}", "lib/business/**/*.{ts,tsx}",
      "lib/careers/**/*.{ts,tsx}", "lib/challenges/**/*.{ts,tsx}", "lib/commitments/**/*.{ts,tsx}",
      "lib/config/**/*.{ts,tsx}", "lib/contacts/**/*.{ts,tsx}", "lib/content/**/*.{ts,tsx}",
      "lib/cosmetics/**/*.{ts,tsx}", "lib/crime/**/*.{ts,tsx}", "lib/crypto/**/*.{ts,tsx}",
      "lib/darkweb/**/*.{ts,tsx}", "lib/dating/**/*.{ts,tsx}", "lib/depth/**/*.{ts,tsx}",
      "lib/devtools/**/*.{ts,tsx}", "lib/diseases/**/*.{ts,tsx}", "lib/dynasty/**/*.{ts,tsx}",
      "lib/economy/**/*.{ts,tsx}",
      "lib/education/**/*.{ts,tsx}", "lib/gameLogic/**/*.{ts,tsx}", "lib/karma/**/*.{ts,tsx}",
      "lib/legacy/**/*.{ts,tsx}", "lib/legacyPass/**/*.{ts,tsx}", "lib/lifeMoments/**/*.{ts,tsx}",
      "lib/luxury/**/*.{ts,tsx}", "lib/mail/**/*.{ts,tsx}", "lib/mindset/**/*.{ts,tsx}",
      "lib/notifications/**/*.{ts,tsx}", "lib/parenting/**/*.{ts,tsx}", "lib/pets/**/*.{ts,tsx}",
      "lib/politics/**/*.{ts,tsx}", "lib/progress/**/*.{ts,tsx}", "lib/pursuits/**/*.{ts,tsx}",
      "lib/randomness/**/*.{ts,tsx}", "lib/rd/**/*.{ts,tsx}", "lib/realEstate/**/*.{ts,tsx}",
      "lib/reputation/**/*.{ts,tsx}", "lib/retirement/**/*.{ts,tsx}", "lib/scenarios/**/*.{ts,tsx}",
      "lib/shop/**/*.{ts,tsx}", "lib/skillTrees/**/*.{ts,tsx}", "lib/social/**/*.{ts,tsx}",
      "lib/statistics/**/*.{ts,tsx}",
      "lib/stocks/**/*.{ts,tsx}", "lib/subscription/**/*.{ts,tsx}",
      "lib/timeMachine/**/*.{ts,tsx}", "lib/travel/**/*.{ts,tsx}",
      "lib/types/**/*.{ts,tsx}", "lib/utils/**/*.{ts,tsx}", "lib/validation/**/*.{ts,tsx}",
      "lib/vehicles/**/*.{ts,tsx}",
    ],
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
