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
 * `'halted'` is the failure case — a tick that did not advance. The rest are
 * deliberate, and they are the POINT of the mode rather than exceptions to it.
 *
 * ── Why a batch stopping early is the feature, not a failure ──────────────
 * This started as "one tap = 52 weeks", and measurement killed that promise:
 * a default character reached 7 weeks, and a wealthy, housed, unemployed one
 * reached 16. Per-week attribution found the cause, and it was not decay —
 * baseline decay is -0.6 happiness a week, which is sustainable indefinitely.
 * It was a DISEASE running its full six-week course untreated, because a batch
 * never gives the player the turn in which they would have treated it.
 *
 * Four attempts to fix that by tuning numbers (danger threshold, wealth
 * multiplier, grace period, job tolls) were tested and all four were wrong.
 * The real problem was never the length of the year. It was that the batch
 * was ALL-OR-NOTHING: run 52 weeks blind, or stop and say nothing useful.
 *
 * So the promise changed instead of the balance. Time advances until the life
 * needs its player — illness, danger, a decision — and then hands back with
 * the story of what happened. A quiet year runs the full 52; an eventful one
 * stops in week 11 with "you've developed allergies". Both are correct, and
 * the second is more interesting than either a silent 52 or a mystery collapse.
 *
 * That framing costs nothing this mode had promised: the simulation is still
 * identical week for week (`__tests__/gameMode/batchEquivalence.test.ts`), and
 * nothing is decided for the player — stopping is the opposite of deciding.
 */
export type YearStopReason = 'danger' | 'halted' | 'illness';

/** What one iteration of a batch observed, for `shouldStopBatch` to judge. */
export interface BatchTickObservation {
  /** Did the tick actually advance a week? False on death, failure, corruption. */
  advanced: boolean;
  /** Was the life ALREADY in danger when the batch started? */
  startedInDanger: boolean;
  /** Vitals after the tick, or null/undefined if they could not be read. */
  vitals: DangerVitals | null | undefined;
  /**
   * Name of a disease contracted THIS tick, if any.
   *
   * Only a NEW one counts. An illness the player already had when they tapped
   * is one they have chosen to live with, and stopping every week for it would
   * be the same nag loop `startedInDanger` exists to prevent.
   */
  newIllness?: string | null;
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
  // Order matters, and it is by severity of what the player must be told.
  // A tick that did not advance is a failure, and reporting it as `danger`
  // would tell the player to go fix a life that is fine.
  if (!obs.advanced) return 'halted';
  if (!obs.startedInDanger && isInDanger(obs.vitals)) return 'danger';
  // Illness ranks BELOW danger deliberately: a batch that both made the player
  // ill and drove them into danger should report the danger, which is the
  // condition that ends lives. The illness is in the recap either way.
  if (obs.newIllness) return 'illness';
  return null;
}

/**
 * Milliseconds between weeks while a story run is playing.
 *
 * ── Why story mode PLAYS instead of batching behind a spinner ─────────────
 * The first design ran 52 ticks blocked behind a loading overlay and then
 * explained them in a modal. That needed a digest to collect notes, a summary
 * to join the digest to live state, suppression flags so 52 weeks of banners
 * did not flood the screen, and a 370-line recap — roughly 680 lines whose
 * whole job was to describe what the player had not been allowed to watch.
 *
 * Letting it play deletes the reason all of that existed. The HUD updates as
 * money climbs and age ticks, so nothing needs recapping; the run simply stops
 * when the life needs its player, and a one-line banner says why. Visible
 * progress is also the more enjoyable version — an interruption to motion
 * lands harder than a modal appearing after silence.
 *
 * 110ms is roughly nine weeks a second: fast enough that a full year is about
 * six seconds, slow enough to read the numbers moving. It is a floor, not a
 * budget — the tick itself measures ~3.5ms, so the delay is pacing rather than
 * throughput.
 */
export const STORY_WEEK_MS = 110;

/** Why a story run stopped, and what to tell the player. */
export interface StoryPause {
  /** Weeks actually advanced this run. */
  weeksAdvanced: number;
  /** `null` when the run completed its full span without interruption. */
  reason: YearStopReason | null;
  /** Named when `reason` is `'illness'`, so the banner can say which. */
  illnessName?: string;
  /** Net worth before and after, for the one number worth calling out. */
  netWorthBefore: number;
  netWorthAfter: number;
}

/**
 * The single line shown when a run stops. One sentence, and where possible an
 * ACTION — a player handed the wheel back needs to know what to do, not to be
 * told a state they can already see in the HUD.
 */
export function describePause(pause: StoryPause): string {
  switch (pause.reason) {
    case 'illness':
      return pause.illnessName
        ? `You've come down with ${pause.illnessName.toLowerCase()}. Treat it in Health before it wears you down.`
        : "You've fallen ill. Treat it in Health before it wears you down.";
    case 'danger':
      return 'Your life is in trouble. Rest, earn, or see friends before carrying on.';
    case 'halted':
      return 'Something interrupted the run.';
    default:
      return pause.weeksAdvanced > 0
        ? `A quiet year — ${pause.weeksAdvanced} weeks passed.`
        : 'No time passed.';
  }
}

/**
 * Whether a run went well enough to be worth an upsell.
 *
 * Deliberately strict, and the strictness is the point: this decides whether a
 * player is asked for money, and asking at a bad moment is worse than not
 * asking. It requires an uninterrupted run, a meaningful span, and real
 * growth — a year that ended in illness or danger never qualifies.
 */
export function wasAGoodRun(pause: StoryPause): boolean {
  if (pause.reason !== null) return false;
  if (pause.weeksAdvanced < 26) return false;
  const base = Math.max(1000, Math.abs(pause.netWorthBefore));
  const delta = pause.netWorthAfter - pause.netWorthBefore;
  return delta > 0 && delta / base >= 0.15;
}


