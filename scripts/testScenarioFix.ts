/**
 * Test Script for Scenario Crash Fix
 * 
 * This script runs 10 different simulations to verify the fix for the
 * "undefined is not a function" crash when starting new games.
 * 
 * Run with: npx ts-node scripts/testScenarioFix.ts
 */

import { runScenarioCrashTests } from '../__tests__/scenarios/scenarioCrashTest';
import { logger } from '../utils/logger';

const log = logger.scope('ScenarioFixTestRunner');

async function main() {
  console.log('='.repeat(60));
  console.log('Scenario Crash Fix Test - 10 Different Simulations');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    const results = runScenarioCrashTests();
    
    console.log('');
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`Total Simulations: ${results.length}`);
    console.log(`✓ Passed: ${successCount}`);
    console.log(`✗ Failed: ${failureCount}`);
    console.log('');
    
    if (failureCount === 0) {
      console.log('✅ All simulations passed! The crash fix is working correctly.');
      console.log('');
      console.log('Each simulation tested different aspects:');
      console.log('  1. Normal challenge scenario loading');
      console.log('  2. Life path scenario with all properties');
      console.log('  3. Challenge scenario with missing winConditions');
      console.log('  4. Challenge scenario with empty arrays');
      console.log('  5. Life path scenario with items and traits');
      console.log('  6. Challenge scenario with null/undefined properties');
      console.log('  7. All life path scenarios loading');
      console.log('  8. Challenge scenario with complex winConditions');
      console.log('  9. Challenge scenario with education array');
      console.log('  10. Mixed scenario types (life path + challenge)');
      process.exit(0);
    } else {
      console.log('❌ Some simulations failed. Please review the errors above.');
      console.log('');
      results.filter(r => !r.success).forEach(result => {
        console.log(`  Simulation ${result.simulationNumber}: ${result.error}`);
      });
      process.exit(1);
    }
  } catch (error: any) {
    log.error('Error running scenario crash tests:', error);
    console.error('❌ Test runner crashed:', error?.message);
    process.exit(1);
  }
}

main();

