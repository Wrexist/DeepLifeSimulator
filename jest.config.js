module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*\\.(png|jpg|jpeg|gif|svg))$': '<rootDir>/__mocks__/fileMock.ts',
    '^@/(.*)$': '<rootDir>/$1',
    '^.+\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.ts',
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
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '<rootDir>/lib/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/__tests__/**/*.{ts,tsx}',
    '<rootDir>/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '[\\\\/]node_modules[\\\\/]',
    '[\\\\/]__tests__[\\\\/]helpers[\\\\/]',
    '[\\\\/]lib[\\\\/]skillTrees[\\\\/]__tests__[\\\\/]careerSkillTrees\\.test\\.ts$',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  verbose: true,
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|react-native|@react-native|@react-navigation)/)',
  ],
};
