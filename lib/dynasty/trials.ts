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
 * 2. **The reward is paid on the NEXT transition, not on selection, and only
 *    after a year of it.** You have to actually live the life:
 *    {@link TRIAL_MIN_WEEKS_PLAYED} played weeks (`weeksInThisLife`) before a
 *    Trial settles. The net-worth prestige gate alone did not do this - an heir
 *    who INHERITS above the threshold could swear a Trial, prestige in week 1
 *    of the burdened life and collect the reward for a handicap carried for a
 *    week (owner decision D2, 2026-10-23). A Trial ended early is forfeited:
 *    the transition rebuilds `active` from the newly sworn ids only.
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
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { isPrestigeFeatureUnlocked, prestigeUnlockRequirement } from '@/lib/progress/featureUnlocks';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import { hasSeatWing } from './seat';
import { activeTrialIds, pendingTrialIds, readDynasty, withDynasty } from './state';

/** The prestige capability id gating Trials. */
export const TRIALS_FEATURE = 'feature:trials';

/** Seat wing that doubles Trial rewards and allows a second concurrent Trial. */
export const TRIALS_WING = 'seat_chapter_house';

export const TRIALS_BASE_CAPACITY = 1;

/**
 * Played weeks a life must carry its Trials before they pay (D2). A year: long
 * enough that the handicap is actually lived, short enough that no ordinary
 * life misses it.
 */
export const TRIAL_MIN_WEEKS_PLAYED = WEEKS_PER_YEAR;

/**
 * Weeks PLAYED in this life - `weeksInThisLife` (lib/progress/lifeChapters),
 * read through the same one-line primitive it wraps, so this module (which both
 * prestige builders import) does not take on lifeChapters' much wider import
 * graph (achievements, rentals, goals) for one subtraction.
 */
function playedWeeks(state: GameState | undefined | null): number {
  return weeksSinceLifeStart(state?.weeksLived, state?.lifeStartWeek);
}

/** Played weeks still owed before this life's Trials settle; 0 once they will pay. */
export function trialWeeksRemaining(state: GameState | undefined | null): number {
  return Math.max(0, TRIAL_MIN_WEEKS_PLAYED - playedWeeks(state));
}
export const TRIALS_CHAPTER_HOUSE_CAPACITY = 2;

export interface TrialEffects {
  /** The life opens with $0, after every inheritance and starting-cash bonus. */
  noStartingMoney?: boolean;
  /** Hard ceilings written over the opening stats, after every bonus. */
  statCeilings?: Partial<Record<'health' | 'happiness' | 'fitness', number>>;
  /**
   * Years added to the opening age - to `date`, to the absolute `weeksLived`
   * clock every age read derives from, and to the seeded relatives - without
   * counting them as weeks PLAYED (`weeksInThisLife` still opens at 0).
   */
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

/** Withdraw a Trial before it starts. Free - nothing has been suffered yet. */
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
 *
 * Nothing is owed until the life has PLAYED {@link TRIAL_MIN_WEEKS_PLAYED}
 * weeks (D2). `weeksLived` is seeded from the starting age and The Long Road
 * adds twelve years to it, so the raw counter would pass on frame one for
 * almost every life (CLAUDE.md §4.2); the baseline-relative count does not.
 */
export function settleTrials(state: GameState | undefined | null): {
  points: number;
  settledIds: string[];
} {
  const active = activeTrialIds(state);
  if (active.length === 0) return { points: 0, settledIds: [] };
  if (trialWeeksRemaining(state) > 0) return { points: 0, settledIds: [] };
  const multiplier = trialRewardMultiplier(state);
  const points = active.reduce((sum, id) => sum + (getTrial(id)?.reward ?? 0) * multiplier, 0);
  return { points, settledIds: active };
}

/**
 * Years The Long Road (or any `yearsLost` Trial) took from THIS life - the
 * ACTIVE Trials, the ones the current life is carrying.
 *
 * A Youth Pill may not give them back (D8): the pill resets the age to
 * `YOUTH_PILL_AGE + trialYearsLost(state)`, never below, so the handicap the
 * reward pays for is still borne. Without this a pill bought for gems erased
 * the whole cost of the 300-point Trial and the reward still settled.
 */
export function trialYearsLost(state: GameState | undefined | null): number {
  const years = combinedTrialEffects(activeTrialIds(state)).yearsLost;
  return typeof years === 'number' && Number.isFinite(years) && years > 0 ? years : 0;
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
    const years = effects.yearsLost;
    // Age AND calendar year move together - advancing one without the other
    // desynchronises every birth-year calculation downstream.
    newState.date = {
      ...newState.date,
      age: (newState.date?.age ?? 18) + years,
      year: (newState.date?.year ?? 2025) + years,
    };
    // ...and so does the life's clock. This used to stop at `date.age`, the
    // stored copy, while the canonical reader `getAge` derives age from
    // `weeksLived` (`ageFromWeeksLived`, the inverse of the `computeWeeksLived`
    // seed both builders stamp). So the life ran on two ages: 30 on the HUD and
    // to the old-age roll (which still reads `date.age`), 18 to everything that
    // calls `getAge` - the pension and retirement gates, elder activities,
    // Life Chapter age goals, ribbons and age-conditioned events.
    advanceNewLifeClock(newState, years * WEEKS_PER_YEAR);
    // Twelve years pass for the family the life was dealt, too: an 18-year-old's
    // seeded parents (45, 47) would otherwise be raising a 30-year-old.
    if (Array.isArray(newState.relationships)) {
      newState.relationships = newState.relationships.map((r) =>
        r && typeof r.age === 'number' && Number.isFinite(r.age) ? { ...r, age: r.age + years } : r
      );
    }
  }
}

/**
 * Start a freshly-built life `weeks` later on the absolute clock without
 * counting those weeks as PLAYED.
 *
 * `weeksLived` is absolute and seeded from the starting age, and `lifeStartWeek`
 * (v43) is stamped to that same seed so `weeksInThisLife` reads 0 on frame one.
 * Moving only `weeksLived` would hand the character twelve years of "weeks
 * played" - the chapter ladder would open at chapter 5 and the first-session
 * guides would retire before they rendered (CLAUDE.md §4.2). So every marker the
 * builders stamp FROM the seed moves with it:
 *
 *   - `lifeStartWeek`        the "this life began" baseline
 *   - `lastEventWeeksLived`  the event-spacing marker; left behind it reads as
 *                            twelve years without an event and forces a pity
 *                            event on the first tick
 *   - `legacyBuffs.*.expiresWeeksLived`  heir buffs dated from the seed; left
 *                            behind they would expire before the first tick
 *   - `realEstate[].purchasedWeek`       a starting-bonus home bought "today"
 *   - `companies[].foundedWeek` / `company.foundedWeek`  the starting-bonus
 *                            company, founded "today" (D3)
 *
 * Markers BELOW the seed (the zeros `initialGameState` carries, or a parent's
 * timeline on carried-over records) are already in the past and stay there.
 * Mutates `newState`; only called on a life nobody can see yet.
 */
function advanceNewLifeClock(newState: GameState, weeks: number): void {
  const seed =
    typeof newState.weeksLived === 'number' && Number.isFinite(newState.weeksLived) ? newState.weeksLived : 0;
  const shift = (value: unknown): unknown =>
    typeof value === 'number' && Number.isFinite(value) && value >= seed ? value + weeks : value;

  newState.weeksLived = seed + weeks;
  // Stamped even if absent: this IS a life start, and without a baseline
  // `weeksInThisLife` would fall back to the absolute counter and read the
  // twelve years as played.
  newState.lifeStartWeek =
    (typeof newState.lifeStartWeek === 'number' && Number.isFinite(newState.lifeStartWeek)
      ? newState.lifeStartWeek
      : seed) + weeks;
  if (typeof newState.lastEventWeeksLived === 'number') {
    newState.lastEventWeeksLived = shift(newState.lastEventWeeksLived) as number;
  }
  if (newState.legacyBuffs && typeof newState.legacyBuffs === 'object') {
    const buffs = { ...newState.legacyBuffs };
    for (const key of Object.keys(buffs) as (keyof typeof buffs)[]) {
      const buff = buffs[key];
      if (buff && typeof buff === 'object') {
        buffs[key] = { ...buff, expiresWeeksLived: shift(buff.expiresWeeksLived) as number };
      }
    }
    newState.legacyBuffs = buffs;
  }
  if (Array.isArray(newState.realEstate)) {
    newState.realEstate = newState.realEstate.map((p) =>
      p && typeof p.purchasedWeek === 'number' && p.purchasedWeek >= seed
        ? { ...p, purchasedWeek: p.purchasedWeek + weeks }
        : p
    );
  }
  // A starting-bonus company founded "today" (D3). Left at the seed, the
  // twelve years would count as ownership and clear the 26-week IPO gate on
  // frame one - the exploit stamping `foundedWeek` exists to close.
  const shiftFounded = <C extends { foundedWeek?: number }>(c: C): C =>
    c && typeof c.foundedWeek === 'number' && c.foundedWeek >= seed
      ? { ...c, foundedWeek: c.foundedWeek + weeks }
      : c;
  if (Array.isArray(newState.companies)) {
    newState.companies = newState.companies.map(shiftFounded);
  }
  if (newState.company) {
    newState.company = shiftFounded(newState.company);
  }
}
