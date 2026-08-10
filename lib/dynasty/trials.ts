/**
 * Dynasty Trials — prestige tier 4.
 *
 * ## The gap this closes, stated plainly
 *
 * Prestige #5 was mechanically identical to prestige #2. Every life after the
 * first started from the same place, with the same options, and got easier in
 * exactly one direction: more prestige bonuses, more Dynasty Tree, more head
 * start. There was no way to make a life DIFFERENT, only richer.
 *
 * A Trial is a handicap you choose to carry, declared before the transition and
 * paid out in Legacy Points at the end of the life you carried it through. It
 * is the one place in the game where the answer to "why prestige again?" is
 * "because this run can be a different run".
 *
 * ## Three rules that keep it honest
 *
 * 1. **The bite is absolute, never relative.** A Trial worded "forfeit your
 *    Dynasty Tree bonuses" would pay a player who owns no Tree nodes for
 *    nothing — the classic free-lunch handicap. Every Trial here sets a floor
 *    or a ceiling on the new life directly, so it costs a veteran and a
 *    first-timer the same real thing.
 *
 * 2. **The reward is paid on the NEXT transition, not on selection.** You have
 *    to actually live the life. Prestige is gated on a net-worth threshold that
 *    scales with prestige level (`isPrestigeAvailable`), so there is no way to
 *    take a Trial and immediately cash it.
 *
 * 3. **Settlement is derived from the state being rebuilt**, so re-running the
 *    transition on the same save yields the same points rather than
 *    accumulating — the same idempotence `claimContract` relies on.
 *
 * ## Lifecycle
 *
 *   choose  →  dynasty.trials.pending
 *   transition (prestige, or death → heir):
 *       active trials SETTLE     → legacy points
 *       pending      PROMOTE     → active, and their effects hit the new life
 *       pending                  → cleared
 *
 * Both `createResetGameState` and `createChildGameState` run the same hook, so
 * the death→heir path cannot silently skip a settlement the prestige path pays.
 */

import type { DynastyState, GameState } from '@/contexts/game/types';
import { isPrestigeFeatureUnlocked, prestigeUnlockRequirement } from '@/lib/progress/featureUnlocks';
import { hasSeatWing } from './seat';
import { activeTrialIds, pendingTrialIds, readDynasty, withDynasty } from './state';

/** The prestige capability id gating Trials. */
export const TRIALS_FEATURE = 'feature:trials';

/** Seat wing that doubles Trial rewards and allows a second concurrent Trial. */
export const TRIALS_WING = 'seat_chapter_house';

export const TRIALS_BASE_CAPACITY = 1;
export const TRIALS_CHAPTER_HOUSE_CAPACITY = 2;

export interface TrialEffects {
  /** The life opens with $0, after every inheritance and starting-cash bonus. */
  noStartingMoney?: boolean;
  /** Hard ceilings written over the opening stats, after every bonus. */
  statCeilings?: Partial<Record<'health' | 'happiness' | 'fitness', number>>;
  /** Years added to the opening age (and to the calendar, so they stay in step). */
  yearsLost?: number;
}

export interface DynastyTrial {
  id: string;
  name: string;
  /** The vow, in the fiction. */
  blurb: string;
  /** What it costs you, mechanically. Written for a player. */
  cost: string;
  /** Legacy Points paid when the life ends, before the Chapter House multiplier. */
  reward: number;
  effects: TrialEffects;
}

/**
 * Three, not thirty. Each one attacks a different axis — money, body, time —
 * so taking two (with the Chapter House) is a real combination rather than two
 * helpings of the same penalty.
 */
export const DYNASTY_TRIALS: DynastyTrial[] = [
  {
    id: 'trial_pauper',
    name: "Pauper's Vow",
    blurb: 'The family money stays in the family. It just does not come to you.',
    cost: 'Begin with $0. Every inheritance and starting-cash bonus is forfeit.',
    reward: 200,
    effects: { noStartingMoney: true },
  },
  {
    id: 'trial_frail',
    name: 'Frail Vessel',
    blurb: 'A weak heart, and a diagnosis nobody wrote down.',
    cost: 'Begin at 25 health, 25 happiness and 0 fitness, whatever you were owed.',
    reward: 150,
    effects: { statCeilings: { health: 25, happiness: 25, fitness: 0 } },
  },
  {
    id: 'trial_long_road',
    name: 'The Long Road',
    blurb: 'Twelve years spent somewhere that does not go on a CV.',
    cost: 'Begin twelve years older. Twelve fewer years to build anything.',
    reward: 300,
    effects: { yearsLost: 12 },
  },
];

const BY_ID = new Map(DYNASTY_TRIALS.map((t) => [t.id, t]));

export function getTrial(id: string): DynastyTrial | undefined {
  return BY_ID.get(id);
}

export function trialCapacity(state: GameState | undefined | null): number {
  return hasSeatWing(state, TRIALS_WING)
    ? TRIALS_CHAPTER_HOUSE_CAPACITY
    : TRIALS_BASE_CAPACITY;
}

/** 2 with the Chapter House, 1 without. */
export function trialRewardMultiplier(state: GameState | undefined | null): number {
  return hasSeatWing(state, TRIALS_WING) ? 2 : 1;
}

export interface TrialResult {
  success: boolean;
  message: string;
  dynasty?: DynastyState;
}

/**
 * Declare a Trial for the next life.
 *
 * PURE reducer — safe to run for the report and again inside the updater. The
 * id already being pending is what blocks the second run.
 */
export function addPendingTrial(
  state: GameState | undefined | null,
  trialId: string
): TrialResult {
  const trial = getTrial(trialId);
  if (!trial) return { success: false, message: 'Unknown trial.' };

  if (!isPrestigeFeatureUnlocked(state, TRIALS_FEATURE)) {
    return { success: false, message: prestigeUnlockRequirement(state, TRIALS_FEATURE) };
  }

  const pending = pendingTrialIds(state);
  if (pending.includes(trialId)) {
    return { success: false, message: `${trial.name} is already sworn.` };
  }

  const capacity = trialCapacity(state);
  if (pending.length >= capacity) {
    return {
      success: false,
      message: capacity === TRIALS_BASE_CAPACITY
        ? 'One Trial at a time. Build the Chapter House to swear two.'
        : `You may swear ${capacity} Trials at a time.`,
    };
  }

  const trials = readDynasty(state).trials ?? {};
  return {
    success: true,
    message: `${trial.name} sworn. It begins with your next life.`,
    dynasty: withDynasty(state, { trials: { ...trials, pending: [...pending, trialId] } }),
  };
}

/** Withdraw a Trial before it starts. Free — nothing has been suffered yet. */
export function removePendingTrial(
  state: GameState | undefined | null,
  trialId: string
): TrialResult {
  const pending = pendingTrialIds(state);
  if (!pending.includes(trialId)) {
    return { success: false, message: 'That Trial is not sworn.' };
  }
  const trials = readDynasty(state).trials ?? {};
  return {
    success: true,
    message: `${getTrial(trialId)?.name ?? 'The Trial'} withdrawn.`,
    dynasty: withDynasty(state, {
      trials: { ...trials, pending: pending.filter((id) => id !== trialId) },
    }),
  };
}

/** The union of every effect in a set of trial ids. Unknown ids are ignored. */
export function combinedTrialEffects(trialIds: readonly string[]): TrialEffects {
  const out: TrialEffects = {};
  for (const id of new Set(trialIds)) {
    const trial = getTrial(id);
    if (!trial) continue;
    const e = trial.effects;
    if (e.noStartingMoney) out.noStartingMoney = true;
    if (typeof e.yearsLost === 'number') out.yearsLost = (out.yearsLost ?? 0) + e.yearsLost;
    if (e.statCeilings) {
      out.statCeilings = { ...(out.statCeilings ?? {}) };
      for (const [stat, value] of Object.entries(e.statCeilings)) {
        const key = stat as 'health' | 'happiness' | 'fitness';
        const existing = out.statCeilings[key];
        // The HARSHEST ceiling wins when two trials name the same stat, so
        // stacking can only ever cost more.
        out.statCeilings[key] =
          typeof existing === 'number' ? Math.min(existing, value as number) : (value as number);
      }
    }
  }
  return out;
}

/**
 * Points owed for the life that just ended.
 *
 * Derived from the state being torn down, so re-running a transition against
 * the same save produces the same number instead of accumulating.
 */
export function settleTrials(state: GameState | undefined | null): {
  points: number;
  settledIds: string[];
} {
  const active = activeTrialIds(state);
  if (active.length === 0) return { points: 0, settledIds: [] };
  const multiplier = trialRewardMultiplier(state);
  const points = active.reduce((sum, id) => sum + (getTrial(id)?.reward ?? 0) * multiplier, 0);
  return { points, settledIds: active };
}

/**
 * Write the handicaps onto a freshly-built life.
 *
 * Mutates `newState`: it is called from inside `createResetGameState` /
 * `createChildGameState`, on an object nobody else can see yet, and it must run
 * AFTER every bonus so a ceiling cannot be re-raised by a starting bonus
 * applied later.
 */
export function applyTrialEffectsToNewLife(
  newState: GameState,
  trialIds: readonly string[]
): void {
  const effects = combinedTrialEffects(trialIds);

  if (effects.noStartingMoney) {
    newState.stats = { ...newState.stats, money: 0 };
  }

  if (effects.statCeilings) {
    const stats = { ...newState.stats };
    for (const [stat, ceiling] of Object.entries(effects.statCeilings)) {
      const key = stat as 'health' | 'happiness' | 'fitness';
      const current = stats[key];
      if (typeof current === 'number' && typeof ceiling === 'number' && current > ceiling) {
        stats[key] = ceiling;
      }
    }
    newState.stats = stats;
  }

  if (typeof effects.yearsLost === 'number' && effects.yearsLost > 0) {
    // Age AND calendar year move together — advancing one without the other
    // desynchronises every birth-year calculation downstream.
    newState.date = {
      ...newState.date,
      age: (newState.date?.age ?? 18) + effects.yearsLost,
      year: (newState.date?.year ?? 2025) + effects.yearsLost,
    };
  }
}
