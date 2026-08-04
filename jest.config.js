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
  },
  moduleNameMapper: {
    '^@/(.*\\.(png|jpg|jpeg|gif|svg|webp))$': '<rootDir>/__mocks__/fileMock.ts',
    '^@/(.*)$': '<rootDir>/$1',
    '^.+\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.ts',
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
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
    '[\\\\/]lib[\\\\/]skillTrees[\\\\/]__tests__[\\\\/]careerSkillTrees\\.test\\.ts$',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  // Avoid parallel OOM / SIGTERM on large suites (criticalPaths + stress together)
  maxWorkers: process.env.CI === 'true' ? 2 : '50%',
  verbose: true,
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|react-native|@react-native|@react-navigation)/)',
  ],
};
