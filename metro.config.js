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

module.exports = config;

