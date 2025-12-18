// CRITICAL: Polyfill toReversed() for Node.js < 20
// This must run BEFORE Metro config is loaded
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

// Import and re-export Expo Metro config
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;

