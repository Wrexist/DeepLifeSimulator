/**
 * Entry point for the demo-save generator.
 *
 * Exists purely for import ordering: the app's modules read the React Native
 * `__DEV__` global at module-evaluation time (`utils/logger.ts`), and ES import
 * hoisting means anything set in `demoSave.ts` itself would run too late. This
 * file sets the globals first, then pulls the generator in with a lazy
 * `require`.
 *
 * `__DEV__ = true` also selects the dev HMAC fallback key in
 * `utils/saveSigningConfig.ts`, which is what makes the emitted envelope verify
 * against a local `expo start --web` build. To generate saves for a production
 * build, set EXPO_PUBLIC_SAVE_HMAC_KEY in the environment before running.
 */

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { main } = require('./demoSave') as typeof import('./demoSave');

main();
