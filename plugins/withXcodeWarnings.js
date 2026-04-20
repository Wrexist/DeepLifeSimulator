/**
 * Expo config plugin to suppress non-modular header warnings in Xcode
 * 
 * This fixes the iOS 26 SDK build error:
 * "include of non-modular header inside framework module 'React'"
 * 
 * The error occurs because iOS 26 SDK has stricter module header requirements
 * than React Native 0.81.5 was designed for.
 */

const { withXcodeProject } = require('@expo/config-plugins');

module.exports = function withXcodeWarnings(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;

    // Get all build configurations
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    for (const key in configurations) {
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings) {
        // Suppress non-modular header warning
        // This is safe - it only downgrades the error to a warning
        buildSettings.CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = 'YES';
        
        // Optional: Also suppress other strict warnings that might cause issues
        buildSettings.GCC_WARN_INHIBIT_ALL_WARNINGS = 'NO'; // Keep warnings, just not as errors
      }
    }

    return config;
  });
};

