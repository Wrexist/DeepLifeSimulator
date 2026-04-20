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
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
      },
    },
  },
];
