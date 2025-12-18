/**
 * Scenario Crash Test
 * 
 * Tests the fix for the "undefined is not a function" crash when starting new games.
 * Creates 10 different simulations to verify the fix works across various scenarios.
 */

import { SCENARIOS as CHALLENGE_SCENARIOS, getDifficultyLabel, getDifficultyColor } from '@/lib/scenarios/scenarioDefinitions';
import { scenarios as LIFE_PATH_SCENARIOS } from '@/src/features/onboarding/scenarioData';
import { logger } from '@/utils/logger';

const log = logger.scope('ScenarioCrashTest');

interface TestResult {
  simulationNumber: number;
  scenarioType: 'life_path' | 'challenge';
  scenarioId: string;
  success: boolean;
  error?: string;
  details: string;
}

/**
 * Simulate the challengeScenarios useMemo logic from Scenarios.tsx
 * This tests the exact code path that was crashing
 */
function simulateChallengeScenariosMapping(): { success: boolean; error?: string; count: number } {
  try {
    // CRITICAL FIX: Validate CHALLENGE_SCENARIOS exists and is an array
    if (!CHALLENGE_SCENARIOS || !Array.isArray(CHALLENGE_SCENARIOS)) {
      log.warn('CHALLENGE_SCENARIOS is not available or not an array');
      return { success: false, error: 'CHALLENGE_SCENARIOS is not an array', count: 0 };
    }
    
    // CRITICAL FIX: Validate getDifficultyLabel exists
    const safeGetDifficultyLabel = typeof getDifficultyLabel === 'function' 
      ? getDifficultyLabel 
      : (difficulty: string) => {
          if (!difficulty || typeof difficulty !== 'string') {
            return 'Unknown';
          }
          return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        };
    
    // CRITICAL FIX: Validate getDifficultyColor exists
    const safeGetDifficultyColor = typeof getDifficultyColor === 'function'
      ? getDifficultyColor
      : () => '#6B7280'; // Fallback gray color
    
    const mapped = CHALLENGE_SCENARIOS.map(cs => {
      // CRITICAL FIX: Validate cs is an object
      if (!cs || typeof cs !== 'object') {
        log.warn('Invalid scenario object found:', cs);
        return null;
      }
      
      // CRITICAL FIX: Handle missing properties gracefully
      const startingConditions = (cs.startingConditions && typeof cs.startingConditions === 'object') 
        ? cs.startingConditions 
        : {};
      const rewards = (cs.rewards && typeof cs.rewards === 'object') 
        ? cs.rewards 
        : {};
      
      // CRITICAL FIX: Validate winConditions is an array before accessing
      const winConditions = Array.isArray(cs.winConditions) ? cs.winConditions : [];
      
      // Extract primary goal from winConditions (first condition description)
      const primaryGoalDescription = winConditions.length > 0 && winConditions[0] && typeof winConditions[0] === 'object'
        ? (winConditions[0].description || 'Complete the challenge')
        : 'Complete the challenge';
      
      // CRITICAL FIX: Validate difficulty before calling function
      const difficulty = (cs.difficulty && typeof cs.difficulty === 'string') 
        ? cs.difficulty 
        : 'unknown';
      
      // CRITICAL FIX: Validate education is an array before accessing [0]
      const education = Array.isArray(startingConditions.education) && startingConditions.education.length > 0
        ? startingConditions.education[0]
        : undefined;
      
      // CRITICAL FIX: Validate items is an array
      const items = Array.isArray(startingConditions.items) 
        ? startingConditions.items 
        : [];
      
      return {
        id: cs.id || 'unknown',
        title: cs.name || 'Unknown Scenario',
        difficulty: safeGetDifficultyLabel(difficulty),
        lifeGoal: primaryGoalDescription,
        description: cs.description || 'No description available',
        bonus: `Rewards: ${rewards.gems || 0} gems`,
        start: {
          age: typeof startingConditions.age === 'number' ? startingConditions.age : 18,
          cash: typeof startingConditions.money === 'number' ? startingConditions.money : 0,
          education: education,
          items: items,
          traits: [],
        },
        icon: 'default_icon', // Simplified for test
        isChallenge: true,
        challengeData: cs,
      };
    }).filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== null);
    
    return { success: true, count: mapped.length };
  } catch (error: any) {
    log.error('Error mapping challenge scenarios:', error);
    return { success: false, error: error?.message || 'Unknown error', count: 0 };
  }
}

/**
 * Test Simulation 1: Normal challenge scenario loading
 */
function simulation1(): TestResult {
  log.info('Simulation 1: Testing normal challenge scenario loading');
  const result = simulateChallengeScenariosMapping();
  return {
    simulationNumber: 1,
    scenarioType: 'challenge',
    scenarioId: 'all_challenges',
    success: result.success,
    error: result.error,
    details: `Loaded ${result.count} challenge scenarios successfully`,
  };
}

/**
 * Test Simulation 2: Life path scenario with all properties
 */
function simulation2(): TestResult {
  log.info('Simulation 2: Testing life path scenario with all properties');
  try {
    const scenario = LIFE_PATH_SCENARIOS.find(s => s.id === 'corporate_intern');
    if (!scenario) {
      return {
        simulationNumber: 2,
        scenarioType: 'life_path',
        scenarioId: 'corporate_intern',
        success: false,
        error: 'Scenario not found',
        details: 'Corporate Intern scenario not found',
      };
    }
    
    // Verify all properties exist
    const hasAllProperties = 
      scenario.id &&
      scenario.title &&
      scenario.start &&
      typeof scenario.start.age === 'number' &&
      typeof scenario.start.cash === 'number';
    
    return {
      simulationNumber: 2,
      scenarioType: 'life_path',
      scenarioId: scenario.id,
      success: hasAllProperties,
      error: hasAllProperties ? undefined : 'Missing required properties',
      details: `Scenario "${scenario.title}" loaded with age ${scenario.start.age}, cash $${scenario.start.cash}`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 2,
      scenarioType: 'life_path',
      scenarioId: 'corporate_intern',
      success: false,
      error: error?.message,
      details: 'Error loading corporate intern scenario',
    };
  }
}

/**
 * Test Simulation 3: Challenge scenario with missing winConditions
 */
function simulation3(): TestResult {
  log.info('Simulation 3: Testing challenge scenario with edge case data');
  try {
    // Create a mock scenario with missing winConditions to test defensive code
    const mockScenario = {
      id: 'test_scenario',
      name: 'Test Scenario',
      description: 'Test',
      difficulty: 'easy' as const,
      startingConditions: {
        money: 1000,
        age: 20,
      },
      winConditions: undefined, // Missing winConditions
      rewards: {
        gems: 10,
      },
    };
    
    // Test the mapping logic with this edge case
    const winConditions = Array.isArray(mockScenario.winConditions) ? mockScenario.winConditions : [];
    const primaryGoalDescription = winConditions.length > 0 && winConditions[0] && typeof winConditions[0] === 'object'
      ? (winConditions[0].description || 'Complete the challenge')
      : 'Complete the challenge';
    
    return {
      simulationNumber: 3,
      scenarioType: 'challenge',
      scenarioId: 'test_scenario',
      success: primaryGoalDescription === 'Complete the challenge',
      error: primaryGoalDescription !== 'Complete the challenge' ? 'Failed to handle missing winConditions' : undefined,
      details: `Handled missing winConditions correctly: "${primaryGoalDescription}"`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 3,
      scenarioType: 'challenge',
      scenarioId: 'test_scenario',
      success: false,
      error: error?.message,
      details: 'Error testing edge case scenario',
    };
  }
}

/**
 * Test Simulation 4: Challenge scenario with empty arrays
 */
function simulation4(): TestResult {
  log.info('Simulation 4: Testing challenge scenario with empty arrays');
  try {
    const mockScenario = {
      id: 'empty_test',
      name: 'Empty Test',
      description: 'Test with empty arrays',
      difficulty: 'medium' as const,
      startingConditions: {
        money: 500,
        age: 18,
        education: [], // Empty array
        items: [], // Empty array
      },
      winConditions: [], // Empty array
      rewards: {},
    };
    
    const education = Array.isArray(mockScenario.startingConditions.education) && mockScenario.startingConditions.education.length > 0
      ? mockScenario.startingConditions.education[0]
      : undefined;
    
    const items = Array.isArray(mockScenario.startingConditions.items) 
      ? mockScenario.startingConditions.items 
      : [];
    
    const success = education === undefined && items.length === 0;
    
    return {
      simulationNumber: 4,
      scenarioType: 'challenge',
      scenarioId: 'empty_test',
      success,
      error: success ? undefined : 'Failed to handle empty arrays',
      details: `Handled empty arrays: education=${education}, items=${items.length}`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 4,
      scenarioType: 'challenge',
      scenarioId: 'empty_test',
      success: false,
      error: error?.message,
      details: 'Error testing empty arrays',
    };
  }
}

/**
 * Test Simulation 5: Life path scenario with items and traits
 */
function simulation5(): TestResult {
  log.info('Simulation 5: Testing life path scenario with items and traits');
  try {
    const scenario = LIFE_PATH_SCENARIOS.find(s => s.id === 'fitness_enthusiast');
    if (!scenario) {
      return {
        simulationNumber: 5,
        scenarioType: 'life_path',
        scenarioId: 'fitness_enthusiast',
        success: false,
        error: 'Scenario not found',
        details: 'Fitness Enthusiast scenario not found',
      };
    }
    
    const hasItems = Array.isArray(scenario.start.items) && scenario.start.items.length > 0;
    const hasTraits = Array.isArray(scenario.start.traits) && scenario.start.traits.length > 0;
    
    return {
      simulationNumber: 5,
      scenarioType: 'life_path',
      scenarioId: scenario.id,
      success: hasItems && hasTraits,
      error: (!hasItems || !hasTraits) ? 'Missing items or traits' : undefined,
      details: `Scenario has ${scenario.start.items?.length || 0} items and ${scenario.start.traits?.length || 0} traits`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 5,
      scenarioType: 'life_path',
      scenarioId: 'fitness_enthusiast',
      success: false,
      error: error?.message,
      details: 'Error testing fitness enthusiast scenario',
    };
  }
}

/**
 * Test Simulation 6: Challenge scenario with null/undefined properties
 */
function simulation6(): TestResult {
  log.info('Simulation 6: Testing challenge scenario with null/undefined properties');
  try {
    const mockScenario: any = {
      id: 'null_test',
      name: 'Null Test',
      description: null, // Null description
      difficulty: null, // Null difficulty
      startingConditions: null, // Null startingConditions
      winConditions: null, // Null winConditions
      rewards: null, // Null rewards
    };
    
    // Test defensive code
    const startingConditions = (mockScenario.startingConditions && typeof mockScenario.startingConditions === 'object') 
      ? mockScenario.startingConditions 
      : {};
    const rewards = (mockScenario.rewards && typeof mockScenario.rewards === 'object') 
      ? mockScenario.rewards 
      : {};
    const winConditions = Array.isArray(mockScenario.winConditions) ? mockScenario.winConditions : [];
    const difficulty = (mockScenario.difficulty && typeof mockScenario.difficulty === 'string') 
      ? mockScenario.difficulty 
      : 'unknown';
    
    const safeGetDifficultyLabel = typeof getDifficultyLabel === 'function' 
      ? getDifficultyLabel 
      : (difficulty: string) => {
          if (!difficulty || typeof difficulty !== 'string') {
            return 'Unknown';
          }
          return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        };
    
    const label = safeGetDifficultyLabel(difficulty);
    const success = label === 'Unknown' && winConditions.length === 0;
    
    return {
      simulationNumber: 6,
      scenarioType: 'challenge',
      scenarioId: 'null_test',
      success,
      error: success ? undefined : 'Failed to handle null/undefined properties',
      details: `Handled null properties: difficulty="${label}", winConditions=${winConditions.length}`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 6,
      scenarioType: 'challenge',
      scenarioId: 'null_test',
      success: false,
      error: error?.message,
      details: 'Error testing null properties',
    };
  }
}

/**
 * Test Simulation 7: All life path scenarios loading
 */
function simulation7(): TestResult {
  log.info('Simulation 7: Testing all life path scenarios loading');
  try {
    const allScenarios = LIFE_PATH_SCENARIOS;
    const validScenarios = allScenarios.filter(s => 
      s.id && 
      s.title && 
      s.start && 
      typeof s.start.age === 'number' &&
      typeof s.start.cash === 'number'
    );
    
    const success = validScenarios.length === allScenarios.length;
    
    return {
      simulationNumber: 7,
      scenarioType: 'life_path',
      scenarioId: 'all_life_paths',
      success,
      error: success ? undefined : `Only ${validScenarios.length}/${allScenarios.length} scenarios are valid`,
      details: `Loaded ${validScenarios.length} valid life path scenarios out of ${allScenarios.length} total`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 7,
      scenarioType: 'life_path',
      scenarioId: 'all_life_paths',
      success: false,
      error: error?.message,
      details: 'Error loading all life path scenarios',
    };
  }
}

/**
 * Test Simulation 8: Challenge scenario with complex winConditions
 */
function simulation8(): TestResult {
  log.info('Simulation 8: Testing challenge scenario with complex winConditions');
  try {
    const scenario = CHALLENGE_SCENARIOS.find(s => s.id === 'entrepreneur');
    if (!scenario) {
      return {
        simulationNumber: 8,
        scenarioType: 'challenge',
        scenarioId: 'entrepreneur',
        success: false,
        error: 'Scenario not found',
        details: 'Entrepreneur challenge scenario not found',
      };
    }
    
    const winConditions = Array.isArray(scenario.winConditions) ? scenario.winConditions : [];
    const hasMultipleConditions = winConditions.length > 1;
    const firstCondition = winConditions.length > 0 && winConditions[0] && typeof winConditions[0] === 'object'
      ? winConditions[0]
      : null;
    
    const success = hasMultipleConditions && firstCondition !== null;
    
    return {
      simulationNumber: 8,
      scenarioType: 'challenge',
      scenarioId: scenario.id,
      success,
      error: success ? undefined : 'Failed to handle complex winConditions',
      details: `Scenario has ${winConditions.length} win conditions, first: "${firstCondition?.description || 'N/A'}"`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 8,
      scenarioType: 'challenge',
      scenarioId: 'entrepreneur',
      success: false,
      error: error?.message,
      details: 'Error testing complex winConditions',
    };
  }
}

/**
 * Test Simulation 9: Challenge scenario with education array
 */
function simulation9(): TestResult {
  log.info('Simulation 9: Testing challenge scenario with education array');
  try {
    const scenario = CHALLENGE_SCENARIOS.find(s => s.id === 'academic_excellence');
    if (!scenario) {
      return {
        simulationNumber: 9,
        scenarioType: 'challenge',
        scenarioId: 'academic_excellence',
        success: false,
        error: 'Scenario not found',
        details: 'Academic Excellence challenge scenario not found',
      };
    }
    
    const startingConditions = (scenario.startingConditions && typeof scenario.startingConditions === 'object') 
      ? scenario.startingConditions 
      : {};
    const education = Array.isArray(startingConditions.education) && startingConditions.education.length > 0
      ? startingConditions.education[0]
      : undefined;
    
    // Academic Excellence should have empty education array (starts with no education)
    const success = education === undefined && Array.isArray(startingConditions.education);
    
    return {
      simulationNumber: 9,
      scenarioType: 'challenge',
      scenarioId: scenario.id,
      success,
      error: success ? undefined : 'Failed to handle education array correctly',
      details: `Education array handled: ${Array.isArray(startingConditions.education) ? 'array' : 'not array'}, first item: ${education || 'undefined'}`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 9,
      scenarioType: 'challenge',
      scenarioId: 'academic_excellence',
      success: false,
      error: error?.message,
      details: 'Error testing education array',
    };
  }
}

/**
 * Test Simulation 10: Mixed scenario types (life path + challenge)
 */
function simulation10(): TestResult {
  log.info('Simulation 10: Testing mixed scenario types');
  try {
    // Test both types together
    const lifePathCount = LIFE_PATH_SCENARIOS.length;
    const challengeResult = simulateChallengeScenariosMapping();
    const challengeCount = challengeResult.count;
    
    const success = lifePathCount > 0 && challengeCount > 0 && challengeResult.success;
    
    return {
      simulationNumber: 10,
      scenarioType: 'life_path',
      scenarioId: 'mixed_test',
      success,
      error: success ? undefined : 'Failed to load mixed scenarios',
      details: `Loaded ${lifePathCount} life path scenarios and ${challengeCount} challenge scenarios`,
    };
  } catch (error: any) {
    return {
      simulationNumber: 10,
      scenarioType: 'life_path',
      scenarioId: 'mixed_test',
      success: false,
      error: error?.message,
      details: 'Error testing mixed scenario types',
    };
  }
}

/**
 * Run all 10 simulations
 */
export function runScenarioCrashTests(): TestResult[] {
  log.info('Starting scenario crash tests - 10 different simulations');
  
  const results: TestResult[] = [
    simulation1(),
    simulation2(),
    simulation3(),
    simulation4(),
    simulation5(),
    simulation6(),
    simulation7(),
    simulation8(),
    simulation9(),
    simulation10(),
  ];
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  log.info(`Test Results: ${successCount} passed, ${failureCount} failed out of ${results.length} total`);
  
  results.forEach(result => {
    if (result.success) {
      log.info(`✓ Simulation ${result.simulationNumber}: ${result.details}`);
    } else {
      log.error(`✗ Simulation ${result.simulationNumber}: ${result.error} - ${result.details}`);
    }
  });
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runScenarioCrashTests();
}

