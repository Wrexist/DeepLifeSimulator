/**
 * Ask for a store rating at a genuinely good moment - never on a schedule.
 *
 * Ratings volume and average are direct inputs to store ranking, and almost no
 * player rates unprompted. But a prompt fired on a timer is the classic nag: it
 * lands on an average week, reads as begging, and can cost a star instead of
 * earning one. So this fires ONLY on a week worth celebrating (a ready
 * promotion, or a play-streak bonus) and only after the player has actually
 * played a life.
 *
 * Platform rules do the rest: the OS itself rate-limits `requestReview` (iOS
 * caps it per year; the Play In-App Review API shows nothing when its own quota
 * is spent), so this can never become a nag even if the gate is wrong. We also
 * ask at most once per install, tracked in storage rather than the save, so no
 * schema change is needed.
 *
 * Native module is required lazily inside a try/catch (never at module top) so
 * a build without it degrades to a no-op rather than a startup crash.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

const log = logger.scope('InAppReview');

/** Weeks of THIS life before a rating prompt is even considered. */
export const REVIEW_MIN_WEEKS_IN_LIFE = 12;

/** Storage key - outside the save, so no STATE_VERSION bump. */
export const REVIEW_ASKED_KEY = '@deep_life_review_asked_v1';

export interface ReviewEligibilityInput {
  weeksInLife: number;
  /** Already asked on this install. */
  alreadyAsked: boolean;
  /** A week worth celebrating: a ready promotion or a play-streak bonus. */
  positiveWeek: boolean;
  /** A blocking moment is on screen (death/wedding/jail/life moment). */
  blocked: boolean;
}

/**
 * Pure eligibility decision. Exported so the suite exercises the REAL rule
 * rather than a copy of it.
 */
export function shouldAskForReview(o: ReviewEligibilityInput): boolean {
  if (o.alreadyAsked) return false;
  if (o.blocked) return false;
  if (!Number.isFinite(o.weeksInLife) || o.weeksInLife < REVIEW_MIN_WEEKS_IN_LIFE) return false;
  return o.positiveWeek;
}

/**
 * Is the week just lived worth a celebration prompt?
 *
 * `careerProgressPercent >= 100` is the "promotion ready" beat; a streak bonus
 * is a returning-player beat. Both are unambiguously good weeks, which is what
 * makes them the right moment to ask.
 */
export function isPositiveWeek(state: GameState | null | undefined): boolean {
  const wr = state?.weekResult;
  if (!wr) return false;
  if ((wr.careerProgressPercent ?? 0) >= 100) return true;
  return (wr.streakBonus ?? 0) > 0;
}

async function storage() {
  // Lazy so a cold start never pulls storage into the first frame.
  const mod = await import('@/utils/storageWrapper');
  return mod.lazyAsyncStorage;
}

export async function hasAskedForReview(): Promise<boolean> {
  try {
    const AsyncStorage = await storage();
    return (await AsyncStorage.getItem(REVIEW_ASKED_KEY)) === 'true';
  } catch {
    return true; // fail closed: never risk a repeat prompt
  }
}

async function markAsked(): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(REVIEW_ASKED_KEY, 'true');
  } catch {
    // Non-fatal: the OS rate-limit still prevents a nag.
  }
}

let requested = false;

/**
 * Request a review once per install. Safe to call repeatedly - it no-ops after
 * the first success, when already asked, or when the platform cannot show one.
 */
export async function requestReviewOnce(): Promise<boolean> {
  if (requested) return false;
  requested = true;
  try {
    if (await hasAskedForReview()) return false;
    // Hard Rule: native module lazily, in a try/catch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StoreReview = require('expo-store-review');
    const can = await StoreReview.hasAction?.() ?? await StoreReview.isAvailableAsync?.();
    if (!can) {
      requested = false; // let a later, capable session try
      return false;
    }
    await StoreReview.requestReview();
    await markAsked();
    log.info('Requested an in-app review after a positive week');
    return true;
  } catch (err) {
    requested = false; // never latch on a failure
    log.error('In-app review unavailable', err);
    return false;
  }
}
