const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix Folly coroutines issue
 * Patches Podfile to disable Folly coroutines after pod install
 * This fixes the 'folly/coro/Coroutine.h' not found error
 */
const withFollyCoroutinesFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        
        // Check if the patch is already added
        if (!podfileContent.includes('FOLLY_HAS_COROUTINES')) {
          // The Ruby code to patch Folly after pods are installed
          const follyPatch = `
    # Fix Folly coroutines issue - configure Folly settings
    # Note: With New Architecture enabled, coroutines are available, but we still need proper Folly configuration
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Add preprocessor macro to disable coroutines
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_NO_CONFIG=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_MOBILE=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_USE_LIBCPP=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
        
        # Fix non-modular header warning treated as error
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # Disable problematic warnings as errors
        other_cflags = config.build_settings['OTHER_CFLAGS'] || ['$(inherited)']
        other_cflags = [other_cflags] if other_cflags.is_a?(String)
        other_cflags << '-Wno-non-modular-include-in-framework-module'
        config.build_settings['OTHER_CFLAGS'] = other_cflags
      end
    end
    
    # Direct file patch for Portability.h
    folly_portability_path = installer.sandbox.root.to_s + '/RCT-Folly/folly/Portability.h'
    if File.exist?(folly_portability_path)
      system("chmod +w '#{folly_portability_path}'")
      contents = File.read(folly_portability_path)
      modified_contents = contents.gsub(/#define FOLLY_HAS_COROUTINES 1/, '#define FOLLY_HAS_COROUTINES 0')
      File.write(folly_portability_path, modified_contents)
      puts "✅ Patched Folly coroutines in Portability.h"
    else
      puts "⚠️ Folly Portability.h not found at #{folly_portability_path}"
    end
`;
          
          // Find the post_install block or create one
          const postInstallPattern = /post_install do \|installer\|([\s\S]*?)(^\s*end\s*$)/m;
          
          if (postInstallPattern.test(podfileContent)) {
            // Add to existing post_install block (before the final 'end')
            podfileContent = podfileContent.replace(
              postInstallPattern,
              (match, existingContent, endStatement) => {
                return `post_install do |installer|${existingContent}${follyPatch}\n${endStatement}`;
              }
            );
          } else {
            // Create new post_install block at the end
            podfileContent += `\n\npost_install do |installer|${follyPatch}\nend\n`;
          }
          
          fs.writeFileSync(podfilePath, podfileContent, 'utf8');
          console.log('✅ Added Folly coroutines fix to Podfile');
        } else {
          console.log('ℹ️  Folly coroutines fix already present in Podfile');
        }
      } else {
        console.log('⚠️  Podfile not found - will be created during prebuild');
      }
      
      return config;
    },
  ]);
};

module.exports = withFollyCoroutinesFix;
