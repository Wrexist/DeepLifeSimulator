/**
 * Expo config plugin to add Podfile post_install hook for iOS 26 SDK compatibility
 * 
 * This adds a post_install hook to the Podfile that applies warning suppressions
 * to ALL pods, fixing the "include of non-modular header" errors with iOS 26 SDK.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withPodfileWarningSuppression(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        // Podfile doesn't exist yet, skip (will be created during prebuild)
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      // Check if the post_install hook is already added
      if (podfileContent.includes('iOS 26 SDK Compatibility Fix')) {
        console.log('✅ Podfile already has warning suppression hook');
        return config;
      }

      // Find the end of the file or existing post_install block
      const postInstallPattern = /post_install do \|installer\|[\s\S]*?^end\s*$/m;
      const hasPostInstall = postInstallPattern.test(podfileContent);

      const warningSuppressionHook = `
# CRITICAL: iOS 26 SDK Compatibility Fix
# React Native 0.81.5 headers are not fully modularized
# This post_install hook applies build settings to ALL pods
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Layer 1: Allow non-modular includes in framework modules
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      
      # Layer 2: Downgrade specific warning to non-error
      config.build_settings['WARNING_CFLAGS'] ||= '$(inherited)'
      config.build_settings['WARNING_CFLAGS'] += ' -Wno-error=non-modular-include-in-framework-module'
      
      # Layer 3: Suppress additional strict Xcode 16 warnings
      config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'NO'
    end
  end
  
  puts "✅ iOS 26 SDK compatibility fixes applied to \#{installer.pods_project.targets.count} pods"
end
`;

      if (hasPostInstall) {
        // Append to existing post_install block
        podfileContent = podfileContent.replace(
          /(post_install do \|installer\|[\s\S]*?)(^end\s*$)/m,
          `$1${warningSuppressionHook}$2`
        );
      } else {
        // Add new post_install block at the end
        podfileContent += warningSuppressionHook;
      }

      fs.writeFileSync(podfilePath, podfileContent, 'utf8');
      console.log('✅ Added iOS 26 SDK compatibility fixes to Podfile');

      return config;
    },
  ]);
};

