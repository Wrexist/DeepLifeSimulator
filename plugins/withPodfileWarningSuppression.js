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
      
      // Check if the warning suppression code is already added (check for both markers)
      if (podfileContent.includes('iOS 26 SDK Compatibility Fix') ||
          podfileContent.includes('Disable Fabric for third-party components')) {
        console.log('✅ Podfile already has warning suppression code');
        return config;
      }

      // Code to insert INSIDE existing post_install block
      // NOTE: This plugin is now redundant since withDisableFabricComponents includes all fixes
      // Keeping it for backward compatibility, but it will skip if Fabric plugin already ran
      const warningSuppressionCode = `
  # CRITICAL: iOS 26 SDK Compatibility Fix + Fabric Disable
  # React Native 0.81.5 headers are not fully modularized
  # Also disables Fabric to prevent RCTThirdPartyComponentsProvider crash
  # This post_install hook applies build settings to ALL pods
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # CRITICAL: Force disable New Architecture/Fabric
      # This prevents the "attempt to insert nil object" crash in RCTThirdPartyComponentsProvider
      config.build_settings['RCT_NEW_ARCH_ENABLED'] = '0'
      
      # Layer 1: Allow non-modular includes in framework modules
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      
      # Layer 2: Downgrade specific warning to non-error
      config.build_settings['WARNING_CFLAGS'] ||= '$(inherited)'
      config.build_settings['WARNING_CFLAGS'] += ' -Wno-error=non-modular-include-in-framework-module'
      
      # Layer 3: Suppress additional strict Xcode 16 warnings
      config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'NO'
      
      # Ensure Hermes is used (not JSC)
      config.build_settings['USE_HERMES'] = 'true'
    end
  end
  puts "✅ iOS 26 SDK compatibility fixes + Fabric disabled for \#{installer.pods_project.targets.count} pods"
`;

      // Find existing post_install block and insert code BEFORE the final 'end'
      const postInstallPattern = /(post_install do \|installer\|[\s\S]*?)(^\s*end\s*$)/m;
      const match = podfileContent.match(postInstallPattern);
      
      if (match) {
        // Insert code before the final 'end' of existing post_install block
        podfileContent = podfileContent.replace(
          postInstallPattern,
          `$1${warningSuppressionCode}$2`
        );
      } else {
        // No existing post_install block, create a new one
        const newPostInstall = `
# CRITICAL: iOS 26 SDK Compatibility Fix
post_install do |installer|
${warningSuppressionCode}end
`;
        podfileContent += newPostInstall;
      }

      fs.writeFileSync(podfilePath, podfileContent, 'utf8');
      console.log('✅ Added iOS 26 SDK compatibility fixes to Podfile');

      return config;
    },
  ]);
};

