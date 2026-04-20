#!/usr/bin/env node
/* eslint-env node */

/**
 * Verification script for podspec patches
 * Checks if patches were applied correctly before pod install
 */

const fs = require('fs');
const path = require('path');

const expoRouterPodspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-router',
  'ios',
  'ExpoHead.podspec'
);

let allPatchesValid = true;
const errors = [];

console.log('🔍 Verifying podspec patches...\n');

// Verify ExpoHead.podspec patch
if (fs.existsSync(expoRouterPodspecPath)) {
  try {
    const content = fs.readFileSync(expoRouterPodspecPath, 'utf8');
    
    // Check if add_dependency pattern still exists (should be patched)
    const hasAddDependency = /add_dependency\s*\(\s*s\s*,\s*["']RNScreens["']\s*\)/.test(content);
    
    // Check if correct dependency syntax exists
    const hasCorrectDependency = /s\.dependency\s+["']RNScreens["']/.test(content);
    
    if (hasAddDependency && !hasCorrectDependency) {
      allPatchesValid = false;
      errors.push('ExpoHead.podspec: add_dependency pattern still exists and was not patched');
      console.log('❌ ExpoHead.podspec: Patch verification FAILED');
    } else if (hasCorrectDependency) {
      console.log('✅ ExpoHead.podspec: Patch verified successfully');
    } else {
      console.log('ℹ️  ExpoHead.podspec: No patch needed (pattern not found)');
    }
  } catch (error) {
    allPatchesValid = false;
    errors.push(`ExpoHead.podspec: Error reading file - ${error.message}`);
    console.log('❌ ExpoHead.podspec: Error during verification');
  }
} else {
  console.log('⚠️  ExpoHead.podspec: File not found (may not be installed yet)');
}

console.log('');

// Summary
if (allPatchesValid && errors.length === 0) {
  console.log('✅ All podspec patches verified successfully');
  process.exit(0);
} else {
  console.log('❌ Podspec patch verification failed:');
  errors.forEach(error => console.log(`  - ${error}`));
  process.exit(1);
}

