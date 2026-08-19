/**
 * Goal engine types.
 *
 * The engine is a PURE read over `GameState`. It stores nothing, grants
 * nothing, and needs no `STATE_VERSION` bump — see `lib/goals/engine.ts` for
 * why that is a deliberate design constraint and not an omission.
 */
import type { GameState } from '@/contexts/game/types';

/**
 * How far away a goal is. Exactly one goal per horizon is recommended at a
 * time, which is what keeps the card readable — three lines, not a backlog.
 */
export type GoalHorizon = 'now' | 'soon' | 'dream';

/** Where the player goes to act on a goal. An expo-router path. */
export type GoalRoute =
  | '/(tabs)/work'
  | '/(tabs)/life'
  | '/(tabs)/health'
  | '/(tabs)/market'
  | '/(tabs)/home'
  | '/(tabs)/computer'
  | '/(tabs)/mobile'
  | '/(tabs)/progression';

export interface GoalDefinition {
  id: string;
  horizon: GoalHorizon;
  /** Imperative, short, and specific — "Save $3,000", not "Improve finances". */
  title: string;
  /** One line of WHY, shown under the title. */
  rationale: string;
  /** Where tapping the goal takes the player. */
  route: GoalRoute;
  /**
   * Whether this goal makes sense for this state AT ALL. Distinct from
   * completion: a goal is eligible while it is worth pursuing, and drops out
   * when it is either achieved or no longer relevant.
   *
   * The deleted linear goal system (`utils/goalSystem.ts`) died precisely here
   * — its `shouldShow` was the exact negation of its completion check, so no
   * goal could ever be shown in a completed state and none ever completed.
   * The invariant that replaces it: `isEligible` must be TRUE for at least one
   * state in which `progress()` returns 1. `goalCatalogue.test.ts` asserts it
   * for every entry.
   */
  isEligible: (state: GameState) => boolean;
  /** Current value and the target it is measured against. */
  measure: (state: GameState) => { current: number; target: number };
  /**
   * Tie-break weight within a horizon; higher wins. Only ever compared against
   * other goals in the SAME horizon, so the scales need not be commensurable
   * across horizons.
   */
  priority: (state: GameState) => number;
  /** Formats the measure for display, e.g. `$1,240 / $3,000`. */
  format: (current: number, target: number) => string;
}

export interface RecommendedGoal {
  id: string;
  horizon: GoalHorizon;
  title: string;
  rationale: string;
  route: GoalRoute;
  current: number;
  target: number;
  /** 0–1, clamped. */
  progress: number;
  /** Preformatted `current / target` line. */
  progressLabel: string;
}

/** One entry per horizon, in `now → soon → dream` order. Horizons with no
 *  eligible goal are simply absent rather than filled with a placeholder. */
export type GoalRecommendation = RecommendedGoal[];
