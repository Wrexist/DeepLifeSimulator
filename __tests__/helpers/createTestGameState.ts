/**
 * Test GameState Factory
 * 
 * Creates valid GameState objects for testing that match the actual GameState interface.
 * Uses initialGameState as a base to ensure all required properties are present.
 * 
 * This prevents test-only GameState breakage by ensuring tests use the same
 * structure as production code.
 */

import { GameState } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';

/**
 * Creates a valid GameState for testing
 * 
 * @param overrides - Partial GameState to override default values
 * @returns Complete, valid GameState object
 * 
 * @example
 * ```typescript
 * const state = createTestGameState({
 *   stats: { money: 5000 },
 *   week: 10
 * });
 * ```
 */
export function createTestGameState(overrides: Partial<GameState> = {}): GameState {
  // Start with actual initial state to ensure all required properties exist
  // This guarantees type safety - if GameState changes, tests will fail at compile time
  return {
    ...initialGameState,
    ...overrides,
    // Deep merge for nested objects to avoid losing properties
    stats: {
      ...initialGameState.stats,
      ...(overrides.stats || {}),
    },
    date: {
      ...initialGameState.date,
      ...(overrides.date || {}),
    },
    settings: {
      ...initialGameState.settings,
      ...(overrides.settings || {}),
    },
    social: {
      ...initialGameState.social,
      ...(overrides.social || {}),
    },
    economy: {
      ...initialGameState.economy,
      ...(overrides.economy || {}),
    },
    family: {
      ...initialGameState.family,
      ...(overrides.family || {}),
    },
  };
}

/**
 * Type guard to verify GameState is complete
 * Use this in tests to catch incomplete GameState objects at runtime
 * 
 * @example
 * ```typescript
 * const state = createTestGameState({ week: 10 });
 * assertValidGameState(state); // Throws if any required fields are missing
 * ```
 */
export function assertValidGameState(state: GameState): asserts state is GameState {
  const requiredFields: (keyof GameState)[] = [
    'revivalPack',
    'stats',
    'day',
    'week',
    'date',
    'streetJobs',
    'jailActivities',
    'careers',
    'hobbies',
    'items',
    'darkWebItems',
    'hacks',
    'relationships',
    'pets',
    'hasPhone',
    'computerPreviouslyOwned',
    'foods',
    'healthActivities',
    'dietPlans',
    'educations',
    'companies',
    'userProfile',
    'youthPills',
    'showWelcomePopup',
    'hasSeenJobTutorial',
    'hasSeenInvestmentTutorial',
    'hasSeenDatingTutorial',
    'hasSeenHealthWarning',
    'hasSeenEnergyWarning',
    'hasSeenMoneyManagementTutorial',
    'hasSeenSocialMediaTutorial',
    'hasSeenRealEstateTutorial',
    'settings',
    'cryptos',
    'diseases',
    'realEstate',
    'social',
    'economy',
    'family',
    'generationNumber',
    'lineageId',
    'ancestors',
    'activeTraits',
    'memories',
    'lifeStage',
    'wantedLevel',
    'jailWeeks',
    'escapedFromJail',
    'criminalXp',
    'criminalLevel',
    'crimeSkills',
    'bankSavings',
    'stocksOwned',
    'perks',
    'achievements',
    'claimedProgressAchievements',
    'lastLogin',
    'streetJobsCompleted',
    'happinessZeroWeeks',
    'healthZeroWeeks',
    'showZeroStatPopup',
    'showDeathPopup',
    'showSicknessModal',
    'showCureSuccessModal',
    'curedDiseases',
    'version',
    'pendingEvents',
    'eventLog',
    'progress',
    'journal',
  ];

  const missingFields: string[] = [];
  for (const field of requiredFields) {
    if (!(field in state)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Invalid GameState: Missing required fields: ${missingFields.join(', ')}\n` +
      `This indicates a test is creating an incomplete GameState. Use createTestGameState() instead.`
    );
  }
}

