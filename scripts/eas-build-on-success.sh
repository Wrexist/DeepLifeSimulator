#!/bin/bash
# This script runs after pod install on EAS Build
# It patches the Folly Portability.h to disable coroutines

echo "🔧 Patching Folly to disable coroutines..."

# Find and patch Portability.h
FOLLY_FILE=$(find ios/Pods -name "Portability.h" -path "*RCT-Folly*" 2>/dev/null | head -1)

if [ -f "$FOLLY_FILE" ]; then
  echo "Found Folly at: $FOLLY_FILE"
  # Replace FOLLY_HAS_COROUTINES 1 with FOLLY_HAS_COROUTINES 0
  sed -i.bak 's/#define FOLLY_HAS_COROUTINES 1/#define FOLLY_HAS_COROUTINES 0/g' "$FOLLY_FILE"
  echo "✅ Patched FOLLY_HAS_COROUTINES to 0"
else
  echo "⚠️ Folly Portability.h not found"
fi

