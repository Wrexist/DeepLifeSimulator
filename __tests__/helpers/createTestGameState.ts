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
import { defaultPrestigeData } from '@/lib/prestige/prestigeTypes';

/**
 * The keys this factory DEEP-merges one level down, so an override may name a
 * few fields instead of rebuilding the whole sub-object.
 *
 * `banking`, `cryptoMarket` and `darkWeb` are deep-merged too but are NOT here:
 * they merge through optional chaining against possibly-absent defaults, so
 * typing them as partial would force casts inside the factory — the exact thing
 * this type exists to remove from callers. They keep their full types.
 */
type DeepMergedKey =
  'stats' | 'date' | 'settings' | 'social' | 'economy' | 'family' | 'prestige';

/**
 * What `createTestGameState` accepts.
 *
 * `Partial<GameState>` is SHALLOW: it makes each top-level key optional but
 * still demands a complete value. So `{ stats: { money: 5000 } }` — the usage
 * this file's own `@example` has always shown, and what the implementation has
 * always deep-merged — did not type-check.
 *
 * That gap is why the test tree carried a large block of TS2740 "missing the
 * following properties from type 'GameStats'" errors, and why callers reached
 * for `as never` / `as GameState` to silence them. Those casts then defeated
 * Hard Rule #3: a cast state does not fail to compile when GameState changes,
 * which is the whole point of routing tests through this factory.
 *
 * The type now says what the function already did.
 */
export type TestGameStateOverrides =
  Omit<Partial<GameState>, DeepMergedKey>
  & { [K in DeepMergedKey]?: Partial<GameState[K]> };

/**
 * Creates a valid GameState for testing
 *
 * @param overrides - Partial GameState to override default values. Nested
 *   objects listed in `DeepMergedKey` may themselves be partial.
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
export function createTestGameState(overrides: TestGameStateOverrides = {}): GameState {
  // Start with actual initial state to ensure all required properties exist
  // This guarantees type safety - if GameState changes, tests will fail at compile time
  //
  // ── Why this CLONES rather than spreading the singleton ──────────────────
  //
  // `{ ...initialGameState }` is shallow. Only the keys deep-merged below got a
  // fresh object; every other nested value — `items`, `userProfile`, `sparkApp`,
  // `socialMedia`, `relationships`, … — was returned BY REFERENCE, shared with
  // the module-level `initialGameState` and with every other state this factory
  // had ever handed out.
  //
  // So `state.userProfile.handle = 'lucky-seed'` in one test did not modify that
  // test's state. It modified the singleton, permanently, for every later test
  // in the same Jest worker. Reproduced directly: mutate in test A, and test B —
  // which calls the factory fresh and touches nothing — reads back
  // `handle=lucky-seed`, as does `initialGameState` itself.
  //
  // Two suites had independently noticed a symptom and hand-rolled a partial
  // clone in a local `freshState`, covering different field lists: one
  // `sparkApp`/`stats`/`relationships`, the other `socialMedia`/`userProfile`/
  // `stats`. Only the second happened to cover the field it went on to mutate.
  // `__tests__/utils/saveValidation.test.ts` cloned nothing and mutated
  // `userProfile.verified`, `socialMedia.verifiedPro` and `sparkApp.premium`
  // straight through. That divergence — three files, three different answers,
  // two of them wrong — is the argument for fixing it here instead of patching
  // field lists forever.
  //
  // Cost, measured back to back on the full suite: 78s → 85s (~8.5%). That is
  // the price of tests that cannot silently corrupt each other, paid in a test
  // helper rather than in production code.
  //
  // NOTE for anyone tidying up: `structuredClone(initialGameState)`
  // appears in several stress suites that mutate nested state in place. Those
  // are deep clones ON PURPOSE — do not "simplify" them into a bare
  // `createTestGameState()` call unless this clone is still here.
  const base = structuredClone(initialGameState);
  return {
    ...base,
    ...overrides,
    // Deep merge for nested objects to avoid losing properties
    stats: {
      ...base.stats,
      ...(overrides.stats || {}),
    },
    date: {
      ...base.date,
      ...(overrides.date || {}),
    },
    settings: {
      ...base.settings,
      ...(overrides.settings || {}),
    },
    social: {
      ...base.social,
      ...(overrides.social || {}),
    },
    economy: {
      ...base.economy,
      ...(overrides.economy || {}),
    },
    family: {
      ...base.family,
      ...(overrides.family || {}),
    },
    // Merged rather than replaced, because `prestige` is OPTIONAL on GameState:
    // a caller wanting to change one field had to spread the default by hand,
    // and spreading a `PrestigeData | undefined` widens EVERY field to
    // optional, so the result no longer assigns back to PrestigeData. Tests
    // reached for `as never` to escape that.
    //
    // The base is `defaultPrestigeData` rather than `initialGameState.prestige`
    // for the same reason: they are the same object at runtime, but only the
    // former is TYPED as a complete PrestigeData, so this merge needs no cast.
    prestige: {
      ...defaultPrestigeData,
      ...(overrides.prestige || {}),
    },
    banking: overrides.banking
      ? {
          ...(base.banking ?? {}),
          ...overrides.banking,
          creditScore: {
            ...(base.banking?.creditScore ?? {}),
            ...(overrides.banking?.creditScore ?? {}),
            componentBreakdown: {
              ...(base.banking?.creditScore?.componentBreakdown ?? {}),
              ...(overrides.banking?.creditScore?.componentBreakdown ?? {}),
            },
          },
        }
      : base.banking,
    cryptoMarket: overrides.cryptoMarket
      ? {
          ...(base.cryptoMarket ?? {}),
          ...overrides.cryptoMarket,
          coinMarkets: {
            ...(base.cryptoMarket?.coinMarkets ?? {}),
            ...(overrides.cryptoMarket?.coinMarkets ?? {}),
          },
          costBasis: {
            ...(base.cryptoMarket?.costBasis ?? {}),
            ...(overrides.cryptoMarket?.costBasis ?? {}),
          },
        }
      : base.cryptoMarket,
    darkWeb: overrides.darkWeb
      ? {
          ...(base.darkWeb ?? {}),
          ...overrides.darkWeb,
          skills: {
            ...(base.darkWeb?.skills ?? {}),
            ...(overrides.darkWeb?.skills ?? {}),
          },
        }
      : base.darkWeb,
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
    // v31 arrears bucket. Listed because it is ARITHMETIC in the weekly cash
    // line — a test state missing it computes NaN money and the failure surfaces
    // three subsystems away from the cause.
    'overdueBalance',
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

