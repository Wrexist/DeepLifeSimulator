module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated/plugin MUST be the last plugin
      // 'react-native-reanimated/plugin', // REMOVED - package removed to fix TurboModule crash
    ],
  };
};
