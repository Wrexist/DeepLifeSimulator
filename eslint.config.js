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
          // DESCENDANT, not `>`. The child selector only saw a bare `as any`, so
          // the whole `as unknown as Record<string, any>` family walked straight
          // past Hard Rule #2 — and that is the shape that actually does damage:
          // it erases the type AND invents a plausible-looking index signature,
          // so fabricated field names compile and read `undefined` forever
          // (`lib/depth/discoverySystem.ts` had six of them; 2026-08-16 audit H1).
          // `TSAsExpression > TSAnyKeyword` is a strict subset of this, so the
          // old rule is subsumed rather than kept alongside it (which would
          // double-report every bare `as any`).
          selector: 'TSAsExpression TSAnyKeyword',
          message: "No `any` inside a type assertion (CLAUDE.md Hard Rule #2) — this covers `as any` AND `as unknown as Record<string, any>`. Use a real type or a type guard. For RN-web style shadows, use a typed helper.",
        },
        {
          // The old pattern was `/^@.(lib|utils|contexts)/`, which had two holes
          // (2026-08-16 audit L2). It listed only three alias roots, so
          // `require('@/services/…')`, `@/hooks`, `@/components` and `@/src` all
          // walked past it; and it matched only ALIASED specifiers, so the same
          // module required by RELATIVE path (`require('../utils/crashRecovery')`
          // in app/_layout.tsx) was invisible — which is the shape that actually
          // shipped a hazard: an untyped require returns `any`, so a rename of
          // `initializeCrashRecovery` would compile, read `undefined`, and
          // silently disable crash recovery at boot.
          //
          // `\x2f` is a literal `/`: esquery's regex token is delimited by `/`
          // and has no escape mechanism, so the slash cannot be written directly
          // inside the selector. (The unescaped `.` in the old pattern was also
          // a wildcard rather than the intended `/`.)
          //
          // Severity is unchanged — 'warn' app-wide, 'error' inside the ratcheted
          // lib/ directories below — so widening it surfaces the forms without
          // turning a burndown into a build break.
          selector: "CallExpression[callee.name='require'][arguments.0.value=/^(@\\x2f(lib|utils|contexts|services|hooks|components|src)|\\.\\.?\\x2f)/]",
          message: "Use a static `import` (or `import type` + a typed lazy getter) for internal modules — require() degrades types to any/never. Covers both `@/…` aliases and relative (`./`, `../`) specifiers. See tasks/lessons.md.",
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
     * Five of the six that were held back — `economy`, `social`, `timeMachine`,
     * `events`, `prestige` — joined on 2026-08-14. All thirty of their lazy
     * `require()` calls were checked one at a time against the STATIC import
     * graph, asking of each "does the target already reach this file?".
     * Twenty-nine did not: they were not cycle-breakers, and the reason given
     * for holding these directories back was never true. The modules they
     * pulled in were also confirmed side-effect-free at top level, since a lazy
     * require defers module EVALUATION and not just typing — the half a type
     * checker cannot see.
     *
     * The thirtieth (`lib/prestige/prestigeTypes.ts`) is genuine and stays,
     * with a line-level disable and the measurements behind it in a comment.
     * It is a weight argument, not a cycle, and it was already typed.
     *
     * `lib/markets` and `lib/spark` joined on 2026-08-17. Both are directories
     * added AFTER the 2026-08-14 sweep and both were already clean, so the
     * enumeration had drifted behind `lib/` again — the list is meant to be
     * "every clean directory", and a new directory silently outside it is the
     * same unlocked-in state the sweep was fixing.
     *
     * Only `lib/simulation` remains. Its requires are not a cycle either — they
     * reach into `contexts/game/*`, so making them static would bake a
     * lib → contexts inversion into the module graph, and it is ~10k LOC of
     * dev/QA tooling already dead-code-eliminated from release bundles by the
     * `__DEV__`-folded require in SettingsModal. A boundary, not a knot.
     */
    files: [
      "lib/ads/**/*.{ts,tsx}", "lib/ambitions/**/*.{ts,tsx}", "lib/analytics/**/*.{ts,tsx}",
      "lib/liveops/**/*.{ts,tsx}",
      "lib/avatar/**/*.{ts,tsx}", "lib/banking/**/*.{ts,tsx}", "lib/business/**/*.{ts,tsx}",
      "lib/careers/**/*.{ts,tsx}", "lib/challenges/**/*.{ts,tsx}", "lib/commitments/**/*.{ts,tsx}",
      "lib/config/**/*.{ts,tsx}", "lib/contacts/**/*.{ts,tsx}", "lib/content/**/*.{ts,tsx}",
      "lib/cosmetics/**/*.{ts,tsx}", "lib/crime/**/*.{ts,tsx}", "lib/crypto/**/*.{ts,tsx}",
      "lib/darkweb/**/*.{ts,tsx}", "lib/dating/**/*.{ts,tsx}", "lib/depth/**/*.{ts,tsx}",
      "lib/devtools/**/*.{ts,tsx}", "lib/diseases/**/*.{ts,tsx}", "lib/dynasty/**/*.{ts,tsx}",
      "lib/economy/**/*.{ts,tsx}",
      "lib/education/**/*.{ts,tsx}", "lib/events/**/*.{ts,tsx}",
      "lib/karma/**/*.{ts,tsx}",
      "lib/legacy/**/*.{ts,tsx}", "lib/legacyPass/**/*.{ts,tsx}", "lib/lifeMoments/**/*.{ts,tsx}",
      "lib/luxury/**/*.{ts,tsx}", "lib/mail/**/*.{ts,tsx}", "lib/markets/**/*.{ts,tsx}",
      "lib/mindset/**/*.{ts,tsx}",
      "lib/notifications/**/*.{ts,tsx}", "lib/parenting/**/*.{ts,tsx}", "lib/pets/**/*.{ts,tsx}",
      "lib/politics/**/*.{ts,tsx}", "lib/prestige/**/*.{ts,tsx}",
      "lib/progress/**/*.{ts,tsx}", "lib/pursuits/**/*.{ts,tsx}",
      "lib/randomness/**/*.{ts,tsx}", "lib/rd/**/*.{ts,tsx}", "lib/realEstate/**/*.{ts,tsx}",
      "lib/reputation/**/*.{ts,tsx}", "lib/retirement/**/*.{ts,tsx}", "lib/scenarios/**/*.{ts,tsx}",
      "lib/shop/**/*.{ts,tsx}", "lib/skillTrees/**/*.{ts,tsx}", "lib/social/**/*.{ts,tsx}",
      "lib/spark/**/*.{ts,tsx}", "lib/statistics/**/*.{ts,tsx}",
      "lib/stocks/**/*.{ts,tsx}", "lib/subscription/**/*.{ts,tsx}",
      "lib/timeMachine/**/*.{ts,tsx}", "lib/travel/**/*.{ts,tsx}",
      "lib/types/**/*.{ts,tsx}", "lib/utils/**/*.{ts,tsx}", "lib/validation/**/*.{ts,tsx}",
      "lib/vehicles/**/*.{ts,tsx}",
    ],
    rules: {
      'no-restricted-syntax': ['error',
        {
          // Descendant, mirroring the app-wide block above: catches
          // `as unknown as Record<string, any>` as well as a bare `as any`.
          selector: 'TSAsExpression TSAnyKeyword',
          message: "No `any` inside a type assertion (CLAUDE.md Hard Rule #2) — this covers `as any` AND `as unknown as Record<string, any>`. Use a real type or a type guard.",
        },
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value=/^@.(lib|utils|contexts)/]",
          message: "Use a static `import` for internal modules — require() degrades types. See tasks/lessons.md.",
        },
      ],
    },
  },
  {
    /**
     * --- Layering boundary: `lib/` may not import upward (audit H6) ----------
     *
     * The app's one-way direction is `app|components → contexts → lib → lib/config`.
     * Until 2026-08-16 that was asserted in comments and enforced nowhere: five
     * `lib/` modules statically imported executable code from `contexts/` or
     * `services/`, in directories the ratchet block above already errors on —
     * the require()-based rule there cannot see a static `import`. Three of the
     * five were pure symbols sitting one layer too high and have been moved DOWN
     * (`RAISE_MIN_PERFORMANCE` → `lib/careers/raisePremium`,
     * `calculateMiningEarnings` → `lib/crypto/miningEarnings`, `applyMoneyDelta`
     * → `lib/economy/moneyDelta`), with the old locations re-exporting them.
     *
     * Why it is worth a rule rather than vigilance: an upward edge that closes a
     * cycle does not fail the build. It surfaces as `undefined` at module init,
     * and `lib/mail` and `lib/crypto` are both on the week-loop path, where that
     * reads as a lost week for the save. Measured on 2026-08-16: zero true
     * cycles today, and `lib/mail` was one import away from one.
     *
     * `allowTypeImports` keeps `import type` legal in both directions — tsc
     * erases those edges, so they cannot form a runtime cycle. `@/contexts/game/types`
     * is exempted outright because it is a types-only module whose every import
     * is itself type-only (the same reasoning the cycle audit used), and ~80
     * `lib/` files import from it with value syntax.
     */
    files: ["lib/**/*.{ts,tsx}"],
    ignores: [
      "lib/**/__tests__/**",
      "lib/**/*.test.{ts,tsx}",
      /**
       * Sanctioned directories, not oversights — each is a consumer of the
       * upper layers by nature rather than a domain module that leaked one.
       *
       * `lib/simulation` — ~10k LOC of dev/QA tooling that drives the real
       * action modules on purpose; already dead-code-eliminated from release
       * bundles by the `__DEV__`-folded require in SettingsModal, and already
       * documented as a boundary (not a cycle) in the ratchet block above.
       * `lib/devtools` — same shape: `simulations.ts` exercises ~20 action
       * modules and the weekly subsystems to prove they still behave.
       * `lib/analytics` — `AnalyticsTracker.tsx` is a React component that must
       * subscribe to game context, and `AnalyticsService` wraps the Firebase
       * service singleton. Both are adapters between layers, not game logic.
       */
      "lib/simulation/**",
      "lib/devtools/**",
      "lib/analytics/**",
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            // A regex rather than a gitignore-style `group`, because the one
            // exemption has to be a NEGATION and `group`'s `!` form does not
            // fire for aliased specifiers here. Covers the `@/` alias and the
            // relative escapes (`../../contexts/…`) that reach the same places.
            // `@/contexts/game/types` is the sole allowed path — types only.
            regex:
              '^(?!@/contexts/game/types$)(@/(contexts|components|app|services|hooks)(/|$)|(\\.\\./)+(contexts|components|app|services|hooks)(/|$))',
            allowTypeImports: true,
            message:
              "lib/ must not import VALUES from contexts|components|app|services|hooks — that inverts the app's layering and an upward edge that closes a cycle reads as `undefined` at module init inside the week loop, not as a build error (audit H6). Move the symbol DOWN into lib/ and re-export it from the old location, or use `import type` if you only need the type.",
          },
        ],
      }],
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
  {
    // Node ESM tooling scripts (.mjs). Same no-undef gap as the CommonJS block
    // above — the base config's global blocks target {js,jsx,ts,tsx} only — but
    // deliberately NOT the same global list: __dirname, __filename, require,
    // module and exports genuinely do not exist in an ES module, so declaring
    // them here would silence no-undef on a real runtime crash instead of a
    // false positive. Only globals that actually exist under ESM belong here.
    //
    // The gap was invisible until 2026-08-28, when a new .mjs script used
    // Buffer and broke `npm run lint` on main. Node exposes Buffer globally at
    // runtime, so this is a lint-only fix; scripts should still prefer the
    // explicit `import { Buffer } from 'node:buffer'` the ESM scripts here use.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
  },
];
