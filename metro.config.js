// CRITICAL: Polyfill toReversed() for Node.js < 20
// This must run BEFORE Metro config is loaded
// eslint-disable-next-line no-extend-native
if (!Array.prototype.toReversed) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

// Import and re-export Expo Metro config
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Native-only modules stubbed out of WEB bundles. AdMobService already
// lazy-requires these behind try/catch (per DEV.md), which covers runtime —
// but `expo export --platform web` resolves every require() statically and
// fails on packages that ship no web entry. Aliasing them to an empty stub
// keeps web dev/export working without touching native builds.
const NATIVE_ONLY_MODULES = new Set(['react-native-google-mobile-ads']);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY_MODULES.has(moduleName)) {
    return { type: 'empty' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// The character head ships as a binary glTF. Metro's default assetExts has no
// `glb`, so without this `require('.../head_ict.glb')` is resolved as a JS
// module and the bundle fails — at build time, which is at least loud.
if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb');
}

module.exports = config;

