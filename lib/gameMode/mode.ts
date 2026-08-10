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
 * The batch stops early on three conditions, all of which preserve agency:
 *   - death, so a dead character never ticks past their own funeral;
 *   - a tick that did not advance (a failed update, or state that could not be
 *     repaired), so the batch never spends 51 more ticks on broken state;
 *   - the character crossing INTO danger — see `DANGER_THRESHOLD`.
 *
 * ── WHAT IT DELIBERATELY DOES NOT STOP ON, AND WHY THE DOC USED TO ──────────
 * This comment used to promise a stop on "a pending decision, so no choice is
 * ever auto-resolved". Half of that is true and half was never implemented:
 * nothing is auto-resolved — queued events sit on the board untouched — but the
 * batch does NOT stop for them, and should not. Measured on the test seed: SIX
 * events queue in fifteen weeks. Stopping at the first would turn "1 tap = 52
 * weeks" into "1 tap = 2 weeks" and delete the reason story mode exists.
 * Decisions accumulate through the year and are handed back afterwards, which
 * is what a year-at-a-time pace means.
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
 * Below this on health or happiness, a batch hands the year back early.
 *
 * ── WHY THIS EXISTS: THE FIRST TAP USED TO KILL YOU ──────────────────────
 * A story-mode player takes no actions DURING a year — that is the whole
 * premise. Running a fresh character 52 weeks with no input, happiness decays
 * to 0 and the death rule ("happiness at 0 for 4 consecutive weeks") fires.
 * Measured twice, independently: the jest seed dies at week 15, and a real
 * browser session driving the shipped web bundle died at week ~11. So the
 * headline feature's FIRST TAP ended in a funeral, before the player had ever
 * seen a Year in Review.
 *
 * That is not the simulation being wrong — an idle life should decay, and
 * classic mode does exactly the same over the same 52 taps. The difference is
 * that classic shows you fifteen weekly screens on the way down, each an
 * invitation to act. Batching the interaction removed every one of those
 * invitations, so the batch has to reproduce the one that matters.
 *
 * 20 is chosen to land well before the 4-week grace period the death rule
 * gives: there is room to take a job, rest, or spend, rather than a jump-scare
 * one week from the end.
 */
export const DANGER_THRESHOLD = 20;

/** Vitals a batch checks against `DANGER_THRESHOLD`. */
export interface DangerVitals {
  health?: number;
  happiness?: number;
}

/**
 * True when a life is close enough to failing that the player should get the
 * wheel back. Missing stats read as safe — an absent number is not evidence of
 * danger, and treating it as danger would stop every batch on a partial save.
 */
export function isInDanger(vitals: DangerVitals | null | undefined): boolean {
  if (!vitals) return false;
  const { health, happiness } = vitals;
  if (typeof health === 'number' && health <= DANGER_THRESHOLD) return true;
  if (typeof happiness === 'number' && happiness <= DANGER_THRESHOLD) return true;
  return false;
}

/**
 * Why a batch ended before its requested span.
 *
 * `'halted'` is the failure case — a tick that did not advance. `'danger'` is
 * the deliberate one.
 */
export type YearStopReason = 'danger' | 'halted';

/** What one iteration of a batch observed, for `shouldStopBatch` to judge. */
export interface BatchTickObservation {
  /** Did the tick actually advance a week? False on death, failure, corruption. */
  advanced: boolean;
  /** Was the life ALREADY in danger when the batch started? */
  startedInDanger: boolean;
  /** Vitals after the tick, or null/undefined if they could not be read. */
  vitals: DangerVitals | null | undefined;
}

/**
 * Whether a batch should stop after this tick, and why. `null` means continue.
 *
 * Pure on purpose. The loop that calls this cannot be tested through `act()` —
 * React defers every updater queued inside one `act()` block until the block
 * exits, so a test driving `liveYear` sees the post-tick state as null for the
 * whole batch and could never observe a danger stop firing. That is a property
 * of the harness, not of the code, but it means testing this logic THROUGH the
 * loop would prove nothing. So the judgement lives here, where it can be
 * exercised directly, and the loop is reduced to one call.
 */
export function shouldStopBatch(obs: BatchTickObservation): YearStopReason | null {
  // Order matters: a tick that did not advance is a failure, and reporting it
  // as `danger` would tell the player to go fix a life that is fine.
  if (!obs.advanced) return 'halted';
  if (!obs.startedInDanger && isInDanger(obs.vitals)) return 'danger';
  return null;
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
  /**
   * Set when the batch ended before `weeksRequested`.
   *
   * This is the ONE "what happened" field the batch may report, and it is
   * exempt from the no-after-values rule above for a specific reason: it is not
   * read from state at all. The loop knows why it broke because it is the thing
   * that broke. Nothing here can be a week stale.
   */
  stoppedEarly?: YearStopReason;
}

/** Why the year ended where it did. Derived from live state, never reported. */
export type YearOutcome =
  /** Ran the full span requested. */
  | 'year-complete'
  /** The character died during it. */
  | 'death'
  /** Handed back early because health or happiness crossed into danger. */
  | 'danger'
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
  // Order is the priority of what the player most needs to know. `danger`
  // outranks `decision` because a queued event can wait a week and a life at
  // 12 happiness cannot — and because a batch that stopped for danger almost
  // always ALSO has events queued, so checking decisions first would hide the
  // reason the year actually ended.
  let outcome: YearOutcome;
  if (after.died) outcome = 'death';
  else if (weeksAdvanced <= 0) outcome = 'blocked';
  else if (digest.stoppedEarly === 'danger') outcome = 'danger';
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
