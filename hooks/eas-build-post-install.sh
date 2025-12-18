#!/bin/bash

# EAS Build Hook: Post-install Podfile modification
# This runs AFTER pod install to fix iOS 26 SDK compatibility issues

echo "🔧 Applying iOS 26 SDK compatibility fixes to Podfile..."

cd ios 2>/dev/null || exit 0

if [ ! -f "Podfile" ]; then
  echo "⚠️  No Podfile found, skipping..."
  exit 0
fi

# Add post_install hook to suppress non-modular header warnings
cat >> Podfile << 'EOF'

# CRITICAL: iOS 26 SDK Compatibility Fix
# React Native 0.81.5 headers are not fully modularized
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Allow non-modular includes in framework modules
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      # Downgrade specific warning to non-error
      config.build_settings['WARNING_CFLAGS'] ||= '$(inherited)'
      config.build_settings['WARNING_CFLAGS'] += ' -Wno-error=non-modular-include-in-framework-module'
    end
  end
  
  puts "✅ iOS 26 SDK compatibility fixes applied to all pods"
end
EOF

echo "✅ Podfile patched successfully"

