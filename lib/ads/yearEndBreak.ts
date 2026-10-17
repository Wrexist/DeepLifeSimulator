/**
 * The year-end break: an opt-out REWARDED interstitial at the in-game year
 * boundary, the one natural chapter break in the week loop.
 *
 * Why this format. The year-end slot was a plain interstitial, and both of its
 * configured units are rewarded-interstitial units, which the standard
 * interstitial class cannot serve - so it never filled and the game had no
 * system-initiated fullscreen placement at all. A rewarded interstitial pays
 * like a rewarded video, and unlike a plain interstitial it gives the player
 * something (gems) and a way out. AdMob requires an intro that names the reward
 * and offers a skip before the ad starts; the countdown card is that intro
 * (components/YearEndBreak.tsx). Skipping costs nothing.
 *
 * The pacing is the pattern the large casual publishers converge on (LevelPlay
 * capping/pacing, ironSource interstitial guidance): never at launch, a floor
 * between fullscreen ads of any kind, a cooldown after an ad the player chose,
 * a per-session cap, and no forced ads for players who have paid.
 *
 * Nothing here is save state. The trigger is a real committed week advance, so
 * a boundary cannot be re-offered by relaunching; the reward re-checks the
 * boundary week inside its updater, and a doubled ad callback is dropped by a
 * guard taken before the update is dispatched.
 */
import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export const YEAR_END_BREAK = {
  /** Two in-game years into this life before the first break. */
  graceWeeks: WEEKS_PER_YEAR * 2,
  /** Never in the first two minutes of a session. */
  sessionWarmupMs: 2 * 60 * 1000,
  /** Floor between fullscreen ads of any kind. */
  minGapMs: 3 * 60 * 1000,
  /** Cooldown after a rewarded ad the player chose to watch. */
  afterRewardedMs: 5 * 60 * 1000,
  /** Breaks offered per session, shown or declined. */
  maxPerSession: 4,
  /** What the ad pays. */
  rewardGems: 15,
  /** Intro countdown before the ad starts unless the player skips. */
  introSeconds: 5,
  /** Start loading this many weeks before the boundary. */
  preloadWeeks: 6,
} as const;

/** One-time purchases that mark a paying player (who never gets a forced break). */
const PAYER_FLAGS = [
  'lifetimePremium',
  'everythingUnlocked',
  'unlimitedYouthPills',
  'moneyMultiplier',
  'hasRevivalPack',
  'premiumCreditCard',
  'financialPlanning',
  'businessBanking',
  'privateBanking',
] as const;

export function isPayingPlayer(settings: GameState['settings'] | undefined): boolean {
  if (!settings) return false;
  const bag = settings as unknown as Record<string, unknown>;
  return PAYER_FLAGS.some((key) => {
    const v = bag[key];
    return v === true || (typeof v === 'number' && Number.isFinite(v) && v > 1);
  });
}

export interface YearEndInputs {
  weeksLived: number;
  weeksThisLife: number;
  adsRemoved: boolean;
  isPayer: boolean;
  /** A death/wedding/jail/life-moment/event modal is up. */
  blocked: boolean;
  now: number;
  sessionStartedAt: number;
  lastFullscreenAt: number;
  lastRewardedAt: number;
  offeredThisSession: number;
  /** A rewarded interstitial is loaded and fresh. */
  adReady: boolean;
}

export type YearEndSkip =
  | 'ads_removed'
  | 'payer'
  | 'blocked'
  | 'not_year_end'
  | 'grace'
  | 'session_warmup'
  | 'min_gap'
  | 'after_rewarded'
  | 'session_cap'
  | 'not_ready';

export type YearEndDecision = { offer: true } | { offer: false; reason: YearEndSkip };

/** Pure: should this committed week advance offer the year-end break? */
export function decideYearEndBreak(i: YearEndInputs): YearEndDecision {
  const skip = (reason: YearEndSkip): YearEndDecision => ({ offer: false, reason });
  if (i.adsRemoved) return skip('ads_removed');
  if (i.isPayer) return skip('payer');
  if (i.blocked) return skip('blocked');
  if (i.weeksLived <= 0 || i.weeksLived % WEEKS_PER_YEAR !== 0) return skip('not_year_end');
  if (i.weeksThisLife < YEAR_END_BREAK.graceWeeks) return skip('grace');
  if (i.now - i.sessionStartedAt < YEAR_END_BREAK.sessionWarmupMs) return skip('session_warmup');
  if (i.lastFullscreenAt > 0 && i.now - i.lastFullscreenAt < YEAR_END_BREAK.minGapMs) return skip('min_gap');
  if (i.lastRewardedAt > 0 && i.now - i.lastRewardedAt < YEAR_END_BREAK.afterRewardedMs) return skip('after_rewarded');
  if (i.offeredThisSession >= YEAR_END_BREAK.maxPerSession) return skip('session_cap');
  if (!i.adReady) return skip('not_ready');
  return { offer: true };
}

/** True in the last few weeks before an eligible boundary: time to preload. */
export function shouldPreloadYearEnd(weeksLived: number, weeksThisLife: number): boolean {
  if (!Number.isFinite(weeksLived) || !Number.isFinite(weeksThisLife)) return false;
  const toBoundary = WEEKS_PER_YEAR - (weeksLived % WEEKS_PER_YEAR);
  const thisLifeAtBoundary = weeksThisLife + toBoundary;
  return toBoundary <= YEAR_END_BREAK.preloadWeeks && thisLifeAtBoundary >= YEAR_END_BREAK.graceWeeks;
}

// ---------------------------------------------------------------------------
// The pending offer, shared between the trigger (TopStatsBar) and the card.
// ---------------------------------------------------------------------------

export interface YearEndOffer {
  /** The `weeksLived` boundary this offer belongs to. */
  boundaryWeek: number;
  /** In-game year just completed, for the copy. */
  yearNumber: number;
}

let pending: YearEndOffer | null = null;
const listeners = new Set<(offer: YearEndOffer | null) => void>();
let lastRewardedBoundary = -1;

export function getYearEndOffer(): YearEndOffer | null {
  return pending;
}

export function subscribeYearEndOffer(listener: (offer: YearEndOffer | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: YearEndOffer | null): void {
  pending = next;
  listeners.forEach((l) => l(next));
}

export function openYearEndOffer(offer: YearEndOffer): void {
  publish(offer);
}

export function closeYearEndOffer(): void {
  if (pending) publish(null);
}

/**
 * Take the one reward this boundary pays. Called by the ad's reward callback,
 * OUTSIDE any updater: a module guard inside an updater would break under
 * React's double-invoked updaters, and the hazard it covers is the ad SDK
 * delivering its reward callback twice, not a same-batch double tap.
 */
export function claimYearEndReward(boundaryWeek: number): boolean {
  if (lastRewardedBoundary === boundaryWeek) return false;
  lastRewardedBoundary = boundaryWeek;
  return true;
}

/**
 * Pure: credit the break's reward, only while the player is still on the
 * boundary week the offer was made for.
 */
export function applyYearEndReward(prev: GameState, boundaryWeek: number): GameState {
  if (prev.weeksLived !== boundaryWeek) return prev;
  const gems = typeof prev.stats?.gems === 'number' && Number.isFinite(prev.stats.gems) ? prev.stats.gems : 0;
  return { ...prev, stats: { ...prev.stats, gems: gems + YEAR_END_BREAK.rewardGems } };
}

/** Test-only. */
export function __resetYearEndBreak(): void {
  pending = null;
  listeners.clear();
  lastRewardedBoundary = -1;
}
