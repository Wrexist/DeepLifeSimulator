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
/**
 * True for a mergeable object: a plain `{}`, not an array, null, Date or class.
 *
 * Arrays are deliberately NOT mergeable. A test writing `{ loans: [loan] }`
 * means "these loans and no others"; merging index-wise would leave initial
 * entries hanging off the end and produce a state the game never builds.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object'
    && v !== null
    && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  );
}

/**
 * Deep clone, so a fixture never aliases `initialGameState`.
 *
 * This is not tidiness. `deepMerge(initialGameState, {})` used to return a
 * SHALLOW copy, so every nested object and array was the module-level initial
 * state's own — and a test that pushed to `state.relationships` or bumped a
 * counter in place was editing the initial state for every test that ran after
 * it, in every file. The long-run save stress test caught it: its serialized
 * payload came out at 121 KB against a 100 KB bound, because five thousand
 * simulated weeks had been accumulating into the shared object.
 *
 * The enumerated version hid this by rebuilding its ten listed branches on every
 * call. Generalising the merge without generalising the copy turned a partial
 * safety into none.
 */
function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneDeep) as unknown as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = cloneDeep(value[key]);
  return out as T;
}

function deepMerge<T>(base: T, over: Partial<T> | undefined): T {
  if (!isPlainObject(base) || !over) return cloneDeep((over ?? base) as T);
  const out: Record<string, unknown> = cloneDeep(base as Record<string, unknown>);
  for (const key of Object.keys(over)) {
    const nextValue = (over as Record<string, unknown>)[key];
    const baseValue = (base as Record<string, unknown>)[key];
    out[key] = isPlainObject(baseValue) && isPlainObject(nextValue)
      ? deepMerge(baseValue, nextValue)
      : nextValue;
  }
  return out as T;
}

/**
 * Build a complete `GameState` with the given fields overridden.
 *
 * ## Every nested object is merged, not ten of them
 *
 * This used to deep-merge an ENUMERATED LIST — `stats`, `date`, `settings`,
 * `social`, `economy`, `family`, `banking`, `cryptoMarket`, `darkWeb`,
 * `identity` — and replace the other twenty-three wholesale. So
 * `createTestGameState({ socialMedia: { verifiedPro: true } })` produced a
 * `socialMedia` with exactly one key: a fixture the game never builds, handed to
 * code that reads the other fields and gets `undefined`. A test written against
 * that can pass on behaviour that cannot happen, and every field added to a
 * nested object silently widened the gap.
 *
 * The list was left alone once before on the grounds that widening it would
 * change the meaning of tests already written against wholesale replacement.
 * That is true, and it is the reason to do it deliberately with the suite green
 * rather than to leave a factory that lies about what state looks like — Hard
 * Rule #3 exists to keep tests on states the game can actually produce.
 *
 * Arrays still replace wholesale. `{ loans: [loan] }` means those loans and no
 * others, and merging index-wise would leave initial entries on the end.
 *
 * ## The overrides are DEEP-partial, and that is what unblocked the rule
 *
 * The signature was `Partial<GameState>`, which only makes TOP-LEVEL keys
 * optional — every nested object still had to be complete. So
 * `createTestGameState({ stats: { gems: 10 } })` did not type-check, and the
 * only way to write it was to hand-build a state and cast:
 *
 *   { stats: { gems: 10 }, weeksLived: 5 } as unknown as GameState
 *
 * Which is exactly what Hard Rule #3 bans, and exactly what 67 tests did. They
 * were not carelessness; they were the only thing the type allowed. A rule whose
 * sanctioned path cannot express the common case gets routed around, and the
 * weekly audit has been reporting the symptom rather than the cause.
 */
export function createTestGameState(overrides: DeepPartial<GameState> = {}): GameState {
  return deepMerge(initialGameState, overrides as Partial<GameState>);
}

/**
 * Every key optional, all the way down — with arrays left alone.
 *
 * Arrays stay whole because the merge replaces them: allowing a partial element
 * type would let a test write half a loan and get a `Loan` back that the game
 * could never build, which is the failure this whole file exists to prevent.
 */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

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

