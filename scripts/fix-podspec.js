#!/usr/bin/env node
/* eslint-env node */

/**
 * Fix for ExpoHead.podspec issue where add_dependency receives nil spec parameter
 * This script patches the podspec file to use the correct syntax
 * 
 * This script runs as a postinstall hook to patch podspec files before pod install
 */

const fs = require('fs');
const path = require('path');

// Helper function to get timestamp for logging
function getTimestamp() {
  return new Date().toISOString();
}

// Verification function to check if patch was applied
function verifyPatch(filePath, checkFunction) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return checkFunction(content);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error verifying patch for ${filePath}:`, error.message);
    return false;
  }
}

const expoRouterPodspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-router',
  'ios',
  'ExpoHead.podspec'
);

// Path to Folly Portability.h - this file location may vary
const follyPortabilityPaths = [
  path.join(__dirname, '..', 'node_modules', 'RCT-Folly', 'folly', 'Portability.h'),
  path.join(__dirname, '..', 'ios', 'Pods', 'RCT-Folly', 'folly', 'Portability.h'),
];

let patchesApplied = [];
let errors = [];

console.log(`[${getTimestamp()}] Starting podspec patching script...\n`);

// NOTE: React Native Worklets packages have been removed from package.json
// No longer patching RNWorklets.podspec as worklets are not used

// Fix ExpoHead.podspec
if (fs.existsSync(expoRouterPodspecPath)) {
  try {
    let content = fs.readFileSync(expoRouterPodspecPath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Fix 1: Replace add_dependency(s, "RNScreens") with s.dependency "RNScreens"
    const patterns = [
      /add_dependency\s*\(\s*s\s*,\s*"RNScreens"\s*\)/g,
      /add_dependency\s*\(\s*s\s*,\s*'RNScreens'\s*\)/g,
    ];
    
    patterns.forEach((pattern) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, 's.dependency "RNScreens"');
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(expoRouterPodspecPath, content, 'utf8');
      console.log(`[${getTimestamp()}] ✅ Fixed ExpoHead.podspec: replaced add_dependency with s.dependency`);
      patchesApplied.push('ExpoHead.podspec');
      
      // Verify the patch was applied correctly
      const verified = verifyPatch(expoRouterPodspecPath, (content) => {
        return /s\.dependency\s+["']RNScreens["']/.test(content) && 
               !/add_dependency\s*\(\s*s\s*,\s*["']RNScreens["']\s*\)/.test(content);
      });
      
      if (!verified) {
        errors.push('ExpoHead.podspec patch verification failed');
        console.error(`[${getTimestamp()}] ❌ ExpoHead.podspec patch verification failed`);
      }
    } else {
      // Check if patch was already applied
      const alreadyPatched = verifyPatch(expoRouterPodspecPath, (content) => {
        return /s\.dependency\s+["']RNScreens["']/.test(content) && 
               !/add_dependency\s*\(\s*s\s*,\s*["']RNScreens["']\s*\)/.test(content);
      });
      
      if (alreadyPatched) {
        console.log(`[${getTimestamp()}] ℹ️  ExpoHead.podspec: Already patched (no changes needed)`);
      } else {
        const lines = content.split('\n');
        if (lines.length > 30) {
          console.log(`[${getTimestamp()}] 📄 ExpoHead.podspec content around line 30:`);
          console.log(lines.slice(25, 35).map((line, i) => `${25 + i + 1}: ${line}`).join('\n'));
        }
      }
    }
  } catch (error) {
    errors.push(`ExpoHead.podspec: ${error.message}`);
    console.error(`[${getTimestamp()}] ❌ Could not patch ExpoHead.podspec:`, error.message);
    console.error(error.stack);
  }
} else {
  console.log(`[${getTimestamp()}] ℹ️  ExpoHead.podspec not found (may not be installed yet)`);
}

// Fix Folly Portability.h - disable coroutines to fix 'folly/coro/Coroutine.h' not found error
let follyPatched = false;
for (const follyPath of follyPortabilityPaths) {
  if (fs.existsSync(follyPath)) {
    try {
      let content = fs.readFileSync(follyPath, 'utf8');
      let modified = false;
      
      // Disable Folly coroutines by setting FOLLY_HAS_COROUTINES to 0
      if (content.includes('#define FOLLY_HAS_COROUTINES 1')) {
        content = content.replace(/#define FOLLY_HAS_COROUTINES 1/g, '#define FOLLY_HAS_COROUTINES 0');
        modified = true;
      }
      
      // Also check for other patterns
      if (content.includes('FOLLY_HAS_COROUTINES') && !content.includes('#define FOLLY_HAS_COROUTINES 0')) {
        // Try to find and replace any definition
        content = content.replace(/#define\s+FOLLY_HAS_COROUTINES\s+[01]/g, '#define FOLLY_HAS_COROUTINES 0');
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(follyPath, content, 'utf8');
        console.log(`[${getTimestamp()}] ✅ Fixed Folly Portability.h: disabled coroutines support`);
        patchesApplied.push('Folly Portability.h');
        follyPatched = true;
        break; // Only patch the first found file
      } else {
        // Check if already patched
        if (content.includes('#define FOLLY_HAS_COROUTINES 0')) {
          console.log(`[${getTimestamp()}] ℹ️  Folly Portability.h: Already patched (coroutines disabled)`);
          follyPatched = true;
          break;
        }
      }
    } catch (error) {
      // Continue to next path if this one fails
      console.log(`[${getTimestamp()}] ℹ️  Could not patch Folly at ${follyPath}: ${error.message}`);
    }
  }
}

if (!follyPatched) {
  console.log(`[${getTimestamp()}] ℹ️  Folly Portability.h not found (will be patched after pod install if needed)`);
  // This is not an error - the file might not exist until after pod install
}

// Summary
console.log(`\n[${getTimestamp()}] Patching summary:`);
if (patchesApplied.length > 0) {
  console.log(`  ✅ Patches applied: ${patchesApplied.join(', ')}`);
}
if (errors.length > 0) {
  console.log(`  ❌ Errors: ${errors.length}`);
  errors.forEach(error => console.log(`    - ${error}`));
  process.exit(1);
} else {
  console.log(`  ✅ All patches applied successfully`);
  process.exit(0);
}


