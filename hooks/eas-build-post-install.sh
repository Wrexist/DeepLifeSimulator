#!/bin/bash

# EAS Build Hook: Podfile modification for iOS 26 SDK compatibility
# This runs AFTER npx expo prebuild but BEFORE pod install

echo "🔧 Applying iOS 26 SDK compatibility fixes to Podfile..."

cd ios 2>/dev/null || {
  echo "⚠️  No ios directory found, skipping..."
  exit 0
}

if [ ! -f "Podfile" ]; then
  echo "⚠️  No Podfile found, skipping..."
  exit 0
fi

# Check if already patched (idempotent)
if grep -q "iOS 26 SDK Compatibility Fix" Podfile; then
  echo "✅ Podfile already patched, skipping..."
  exit 0
fi

# Add post_install hook to suppress non-modular header warnings
cat >> Podfile << 'EOF'

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
  
  puts "✅ iOS 26 SDK compatibility fixes applied to #{installer.pods_project.targets.count} pods"
end
EOF

echo "✅ Podfile patched successfully - iOS 26 SDK fixes will apply to all pods"

