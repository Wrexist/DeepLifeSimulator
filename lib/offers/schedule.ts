/**
 * The weekly offer rotation.
 *
 * DETERMINISM. The schedule is a pure function of a UTC instant, so every
 * player in every timezone sees the same offer in the same week and the client
 * needs no server to agree with itself. This is the same approach
 * `lib/challenges/weeklyChallenges.ts` already takes for the weekly challenge,
 * deliberately — two rotating systems with two different notions of "this week"
 * would be indefensible in the UI.
 *
 * WHY UTC WALL-CLOCK AND NOT `weeksLived`. Everything the player EARNS is gated
 * on game state, because a device-clock gate on a reward is farmable
 * (v28/v31/v35/v40/v44 all exist to close one of those). An offer grants
 * nothing — it is a shop window — and it has to line up with a price change
 * scheduled in App Store Connect, which happens on real calendar dates. Moving
 * a sale by scrubbing the clock gains the player nothing: the price is the
 * store's, not ours.
 *
 * THE EPOCH. Monday 2024-01-01T00:00:00Z, an arbitrary but fixed Monday. Weeks
 * run Monday→Monday in UTC.
 */
import { OFFER_ROTATION } from './catalogue';
import type { ScheduledOffer } from './types';

/** Monday 2024-01-01T00:00:00Z, in ms. */
export const ROTATION_EPOCH_MS = Date.UTC(2024, 0, 1);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The absolute UTC week index for an instant.
 *
 * Floor, not truncate: an instant before the epoch must go DOWN to a negative
 * index rather than toward zero, or the two weeks either side of the epoch
 * would collide on index 0. Only reachable with a badly-set device clock, which
 * is exactly when a schedule must stay coherent rather than double up.
 */
export function weekIndexAt(now: Date | number = new Date()): number {
  const ms = typeof now === 'number' ? now : now.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor((ms - ROTATION_EPOCH_MS) / WEEK_MS);
}

/** The UTC instant a given week index begins. */
export function weekStart(weekIndex: number): Date {
  return new Date(ROTATION_EPOCH_MS + weekIndex * WEEK_MS);
}

/**
 * The offer occupying a week index.
 *
 * A true modulo (`((n % m) + m) % m`), not `n % m`, so a negative index from a
 * back-dated clock still lands inside the catalogue instead of reading
 * `OFFER_ROTATION[-3]` and rendering an empty card.
 */
export function offerForWeek(weekIndex: number): ScheduledOffer {
  const len = OFFER_ROTATION.length;
  const idx = ((weekIndex % len) + len) % len;
  return {
    weekIndex,
    offer: OFFER_ROTATION[idx],
    startsAt: weekStart(weekIndex),
    endsAt: weekStart(weekIndex + 1),
  };
}

/** This week's offer. */
export function currentOffer(now: Date | number = new Date()): ScheduledOffer {
  return offerForWeek(weekIndexAt(now));
}

/** Last week's, this week's and next week's — the whole Offer Center strip.
 *  Showing what is COMING is the point: a rotation the player can see ahead of
 *  is a schedule, not a pressure tactic. */
export function offerWindow(now: Date | number = new Date()): {
  previous: ScheduledOffer;
  current: ScheduledOffer;
  next: ScheduledOffer;
} {
  const idx = weekIndexAt(now);
  return {
    previous: offerForWeek(idx - 1),
    current: offerForWeek(idx),
    next: offerForWeek(idx + 1),
  };
}

/**
 * Milliseconds until the current offer rotates out.
 *
 * Clamped at 0. The countdown this drives corresponds to a REAL boundary — the
 * moment `currentOffer` starts returning a different offer — so it can never be
 * one of the fake resetting timers the brief rules out.
 */
export function msUntilRotation(now: Date | number = new Date()): number {
  const ms = typeof now === 'number' ? now : now.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, offerForWeek(weekIndexAt(ms)).endsAt.getTime() - ms);
}

/** "3d 14h" / "14h 20m" / "8m". Coarse on purpose — a ticking second counter on
 *  a shop window is pressure for its own sake. */
export function formatRotationCountdown(msRemaining: number): string {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) return 'rotating now';
  const totalMinutes = Math.floor(msRemaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
