/**
 * IAP Configuration Verification Script
 * 
 * Run this script to verify all IAP products are correctly configured
 * for TestFlight builds.
 * 
 * Usage: npx ts-node scripts/verifyIAPConfig.ts
 */

import { getAllProductIds, CONSUMABLE_PRODUCTS, NON_CONSUMABLE_PRODUCTS, PRODUCT_CONFIGS } from '../utils/iapConfig';

console.log('🔍 Verifying IAP Configuration for TestFlight...\n');

// 1. Check total product count
const allIds = getAllProductIds();
const expectedCount = 24;
console.log(`📊 Product Count Check:`);
console.log(`   Expected: ${expectedCount}`);
console.log(`   Actual: ${allIds.length}`);
if (allIds.length === expectedCount) {
  console.log('   ✅ PASS\n');
} else {
  console.log(`   ❌ FAIL - Expected ${expectedCount}, got ${allIds.length}\n`);
}

// 2. Check for duplicates
const uniqueIds = new Set(allIds);
console.log(`🔍 Duplicate Check:`);
console.log(`   Total IDs: ${allIds.length}`);
console.log(`   Unique IDs: ${uniqueIds.size}`);
if (allIds.length === uniqueIds.size) {
  console.log('   ✅ PASS - No duplicates\n');
} else {
  const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  console.log(`   ❌ FAIL - Duplicates found: ${duplicates.join(', ')}\n`);
}

// 3. Check naming convention (all should start with 'deeplife_')
// revival_pack is whitelisted — legacy product ID kept for App Store compatibility
console.log(`📝 Naming Convention Check:`);
const NAMING_WHITELIST = ['revival_pack'];
const invalidIds = allIds.filter(id => !id.startsWith('deeplife_') && !NAMING_WHITELIST.includes(id));
if (invalidIds.length === 0) {
  console.log('   ✅ PASS - All products follow naming convention\n');
} else {
  console.log(`   ❌ FAIL - Invalid naming: ${invalidIds.join(', ')}\n`);
}

// 4. Verify all products have configurations
console.log(`⚙️  Configuration Check:`);
const missingConfigs: string[] = [];
allIds.forEach(id => {
  const config = PRODUCT_CONFIGS[id as keyof typeof PRODUCT_CONFIGS];
  if (!config) {
    missingConfigs.push(id);
  }
});

if (missingConfigs.length === 0) {
  console.log('   ✅ PASS - All products have configurations\n');
} else {
  console.log(`   ❌ FAIL - Missing configs: ${missingConfigs.join(', ')}\n`);
}

// 5. Verify consumable vs non-consumable classification
console.log(`🔄 Product Type Classification:`);
const allClassified = [...CONSUMABLE_PRODUCTS, ...NON_CONSUMABLE_PRODUCTS];
const unclassified = allIds.filter(id => !allClassified.includes(id));

if (unclassified.length === 0) {
  console.log('   ✅ PASS - All products are classified\n');
} else {
  console.log(`   ❌ FAIL - Unclassified products: ${unclassified.join(', ')}\n`);
}

// 6. Check for overlap between consumable and non-consumable
const overlap = CONSUMABLE_PRODUCTS.filter(id => NON_CONSUMABLE_PRODUCTS.includes(id));
if (overlap.length === 0) {
  console.log('   ✅ PASS - No overlap between consumable and non-consumable\n');
} else {
  console.log(`   ❌ FAIL - Overlap found: ${overlap.join(', ')}\n`);
}

// 7. List all products by type
console.log(`📦 Consumable Products (${CONSUMABLE_PRODUCTS.length}):`);
CONSUMABLE_PRODUCTS.forEach((id, index) => {
  const config = PRODUCT_CONFIGS[id as keyof typeof PRODUCT_CONFIGS];
  console.log(`   ${index + 1}. ${id} - ${config?.name || 'NO CONFIG'}`);
});

console.log(`\n🔒 Non-Consumable Products (${NON_CONSUMABLE_PRODUCTS.length}):`);
NON_CONSUMABLE_PRODUCTS.forEach((id, index) => {
  const config = PRODUCT_CONFIGS[id as keyof typeof PRODUCT_CONFIGS];
  console.log(`   ${index + 1}. ${id} - ${config?.name || 'NO CONFIG'}`);
});

// 8. Summary
console.log(`\n📋 Summary:`);
console.log(`   Total Products: ${allIds.length}`);
console.log(`   Consumable: ${CONSUMABLE_PRODUCTS.length}`);
console.log(`   Non-Consumable: ${NON_CONSUMABLE_PRODUCTS.length}`);
console.log(`   Total Classified: ${allClassified.length}`);

const allChecksPassed = 
  allIds.length === expectedCount &&
  allIds.length === uniqueIds.size &&
  invalidIds.length === 0 &&
  missingConfigs.length === 0 &&
  unclassified.length === 0 &&
  overlap.length === 0;

console.log(`\n${allChecksPassed ? '✅' : '❌'} Overall Status: ${allChecksPassed ? 'PASS' : 'FAIL'}`);

if (allChecksPassed) {
  console.log('\n🎉 All IAP products are correctly configured for TestFlight!');
} else {
  console.log('\n⚠️  Please fix the issues above before submitting to TestFlight.');
  process.exit(1);
}

