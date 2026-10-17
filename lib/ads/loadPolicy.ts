/**
 * When to (re)load a fullscreen ad, and which failures are worth backing off.
 *
 * Pure so the schedule can be pinned by a test without a native SDK. The ad
 * service used to load each format once at startup and once after every show,
 * and never again: a single no-fill at boot (common on fresh units, in
 * TestFlight, or with a flaky network) left the rewarded slot empty for the
 * whole session, so every "Watch ad" tap fell through to the no-fill courtesy
 * grant and earned nothing. And because a no-fill counted toward the circuit
 * breaker, the misconfigured interstitial slot could switch off the rewarded ad
 * and the banner with it.
 *
 * The schedule is the one AppLovin MAX documents for its own SDK: retry after
 * 2, 4, 8, 16, 32 and 64 seconds, then stop and wait for the next trigger (the
 * app returning to the foreground, or a show request) rather than polling the
 * network forever.
 */

export type FullscreenAdFormat = 'interstitial' | 'rewarded' | 'rewardedInterstitial';

/** Seconds to wait before retry N (0-based). Doubling, capped at 64 s. */
export const AD_RETRY_DELAYS_S: readonly number[] = [2, 4, 8, 16, 32, 64];

/**
 * A loaded fullscreen ad goes stale: Google's guidance is to refresh after an
 * hour, and showing an expired ad fails at the moment the player asked for it.
 * Reload a little before the hour.
 */
export const AD_FRESHNESS_MS = 55 * 60 * 1000;

/** How long a show request waits for an in-flight load before giving up. */
export const AD_SHOW_WAIT_MS = 4000;

/**
 * Delay before the next retry, or `null` once the schedule is exhausted (the
 * caller then waits for a trigger instead of retrying on a timer).
 */
export function nextRetryDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0) return null;
  const seconds = AD_RETRY_DELAYS_S[attempt];
  return seconds === undefined ? null : seconds * 1000;
}

/**
 * True for "there was no ad to serve". That is the ad network's answer, not a
 * fault in the app or the SDK, so it is retried on the normal schedule but must
 * never open the circuit breaker. The SDK reports it as
 * `googleMobileAds/error-code-no-fill` (code) or "No fill" (message).
 */
export function isNoFillError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code.toLowerCase() : '';
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return code.endsWith('no-fill') || code.endsWith('no_fill') || message.includes('no fill');
}

/** True when an ad loaded at `loadedAt` can still be shown at `now`. */
export function isAdFresh(loadedAt: number, now: number): boolean {
  return loadedAt > 0 && now >= loadedAt && now - loadedAt < AD_FRESHNESS_MS;
}
