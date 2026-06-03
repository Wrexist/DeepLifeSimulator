module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // R6-D: react-native-reanimated was removed to fix the iOS 26 TurboModule
      // crash; the plugin entry is no longer needed. If reanimated is ever
      // re-added, restore `'react-native-reanimated/plugin'` here as the LAST
      // plugin entry.
    ],
  };
};
