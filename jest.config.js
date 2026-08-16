module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
    // Plain JS needs a transform too, or nothing in `node_modules` can be
    // converted from ESM however permissive `transformIgnorePatterns` is —
    // the ignore list only decides WHAT is offered to a transform, not whether
    // one exists for the extension.
    '^.+\\.(js|jsx|mjs)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*\\.(png|jpg|jpeg|gif|svg|webp))$': '<rootDir>/__mocks__/fileMock.ts',
    // Platform-suffixed module: only `offlineManager.native.ts` / `.web.ts`
    // exist, which Metro picks between at build time and Jest's resolver cannot
    // — so `@/utils/offlineManager` resolved to NOTHING under Jest and any
    // suite touching an importer of it (CloudSyncService, OfflineIndicator)
    // died with a configuration error before running a line. Pinned to the
    // native variant, which is what the shipped app loads on both stores.
    '^@/utils/offlineManager$': '<rootDir>/utils/offlineManager.native.ts',
    '^@/(.*)$': '<rootDir>/$1',
    '^.+\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.ts',
  },
  // Scope note (2026-08-04): `app/`, `services/` and `src/` were NOT in this list.
  //
  // That silently excluded the highest-risk code in the repo from every coverage
  // number and from the ratchet floors derived from them: the whole expo-router
  // tree (`_layout.tsx` boot/providers, `work.tsx`, `home.tsx`), all of
  // `services/` (IAPService, RevenueCat, AdMob, Firebase, cloud sync), and the
  // onboarding flow. The reported figure was not the app's coverage — it was the
  // coverage of the part that is easiest to test, and payments and boot could
  // never trip the gate no matter how far they regressed.
  //
  // Widening the scope MOVES the measured numbers, so the floors in
  // `scripts/lib/coverageRatchet.js` were re-measured in the same change. That
  // is the honest direction: the floors follow the scope, never the other way
  // round.
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  // The 70% threshold that used to live here was NEVER met — actual is
  // statements 48.92 / branches 30.45 / functions 38.83 / lines 50.23 — so
  // `test:coverage` and `test:ci` exited non-zero from the day it landed
  // (2026-07-11). Nothing was blocked, since CI runs `npm test -- --ci` without
  // coverage, and that is what made it corrosive: a gate that cannot pass
  // trains you to skim the failure.
  //
  // It is NOT lowered to match reality — that would be green today and silent
  // on tomorrow's regression. Enforcement moved to a ratchet that fails only on
  // a DROP, with 70 kept as a stated goal:
  //
  //   npm run coverage:ratchet     (after npm run test:coverage)
  //
  // See scripts/lib/coverageRatchet.js.
  coverageReporters: ['text', 'lcov', 'json-summary'],
  testMatch: [
    '<rootDir>/lib/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/__tests__/**/*.{ts,tsx}',
    '<rootDir>/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '[\\\\/]node_modules[\\\\/]',
    '[\\\\/]__tests__[\\\\/]helpers[\\\\/]',
    '[\\\\/]__tests__[\\\\/]stress[\\\\/]helpers[\\\\/]',
    '[\\\\/]__tests__[\\\\/]refactor[\\\\/]helpers[\\\\/]',
    '[\\\\/]__tests__[\\\\/]render[\\\\/]helpers[\\\\/]',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  // Avoid parallel OOM / SIGTERM on large suites (criticalPaths + stress together)
  maxWorkers: process.env.CI === 'true' ? 2 : '50%',
  verbose: true,
  transformIgnorePatterns: [
    // @dicebear ships ESM only, so it has to be transformed rather than
    // required raw — without it every suite that touches the avatar system
    // dies on "Cannot use import statement outside a module".
    'node_modules/(?!(expo|@expo|react-native|@react-native|@react-navigation|@dicebear)/)',
  ],
};
