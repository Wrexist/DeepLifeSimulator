#!/bin/bash

# Verification script to check if RCTThirdPartyComponentsProvider.mm was patched correctly
# This can be run manually or added to CI/CD pipeline

set -e

echo "🔍 Verifying RCTThirdPartyComponentsProvider.mm patch..."

# Search for the file
FOUND_FILE=$(find . -name "RCTThirdPartyComponentsProvider.mm" -type f 2>/dev/null | head -1)

if [ -z "$FOUND_FILE" ]; then
  echo "⚠️  RCTThirdPartyComponentsProvider.mm not found"
  echo "   This is normal if codegen hasn't run yet"
  exit 0
fi

echo "📄 Found file at: $FOUND_FILE"

# Check if file contains the patch
if grep -q "return @{};" "$FOUND_FILE" && grep -q "thirdPartyFabricComponents" "$FOUND_FILE"; then
  echo "✅ Patch verification PASSED"
  echo "   File contains 'return @{};' and 'thirdPartyFabricComponents'"
  
  # Show the patched method
  echo ""
  echo "📋 Patched method:"
  grep -A 2 "thirdPartyFabricComponents" "$FOUND_FILE" | head -3
  exit 0
else
  echo "❌ Patch verification FAILED"
  echo "   File does not contain expected patch markers"
  
  # Show what we found
  if grep -q "thirdPartyFabricComponents" "$FOUND_FILE"; then
    echo ""
    echo "⚠️  Method found but not patched:"
    grep -A 5 "thirdPartyFabricComponents" "$FOUND_FILE" | head -10
  else
    echo "   Method 'thirdPartyFabricComponents' not found in file"
  fi
  
  exit 1
fi

