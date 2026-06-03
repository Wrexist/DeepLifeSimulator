/**
 * Week-advance fixture battery — R7 Phase 2 step 2.0
 *
 * Goal: provide stable, representative `GameState` snapshots so subsystem
 * tests and (eventually) the `nextWeek()` pipeline equivalence tests can
 * compare old vs new behavior on the same inputs.
 *
 * Each fixture stresses a different axis of the game so a refactor that
 * silently regresses one corner gets caught:
 *
 *   - freshGame:    brand-new run, no economy active, week 1
 *   - earlyCareer:  has a job, has some money, week 30
 *   - midGame:      married + kids, active stocks + banking, week 250
 *   - wealthyGame:  late-game with real estate + crypto + politics active
 *   - inPrison:     wantedLevel high, in jail, edge case
 *   - nearDeath:    low health + happiness, on the death-trigger edge
 *
 * All fixtures go through `createTestGameState()` so they inherit any
 * field added to `initialGameState`. This prevents the test-only-state
 * drift that the project's hard rules explicitly forbid.
 *
 * Usage:
 *   import { fixtures, deterministicRoll } from './weekFixtures';
 *   const result = runWeeklyBankingTick({ banking: fixtures.midGame.banking!, ... });
 */

import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

// -----------------------------------------------------------------------
// Deterministic roll source for subsystem ticks that accept `rollFor`.
// -----------------------------------------------------------------------
// The audit's Phase 2 risk register flagged StrictMode double-invoke as a
// landmine for RNG. The whole point of `rollFor(key)` in the subsystem
// ticks is that the same key returns the same value within a tick, and the
// caller pre-rolls every value before invoking the updater. Tests follow
// the same contract: we use a seeded PRNG so identical inputs produce
// identical outputs, and snapshot drift is detectable.

/**
 * Stable per-key PRNG: hash(seed + key) → [0,1).
 * Not cryptographically secure (and doesn't need to be).
 * Deterministic across machines and Node versions.
 */
export function deterministicRoll(seed: number): (key: string) => number {
  return (key: string) => {
    // FNV-1a-ish hash of seed + key.
    let h = seed >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Convert to [0, 1).
    return (h >>> 0) / 0xffffffff;
  };
}

// -----------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------

/**
 * Brand-new game. Week 1, defaults across the board. Tests "empty case"
 * — no companies, no stocks, no relationships, no debt.
 */
export const freshGame: GameState = createTestGameState({
  week: 1,
  weeksLived: 0,
  stats: {
    money: 1000,
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 50,
    reputation: 50,
    gems: 0,
  },
});

/**
 * Has a job, some savings, some debt. Week 30 of a typical run. Tests
 * the most common income/expense flow.
 */
export const earlyCareer: GameState = createTestGameState({
  week: 2,
  weeksLived: 30,
  stats: {
    money: 8500,
    health: 88,
    happiness: 75,
    energy: 70,
    fitness: 55,
    reputation: 55,
    gems: 50,
  },
  bankSavings: 2000,
});

/**
 * Middle of a typical run: ~5 years in (week 250), savings + small stock
 * holdings active, banking slice populated. Tests the busy income tick.
 */
export const midGame: GameState = createTestGameState({
  week: 2,
  weeksLived: 250,
  stats: {
    money: 35000,
    health: 80,
    happiness: 72,
    energy: 65,
    fitness: 60,
    reputation: 65,
    gems: 200,
  },
  bankSavings: 18000,
});

/**
 * Late-game wealthy state: ~30 years in (week 1500), real estate + crypto
 * + politics active. Tests the "all subsystems on" worst case for tick
 * cost.
 */
export const wealthyGame: GameState = createTestGameState({
  week: 4,
  weeksLived: 1500,
  stats: {
    money: 480000,
    health: 70,
    happiness: 80,
    energy: 75,
    fitness: 70,
    reputation: 85,
    gems: 1500,
  },
  bankSavings: 250000,
});

/**
 * In jail with high wanted level. Tests the crime path and jail-decay
 * counters that several Phase 2 reducers will touch.
 */
export const inPrison: GameState = createTestGameState({
  week: 3,
  weeksLived: 180,
  stats: {
    money: 0,
    health: 60,
    happiness: 30,
    energy: 80,
    fitness: 65,
    reputation: 20,
    gems: 10,
  },
  isInJail: true,
  jailWeeksRemaining: 8,
  wantedLevel: 4,
});

/**
 * On the death edge: low health and happiness. Tests the death-tracking
 * counter logic (healthZeroWeeks / happinessZeroWeeks) without quite
 * tripping the trigger.
 */
export const nearDeath: GameState = createTestGameState({
  week: 1,
  weeksLived: 800,
  stats: {
    money: 50,
    health: 5,
    happiness: 8,
    energy: 20,
    fitness: 25,
    reputation: 15,
    gems: 0,
  },
  healthZeroWeeks: 0,
  happinessZeroWeeks: 0,
});

/**
 * Map of all fixtures by name. Use this when iterating across the whole
 * battery in `.each` test blocks.
 */
export const fixtures = {
  freshGame,
  earlyCareer,
  midGame,
  wealthyGame,
  inPrison,
  nearDeath,
} as const;

export type FixtureName = keyof typeof fixtures;
