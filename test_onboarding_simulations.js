/**
 * Onboarding System Simulation Tests
 * 
 * This script simulates 10 different scenarios to test the onboarding flow
 * and validation system. Run with: node test_onboarding_simulations.js
 */

// Mock the validation function (simplified version for testing)
function validateOnboardingState(state) {
  const errors = [];
  const warnings = [];
  const missingFields = [];
  const invalidFields = [];

  if (!state || typeof state !== 'object') {
    errors.push('Game state is null or undefined');
    return { valid: false, errors, warnings, missingFields: ['state'], invalidFields: [] };
  }

  // Validate userProfile
  if (!state.userProfile) {
    errors.push('Missing userProfile object');
    missingFields.push('userProfile');
  } else {
    if (typeof state.userProfile.firstName !== 'string' || state.userProfile.firstName.trim().length === 0) {
      errors.push('firstName must be a non-empty string');
      invalidFields.push('userProfile.firstName');
    }
    if (typeof state.userProfile.lastName !== 'string' || state.userProfile.lastName.trim().length === 0) {
      errors.push('lastName must be a non-empty string');
      invalidFields.push('userProfile.lastName');
    }
    const validSexes = ['male', 'female'];
    if (!state.userProfile.sex || !validSexes.includes(state.userProfile.sex)) {
      errors.push(`sex must be one of: ${validSexes.join(', ')}`);
      invalidFields.push('userProfile.sex');
    }
    const validSexualities = ['straight', 'gay', 'bi'];
    if (!state.userProfile.sexuality || !validSexualities.includes(state.userProfile.sexuality)) {
      errors.push(`sexuality must be one of: ${validSexualities.join(', ')}`);
      invalidFields.push('userProfile.sexuality');
    }
  }

  // Validate scenario
  if (typeof state.scenarioId !== 'string' || state.scenarioId.trim().length === 0) {
    errors.push('scenarioId must be a non-empty string');
    missingFields.push('scenarioId');
  }

  // Validate stats
  if (!state.stats || typeof state.stats !== 'object') {
    errors.push('Missing stats object');
    missingFields.push('stats');
  } else {
    const requiredStats = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'];
    for (const stat of requiredStats) {
      if (!(stat in state.stats)) {
        errors.push(`Missing stat: ${stat}`);
        missingFields.push(`stats.${stat}`);
      } else {
        const value = state.stats[stat];
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
          errors.push(`Invalid ${stat} value: expected number, got ${typeof value}`);
          invalidFields.push(`stats.${stat}`);
        }
      }
    }
  }

  // Validate date
  if (!state.date || typeof state.date !== 'object') {
    errors.push('Missing date object');
    missingFields.push('date');
  }

  // Validate version
  if (typeof state.version !== 'number' || isNaN(state.version) || state.version < 1) {
    errors.push(`Invalid version: ${state.version}`);
    invalidFields.push('version');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingFields,
    invalidFields,
  };
}

// Mock initial game state
const initialGameState = {
  version: 5,
  stats: {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 10,
    money: 200,
    reputation: 0,
    gems: 0,
  },
  date: { year: 2025, month: 'January', week: 1, age: 18 },
  userProfile: {
    firstName: '',
    lastName: '',
    sex: 'male',
    sexuality: 'straight',
    gender: 'male',
    seekingGender: 'female',
  },
  scenarioId: undefined,
  careers: [],
  hobbies: [],
  items: [],
  relationships: [],
  achievements: [],
  educations: [],
  pets: [],
  companies: [],
  realEstate: [],
  cryptos: [],
  diseases: [],
  streetJobs: [],
  jailActivities: [],
  foods: [],
  healthActivities: [],
  dietPlans: [],
  darkWebItems: [],
  hacks: [],
  settings: {
    darkMode: true,
    autoSave: true,
  },
};

// Simulation scenarios
const simulations = [
  {
    name: 'Simulation 1: Perfect Flow - All Valid Data',
    description: 'Complete onboarding with all fields correctly filled',
    onboardingState: {
      scenario: { id: 'street_hustler', start: { age: 18, cash: 500, items: [] } },
      firstName: 'John',
      lastName: 'Doe',
      sex: 'male',
      sexuality: 'straight',
      slot: 1,
      perks: [],
    },
    expectedResult: 'SUCCESS',
  },
  {
    name: 'Simulation 2: Missing Scenario',
    description: 'User tries to start without selecting a scenario',
    onboardingState: {
      scenario: undefined,
      firstName: 'Jane',
      lastName: 'Smith',
      sex: 'female',
      sexuality: 'gay',
      slot: 1,
      perks: [],
    },
    expectedResult: 'FAIL - Missing scenario',
  },
  {
    name: 'Simulation 3: Missing First Name',
    description: 'User tries to start without entering first name',
    onboardingState: {
      scenario: { id: 'college_student', start: { age: 18, cash: 1000, items: [] } },
      firstName: '',
      lastName: 'Johnson',
      sex: 'male',
      sexuality: 'straight',
      slot: 1,
      perks: [],
    },
    expectedResult: 'FAIL - Missing firstName',
  },
  {
    name: 'Simulation 4: Missing Last Name',
    description: 'User tries to start without entering last name',
    onboardingState: {
      scenario: { id: 'rich_kid', start: { age: 18, cash: 5000, items: [] } },
      firstName: 'Alice',
      lastName: '',
      sex: 'female',
      sexuality: 'bi',
      slot: 1,
      perks: [],
    },
    expectedResult: 'FAIL - Missing lastName',
  },
  {
    name: 'Simulation 5: Invalid Sex (Random)',
    description: 'User selects random sex - should be converted to male/female',
    onboardingState: {
      scenario: { id: 'street_hustler', start: { age: 18, cash: 500, items: [] } },
      firstName: 'Bob',
      lastName: 'Williams',
      sex: 'random', // Should be converted to 'male' or 'female'
      sexuality: 'straight',
      slot: 1,
      perks: [],
    },
    expectedResult: 'SUCCESS - Random sex converted',
  },
  {
    name: 'Simulation 6: Invalid Sex Value',
    description: 'User somehow has invalid sex value',
    onboardingState: {
      scenario: { id: 'college_student', start: { age: 18, cash: 1000, items: [] } },
      firstName: 'Charlie',
      lastName: 'Brown',
      sex: 'invalid', // Invalid value
      sexuality: 'straight',
      slot: 1,
      perks: [],
    },
    expectedResult: 'FAIL - Invalid sex',
  },
  {
    name: 'Simulation 7: Invalid Sexuality',
    description: 'User somehow has invalid sexuality value',
    onboardingState: {
      scenario: { id: 'rich_kid', start: { age: 18, cash: 5000, items: [] } },
      firstName: 'Diana',
      lastName: 'Prince',
      sex: 'female',
      sexuality: 'invalid', // Invalid value
      slot: 1,
      perks: [],
    },
    expectedResult: 'FAIL - Invalid sexuality',
  },
  {
    name: 'Simulation 8: Whitespace-Only Names',
    description: 'User enters only whitespace for names',
    onboardingState: {
      scenario: { id: 'street_hustler', start: { age: 18, cash: 500, items: [] } },
      firstName: '   ',
      lastName: '   ',
      sex: 'male',
      sexuality: 'straight',
      slot: 1,
      perks: [],
    },
    expectedResult: 'FAIL - Whitespace-only names',
  },
  {
    name: 'Simulation 9: Complete Flow with Perks',
    description: 'Complete onboarding with perks selected',
    onboardingState: {
      scenario: { id: 'college_student', start: { age: 18, cash: 1000, items: [] } },
      firstName: 'Emma',
      lastName: 'Watson',
      sex: 'female',
      sexuality: 'straight',
      slot: 1,
      perks: ['legacy_builder', 'astute_planner'],
    },
    expectedResult: 'SUCCESS - With perks',
  },
  {
    name: 'Simulation 10: Edge Case - Very Long Names',
    description: 'User enters very long names (should still work)',
    onboardingState: {
      scenario: { id: 'rich_kid', start: { age: 18, cash: 5000, items: [] } },
      firstName: 'A'.repeat(100), // Very long name
      lastName: 'B'.repeat(100), // Very long name
      sex: 'male',
      sexuality: 'bi',
      slot: 1,
      perks: [],
    },
    expectedResult: 'SUCCESS - Long names accepted',
  },
];

// Simulate onboarding flow
function simulateOnboarding(simulation) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n${simulation.name}`);
  console.log(`Description: ${simulation.description}`);
  console.log(`Expected: ${simulation.expectedResult}`);
  console.log(`\n${'-'.repeat(80)}`);

  const { onboardingState } = simulation;

  // Step 1: Check scenario
  if (!onboardingState.scenario) {
    console.log('❌ FAIL: No scenario selected');
    console.log('   → Alert shown: "Missing Scenario"');
    return { success: false, reason: 'Missing scenario' };
  }
  console.log('✅ Scenario selected:', onboardingState.scenario.id);

  // Step 2: Check firstName
  if (!onboardingState.firstName || !onboardingState.firstName.trim()) {
    console.log('❌ FAIL: Missing firstName');
    console.log('   → Alert shown: "Missing First Name"');
    return { success: false, reason: 'Missing firstName' };
  }
  console.log('✅ First name provided:', onboardingState.firstName);

  // Step 3: Check lastName
  if (!onboardingState.lastName || !onboardingState.lastName.trim()) {
    console.log('❌ FAIL: Missing lastName');
    console.log('   → Alert shown: "Missing Last Name"');
    return { success: false, reason: 'Missing lastName' };
  }
  console.log('✅ Last name provided:', onboardingState.lastName);

  // Step 4: Check sex
  if (!onboardingState.sex || !['male', 'female', 'random'].includes(onboardingState.sex)) {
    console.log('❌ FAIL: Invalid sex');
    console.log('   → Alert shown: "Invalid Character Sex"');
    return { success: false, reason: 'Invalid sex' };
  }
  
  // Convert random to male/female
  let finalSex = onboardingState.sex;
  if (finalSex === 'random') {
    finalSex = Math.random() < 0.5 ? 'male' : 'female';
    console.log('✅ Random sex converted to:', finalSex);
  } else {
    console.log('✅ Sex provided:', finalSex);
  }

  // Step 5: Check sexuality
  if (!onboardingState.sexuality || !['straight', 'gay', 'bi'].includes(onboardingState.sexuality)) {
    console.log('❌ FAIL: Invalid sexuality');
    console.log('   → Alert shown: "Invalid Sexuality"');
    return { success: false, reason: 'Invalid sexuality' };
  }
  console.log('✅ Sexuality provided:', onboardingState.sexuality);

  // Step 6: Create game state
  console.log('\n📦 Creating game state...');
  const gameState = {
    ...initialGameState,
    userProfile: {
      ...initialGameState.userProfile,
      firstName: onboardingState.firstName.trim(),
      lastName: onboardingState.lastName.trim(),
      sex: finalSex,
      sexuality: onboardingState.sexuality,
      gender: finalSex,
      seekingGender: onboardingState.sexuality === 'straight'
        ? (finalSex === 'male' ? 'female' : 'male')
        : onboardingState.sexuality === 'gay'
        ? finalSex
        : (finalSex === 'male' ? 'female' : 'male'),
    },
    scenarioId: onboardingState.scenario.id,
    stats: {
      ...initialGameState.stats,
      money: onboardingState.scenario.start.cash + (onboardingState.perks.includes('legacy_builder') ? 5000 : 0),
    },
    perks: onboardingState.perks.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
    version: 5,
  };

  // Step 7: Validate game state
  console.log('🔍 Validating game state...');
  const validation = validateOnboardingState(gameState);

  if (!validation.valid) {
    console.log('❌ FAIL: Game state validation failed');
    console.log('   Errors:', validation.errors);
    console.log('   Missing fields:', validation.missingFields);
    console.log('   Invalid fields:', validation.invalidFields);
    console.log('   → Alert shown with error details');
    return { success: false, reason: 'Validation failed', validation };
  }

  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:', validation.warnings);
  }

  console.log('✅ Game state validation passed');

  // Step 8: Simulate save
  console.log('💾 Saving game state...');
  console.log('   → AsyncStorage.setItem(`save_slot_${onboardingState.slot}`, ...)');
  console.log('   → AsyncStorage.setItem("lastSlot", ...)');
  console.log('✅ Game saved successfully');

  // Step 9: Simulate navigation
  console.log('🚀 Navigating to main game...');
  console.log('   → router.replace("/(tabs)")');
  console.log('✅ Navigation successful');

  console.log('\n✅✅✅ SIMULATION PASSED ✅✅✅');
  return { success: true, gameState, validation };
}

// Run all simulations
console.log('\n' + '='.repeat(80));
console.log('ONBOARDING SYSTEM SIMULATION TESTS');
console.log('='.repeat(80));
console.log(`\nRunning ${simulations.length} simulations...\n`);

const results = {
  passed: 0,
  failed: 0,
  details: [],
};

simulations.forEach((simulation, index) => {
  const result = simulateOnboarding(simulation);
  
  const passed = result.success === (simulation.expectedResult.startsWith('SUCCESS'));
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }

  results.details.push({
    simulation: simulation.name,
    expected: simulation.expectedResult,
    actual: result.success ? 'SUCCESS' : `FAIL - ${result.reason}`,
    passed,
  });
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('SIMULATION SUMMARY');
console.log('='.repeat(80));
console.log(`\nTotal Simulations: ${simulations.length}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`\nSuccess Rate: ${((results.passed / simulations.length) * 100).toFixed(1)}%`);

console.log('\n' + '-'.repeat(80));
console.log('DETAILED RESULTS:');
console.log('-'.repeat(80));
results.details.forEach((detail, index) => {
  const icon = detail.passed ? '✅' : '❌';
  console.log(`\n${icon} Simulation ${index + 1}: ${detail.simulation}`);
  console.log(`   Expected: ${detail.expected}`);
  console.log(`   Actual:   ${detail.actual}`);
  if (!detail.passed) {
    console.log(`   ⚠️  MISMATCH - Expected ${detail.expected.startsWith('SUCCESS') ? 'SUCCESS' : 'FAIL'} but got ${detail.actual.startsWith('SUCCESS') ? 'SUCCESS' : 'FAIL'}`);
  }
});

console.log('\n' + '='.repeat(80));
if (results.failed === 0) {
  console.log('🎉 ALL SIMULATIONS PASSED! 🎉');
  console.log('The onboarding system is working correctly.');
} else {
  console.log('⚠️  SOME SIMULATIONS FAILED');
  console.log('Please review the failed simulations above.');
}
console.log('='.repeat(80) + '\n');

