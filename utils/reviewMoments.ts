/**
 * Review moments — pure detection and TIMING of "genuine positive beats".
 *
 * No React, no storage, no native modules. `ReviewPromptHandler` feeds this
 * module consecutive GameState snapshots and a clock, and it answers three
 * questions:
 *
 *   1. `detectReviewMoment`  — did something worth celebrating just happen,
 *                              and how big was it (0..1 intensity)?
 *   2. `detectSourMoment`    — did something BAD just happen (cancel the ask)?
 *   3. `decideReviewTiming`  — given an armed beat, is *now* the moment?
 *
 * WHY INTENSITY, AND WHY A DELAY
 * ------------------------------
 * iOS grants ~3 review sheets per app per year. Two things waste them:
 *
 *  - Asking on a small win. A first promotion at level 2 is nice; fulfilling a
 *    whole life ambition is a peak. Only the peaks are worth an ask, so every
 *    beat is scored and anything under MIN_REVIEW_INTENSITY is ignored.
 *
 *  - Asking at the wrong instant. The beat fires the moment state commits —
 *    which is when the toast, the haptic and the celebration animation are all
 *    still playing. A sheet thrown up right then COVERS the reward the player
 *    is still reading and reads as an interruption, which is how apps collect
 *    one-star "stop nagging me" reviews. The ask belongs in the afterglow: a
 *    few seconds later, animation finished, reward absorbed, player idle.
 *
 * Note on ethics + App Store rules: choosing a happy moment to ask is exactly
 * what Apple recommends. What is NOT done here (and must not be added) is
 * review gating — pre-screening players with a "are you enjoying the app?"
 * question and routing only the happy ones to the store. That violates
 * App Store Review Guideline 1.1.7 and is a rejection risk.
 *
 * The three beats, in priority order when several land in one tick:
 *   1. `promotion`          — a career level went up.
 *   2. `ambition_milestone` — an ambition milestone was reached, or the whole
 *                             ambition was fulfilled and its payoff claimed.
 *   3. `investment_win`     — a stock/crypto sale realised a gain that is large
 *                             relative to what the player is worth.
 *
 * Deliberately NOT triggers: weekly income, gem purchases, ad rewards. Those
 * are routine (or worse, moments where the player just spent money).
 */

import type { GameState } from '@/contexts/game/types';
import { getAmbitionById } from '@/lib/ambitions';

export type ReviewTrigger = 'promotion' | 'ambition_milestone' | 'investment_win';

export interface ReviewMoment {
  trigger: ReviewTrigger;
  /** How big a deal this was, 0..1. Only >= MIN_REVIEW_INTENSITY is asked on. */
  intensity: number;
}

/**
 * A realised gain must clear BOTH bars to count as a "big" win:
 *
 *  - `BIG_WIN_MIN_ABSOLUTE` stops early-game noise. A $200 profit is a rounding
 *    error even when the player only has $400 to their name.
 *  - `BIG_WIN_MIN_NET_WORTH_FRACTION` keeps the bar meaningful late-game. A
 *    fixed threshold would fire on every routine trade once the player is a
 *    millionaire, which is exactly the "this isn't special" case we're avoiding.
 */
export const BIG_WIN_MIN_ABSOLUTE = 5000;
export const BIG_WIN_MIN_NET_WORTH_FRACTION = 0.25;

/** Below this, the beat is real but not peak enough to spend an ask on. */
export const MIN_REVIEW_INTENSITY = 0.6;

/** Two qualifying beats in one window means the player is on a roll. */
export const STREAK_INTENSITY_BONUS = 0.1;

// --- Timing constants -------------------------------------------------------
/** Let the toast + celebration animation finish before the sheet appears. */
export const AFTERGLOW_MS = 3200;
/** No game week may have advanced this recently — a ticking player is busy. */
export const QUIET_MS = 1200;
/** How often the handler re-evaluates an armed beat. */
export const TIMING_POLL_MS = 700;
/** Past this, the glow is gone; asking late is worse than not asking. */
export const MAX_WAIT_MS = 20000;

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Lifetime realised trading gains across both markets. Monotonic by design. */
function totalRealizedGains(state: GameState | null | undefined): number {
  if (!state) return 0;
  // `stocks.realizedGains` is cumulative. On the crypto side we read
  // `totalRealizedGains` (lifetime) and NOT `realizedGainsThisYear`, which is
  // debited to zero at every game-year boundary — deltas off that field would
  // read as a huge loss each year and, worse, as a huge "win" the week after.
  return num(state.stocks?.realizedGains) + num(state.cryptoMarket?.totalRealizedGains);
}

interface CareerSnapshot {
  level: number;
  topLevel: number;
}

/** Level + ladder height for every accepted career, keyed by id. */
function careerSnapshots(state: GameState | null | undefined): Map<string, CareerSnapshot> {
  const snapshots = new Map<string, CareerSnapshot>();
  const careers = Array.isArray(state?.careers) ? state!.careers : [];
  for (const career of careers) {
    if (!career || typeof career.id !== 'string') continue;
    if (!career.accepted) continue;
    const rungs = Array.isArray(career.levels) ? career.levels.length : 0;
    snapshots.set(career.id, { level: num(career.level), topLevel: Math.max(0, rungs - 1) });
  }
  return snapshots;
}

function milestoneCount(state: GameState | null | undefined): number {
  const reached = state?.ambitionCompletedMilestones;
  return Array.isArray(reached) ? reached.length : 0;
}

/**
 * Compare two consecutive snapshots and report the positive beat, if any,
 * scored by how big a deal it was.
 *
 * Returns `null` for the overwhelmingly common case of "nothing special
 * happened", so the caller can bail before touching storage.
 */
export function detectReviewMoment(
  prev: GameState | null | undefined,
  next: GameState | null | undefined
): ReviewMoment | null {
  if (!prev || !next) return null;

  // 1. Promotion — an accepted career climbed a rung. Only compare careers
  //    present in BOTH snapshots: a career appearing for the first time is a
  //    hire, not a promotion, and starting a job is not the beat we want.
  //    Intensity scales with how far up the ladder they now are, so making
  //    partner lands harder than the first step off the bottom rung.
  const prevCareers = careerSnapshots(prev);
  for (const [id, after] of careerSnapshots(next)) {
    const before = prevCareers.get(id);
    if (before === undefined || after.level <= before.level) continue;
    const climbed = after.topLevel > 0 ? clamp01(after.level / after.topLevel) : 0.5;
    return { trigger: 'promotion', intensity: clamp01(0.5 + 0.5 * climbed) };
  }

  // 2. Ambition progress. Fulfilling the whole ambition is the single biggest
  //    beat in the game — it is the payoff of a lifelong goal, so it scores 1.
  //    A single milestone scores by how far along the path it sits.
  if (!prev.ambitionRewardClaimed && next.ambitionRewardClaimed) {
    return { trigger: 'ambition_milestone', intensity: 1 };
  }
  const reachedNow = milestoneCount(next);
  if (reachedNow > milestoneCount(prev)) {
    const total = getAmbitionById(next.ambitionId)?.milestones.length ?? 0;
    if (total <= 0) {
      // No resolvable ambition, so there is no path length to score against —
      // this milestone could be the first of three or the last of ten. An
      // unscoreable beat is deliberately parked BELOW MIN_REVIEW_INTENSITY:
      // with only three asks a year, ambiguous data must not spend one.
      return { trigger: 'ambition_milestone', intensity: 0.5 };
    }
    const progress = clamp01(reachedNow / total);
    return { trigger: 'ambition_milestone', intensity: clamp01(0.45 + 0.45 * progress) };
  }

  // 3. Investment win — realised gains jumped. Scale the bar AND the score to
  //    the money the player had BEFORE the sale, so "big" means big to them.
  const gain = totalRealizedGains(next) - totalRealizedGains(prev);
  if (gain >= BIG_WIN_MIN_ABSOLUTE) {
    const moneyBefore = num(prev.stats?.money);
    if (gain >= moneyBefore * BIG_WIN_MIN_NET_WORTH_FRACTION) {
      // Doubling your money is a 1.0; scraping over the 25% bar is ~0.65.
      const ratio = moneyBefore > 0 ? gain / moneyBefore : 1;
      return { trigger: 'investment_win', intensity: clamp01(0.5 + 0.5 * ratio) };
    }
  }

  return null;
}

/**
 * Did something BAD just happen? A sour beat cancels an armed ask outright.
 *
 * Asking for a rating seconds after a bankruptcy, a jail sentence or a death is
 * the single most reliable way to earn a one-star review, and it would also
 * burn one of the three yearly asks doing it.
 */
export function detectSourMoment(
  prev: GameState | null | undefined,
  next: GameState | null | undefined
): boolean {
  if (!prev || !next) return false;

  if (!prev.showDeathPopup && next.showDeathPopup) return true;
  if (!prev.bankruptcyTriggered && next.bankruptcyTriggered) return true;
  // Falling behind on the bills. `bankruptcyTriggered` above has NO writer
  // anywhere in the repo — `types.ts` says as much ("`BANKRUPTCY_FLOOR` names a
  // bankruptcy the game cannot reach") — so on its own that line has never
  // fired, and the money axis had no failure state here at all. `overdueBalance`
  // (STATE_VERSION 31) is the one it actually got: unpayable weekly bills accrue
  // there instead of being silently forgiven. Owing money you could not pay is
  // the definition of a bad week, and the worst possible moment to ask for five
  // stars. The flag check stays — it costs nothing and starts working the day
  // something writes it.
  if (num(next.overdueBalance) > num(prev.overdueBalance)) return true;
  if (num(next.jailWeeks) > num(prev.jailWeeks)) return true;

  // A sharp health collapse (illness, injury, neglect) reads as a bad week
  // whatever else happened alongside it.
  const healthBefore = num(prev.stats?.health);
  const healthAfter = num(next.stats?.health);
  if (healthBefore - healthAfter >= 20) return true;

  // Losing a big slice of net worth in one step — a crash, a lawsuit, a failed
  // business. The positive-beat detector could still be firing on a technicality
  // (e.g. a sale that realised a gain while the portfolio cratered), so this
  // check is what stops us celebrating a bad week.
  const moneyBefore = num(prev.stats?.money);
  const moneyAfter = num(next.stats?.money);
  if (moneyBefore > 0 && moneyAfter < moneyBefore * 0.5) return true;

  return false;
}

/**
 * Is the game in a state where a review sheet would land cleanly?
 *
 * `pendingEvents` is the key one: a queued weekly event means a modal is about
 * to take over the screen. Two sheets fighting for the front is the opposite
 * of a good moment.
 */
export function isCalmEnoughToAsk(state: GameState | null | undefined): boolean {
  if (!state) return false;
  if (state.showDeathPopup) return false;
  if (state.bankruptcyTriggered) return false;
  // Same reasoning as `detectSourMoment`: this is the arrears state that exists,
  // where the flag above is one nothing writes. A player carrying unpaid bills
  // is not in a five-star mood.
  if (num(state.overdueBalance) > 0) return false;
  if (num(state.jailWeeks) > 0) return false;
  const pending = state.pendingEvents;
  if (Array.isArray(pending) && pending.length > 0) return false;
  return true;
}

export interface ReviewTimingInput {
  /** Now, in epoch ms. */
  now: number;
  /** When the beat was detected, in epoch ms. */
  armedAt: number;
  /** When a game week last advanced, in epoch ms. 0 = never seen one. */
  lastWeekChangeAt: number;
  /** Is the app in the foreground? */
  appActive: boolean;
  /** Did a sour beat land since arming? */
  soured: boolean;
  /** Does the live state pass `isCalmEnoughToAsk`? */
  calm: boolean;
}

/** `wait` = check again shortly; `abandon` = drop it; `ask` = show the sheet. */
export type ReviewTimingDecision = 'wait' | 'abandon' | 'ask';

/**
 * The timing state machine, as a pure function so every branch is testable
 * without timers or a rendered tree.
 *
 * Order matters: the two `abandon` cases are checked first so a soured or
 * backgrounded run stops immediately instead of idling until the deadline.
 */
export function decideReviewTiming(input: ReviewTimingInput): ReviewTimingDecision {
  // Something went wrong in the game — the moment is dead, not delayed.
  if (input.soured) return 'abandon';

  // Backgrounded: a sheet requested now is shown to nobody and spends one of
  // the three yearly asks doing it. Drop it and catch the next beat.
  if (!input.appActive) return 'abandon';

  // The glow has faded. Asking now is just a random interruption.
  if (input.now - input.armedAt > MAX_WAIT_MS) return 'abandon';

  // Let the celebration play out first.
  if (input.now - input.armedAt < AFTERGLOW_MS) return 'wait';

  // The player is mid-tick (holding down "next week", watching numbers move).
  // They are busy, not savouring. Wait for them to stop.
  if (input.lastWeekChangeAt > 0 && input.now - input.lastWeekChangeAt < QUIET_MS) return 'wait';

  // A modal is up or about to be. Let it clear.
  if (!input.calm) return 'wait';

  return 'ask';
}
