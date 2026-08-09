/**
 * Game mode — the pace of a life, and the helpers every read goes through.
 *
 * WHY THIS IS A MODE AND NOT A REPLACEMENT
 * ----------------------------------------
 * A life played one week per tap runs 3,224 taps from 18 to ~80. That is the
 * original game and some players want exactly it — the weekly grain is where
 * the economy is legible, because you can watch interest accrue and bills land.
 * Story mode does not replace it and must never silently become it: an existing
 * save has no `gameMode` key, `resolveGameMode` reads that as `'classic'`, and
 * nobody's in-progress life changes pace underneath them.
 *
 * WHAT STORY MODE IS NOT
 * ----------------------
 * It is NOT a coarser simulation. The weekly tick still runs once per game week
 * — all ~37 `apply*` subsystems, same order, same inputs. Story mode batches
 * the INTERACTION (one tap = up to 52 ticks), never the simulation. Anything
 * that made the batch skip or merge weekly work would change the economy, which
 * is the one thing this game is differentiated on.
 * `__tests__/gameMode/batchEquivalence.test.ts` pins the equivalence.
 *
 * The batch stops early on two conditions, both of which preserve agency:
 *   - death, so a dead character never ticks past their own funeral;
 *   - a pending decision, so no choice is ever auto-resolved.
 */

import type { GameMode } from '@/contexts/game/types';

/** Weeks one story-mode tap advances, before any early stop. */
export const STORY_MODE_WEEKS_PER_TAP = 52;

/**
 * The pace an absent `gameMode` means.
 *
 * Not a "pick something sensible" default — it is the actual historical
 * behaviour of every save written before v38. Changing it would re-pace lives
 * already in progress, which is why every read funnels through here instead of
 * testing `state.gameMode === 'story'` inline.
 */
export function resolveGameMode(mode: GameMode | undefined | null): GameMode {
  return mode === 'story' ? 'story' : 'classic';
}

/** True when one tap should advance a year rather than a week. */
export function isStoryMode(mode: GameMode | undefined | null): boolean {
  return resolveGameMode(mode) === 'story';
}

/**
 * What one story-mode tap did, for the Year in Review surface.
 *
 * ONLY "before" values and things the batch itself knows. There is deliberately
 * no `moneyAfter` / `ageAfter` / `stopReason` here, and that absence is a design
 * decision rather than an omission:
 *
 * A batch runs inside one React callback, so anything it reports about the state
 * it PRODUCED has to be read before React has necessarily committed — and every
 * way of asking (the state ref, the tick's own published state, a no-op probe
 * updater) was measured returning stale values inside a loop. Reporting an
 * "after" number from in there means reporting one that can be a week wrong.
 *
 * The component rendering the Year in Review is already subscribed to the live
 * state and re-renders when it commits, so it has the real "after" for free.
 * This carries the half the batch actually owns; `summarizeYear` joins them.
 */
export interface YearDigest {
  /** Weeks the batch asked for. What was DELIVERED is `after - before`. */
  weeksRequested: number;
  /** Snapshot taken before the first tick — the only side the batch can trust. */
  before: {
    weeksLived: number;
    age: number;
    money: number;
    netWorth: number;
  };
  /** Subsystem messages collected across the batch, deduped, in order. */
  notes: string[];
}

/** Why the year ended where it did. Derived from live state, never reported. */
export type YearOutcome =
  /** Ran the full span requested. */
  | 'year-complete'
  /** The character died during it. */
  | 'death'
  /** Events queued up and are waiting on the player. */
  | 'decision'
  /** Nothing advanced at all. */
  | 'blocked';

/** The Year in Review, computed by joining the digest to the live state. */
export interface YearSummary {
  weeksAdvanced: number;
  outcome: YearOutcome;
  ageBefore: number;
  ageAfter: number;
  moneyBefore: number;
  moneyAfter: number;
  moneyDelta: number;
  netWorthBefore: number;
  netWorthAfter: number;
  netWorthDelta: number;
  notes: string[];
}

/** The "after" half, read from whatever the caller currently has committed. */
export interface YearAfter {
  weeksLived: number;
  age: number;
  money: number;
  netWorth: number;
  died: boolean;
  pendingDecisions: number;
}

/**
 * Join the batch's "before" to the live "after".
 *
 * `weeksAdvanced` is the movement of the game clock — not a counter the loop
 * kept — so it is right regardless of when any updater ran. That is the whole
 * reason the split exists.
 */
export function summarizeYear(digest: YearDigest, after: YearAfter): YearSummary {
  const weeksAdvanced = Math.max(0, after.weeksLived - digest.before.weeksLived);
  let outcome: YearOutcome;
  if (after.died) outcome = 'death';
  else if (weeksAdvanced <= 0) outcome = 'blocked';
  else if (after.pendingDecisions > 0) outcome = 'decision';
  else outcome = 'year-complete';

  return {
    weeksAdvanced,
    outcome,
    ageBefore: digest.before.age,
    ageAfter: after.age,
    moneyBefore: digest.before.money,
    moneyAfter: after.money,
    moneyDelta: after.money - digest.before.money,
    netWorthBefore: digest.before.netWorth,
    netWorthAfter: after.netWorth,
    netWorthDelta: after.netWorth - digest.before.netWorth,
    notes: digest.notes,
  };
}
