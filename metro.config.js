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

module.exports = config;

