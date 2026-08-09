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

/** Why a story-mode batch stopped. Surfaced in the digest and in logs. */
export type BatchStopReason =
  /** Ran the full year without interruption. */
  | 'year-complete'
  /** The character died partway through. */
  | 'death'
  /** An event needs an answer before the year can continue. */
  | 'decision'
  /** The tick refused to advance (guard, error, or a state that can't tick). */
  | 'blocked';

/** What one story-mode tap did, for the Year in Review surface. */
export interface YearDigest {
  /** Weeks actually advanced — less than 52 when something stopped it. */
  weeksAdvanced: number;
  stopReason: BatchStopReason;
  /** Age at the start of the batch, for the "Age 34 → 35" header. */
  ageBefore: number;
  ageAfter: number;
  /** Cash at start and end. The delta is the headline number. */
  moneyBefore: number;
  moneyAfter: number;
  netWorthBefore: number;
  netWorthAfter: number;
  /** Subsystem messages collected across the batch, deduped, in order. */
  notes: string[];
}
