/**
 * Interstitial ads at natural breakpoints.
 *
 * A full-screen interstitial is intrusive, so it only fires at an in-game
 * *year boundary* (a natural "a year passed" chapter break) and is heavily
 * frequency-capped:
 *
 *   - never when ads are removed (Remove Ads IAP / DeepLife+) — same gate as
 *     every other ad surface;
 *   - never in a build with no AdMob (dev / boring / web);
 *   - not during the first couple of in-game years (let new players settle in);
 *   - at most once per `MIN_INTERSTITIAL_GAP_MS` of real time, so rapidly
 *     advancing through many years shows at most one.
 *
 * The actual show is a no-op that returns `false` when no interstitial is
 * loaded or the AdMob circuit breaker is open, so this is always safe to call.
 */
import { Platform } from 'react-native';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { logger } from '@/utils/logger';

// Real-time floor between interstitials (session-scoped — resets each launch).
const MIN_INTERSTITIAL_GAP_MS = 3 * 60 * 1000;
// No interstitials until the player is this many in-game weeks in (~2 years).
const GRACE_WEEKS = WEEKS_PER_YEAR * 2;

let lastInterstitialAtMs = 0;

/** Test-only: reset the session frequency-cap state. */
export function __resetInterstitialCadence(): void {
  lastInterstitialAtMs = 0;
}

/**
 * Show an interstitial if `weeksLived` lands on a year boundary and every gate
 * passes. Safe to call on every week advance — it gates itself. Returns true
 * only when an ad was actually shown.
 */
export async function maybeShowInterstitialForWeek(
  weeksLived: number,
  opts: { adsRemoved?: boolean; blocked?: boolean; weeksThisLife?: number } = {},
): Promise<boolean> {
  // Paid ad-free, no ad SDK, or a blocking popup is up → never show.
  if (opts.adsRemoved || opts.blocked) return false;
  if (!isFeatureEnabled('adMob') || Platform.OS === 'web') return false;

  // Only at a natural breakpoint, and not for brand-new players. The grace
  // measures weeks into THIS life when the caller supplies them: `weeksLived`
  // is seeded from the starting age ((age - 18) * 52, CLAUDE.md §4.2), so
  // gating on the absolute counter gave the two-year grace to exactly one of
  // the eight scenario ages — the same defect BannerAd fixed for its grace
  // year. The year-boundary check below stays on the absolute counter: it is
  // a calendar breakpoint, not a progress gate.
  const graceClock = typeof opts.weeksThisLife === 'number' && isFinite(opts.weeksThisLife) && opts.weeksThisLife >= 0
    ? opts.weeksThisLife
    : weeksLived;
  if (graceClock < GRACE_WEEKS) return false;
  if (weeksLived % WEEKS_PER_YEAR !== 0) return false;

  const now = Date.now();
  if (now - lastInterstitialAtMs < MIN_INTERSTITIAL_GAP_MS) return false;

  try {
    const { adMobService } = await import('@/services/AdMobService');
    const shown = await adMobService.showInterstitialAd();
    if (shown) lastInterstitialAtMs = now;
    return shown;
  } catch (err) {
    logger.warn('[ads] interstitial failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
