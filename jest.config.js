module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*\\.(png|jpg|jpeg|gif|svg))$': '<rootDir>/__mocks__/fileMock.ts',
    '^@/(.*)$': '<rootDir>/$1',
    '^.+\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.ts',
  },
};
