/**
 * Interstitial ads at natural breakpoints: the FALLBACK for the year-end break.
 *
 * The year-end slot offers the rewarded break first (lib/ads/yearEndBreak.ts).
 * This plain interstitial only runs when no break was offered for the boundary,
 * and it is paced by the SAME decision, `decideYearEndBreak`: never for a paying
 * player, never in a session's first two minutes, the floor between fullscreen
 * ads, the cooldown after a rewarded ad, and the per-session cap. Only the
 * readiness check differs - it needs a plain interstitial loaded, not a
 * rewarded one.
 *
 * It used to check just the grace and a 3-minute floor (ad audit, 2026-10-19).
 * Harmless while no plain interstitial unit served, but the moment one did, it
 * would have shown at every year boundary past the session cap - about 10-17
 * an hour for a fast player, and to payers too.
 *
 * The actual show is a no-op that returns `false` when no interstitial is
 * loaded or the AdMob circuit breaker is open, so this is always safe to call.
 */
import { Platform } from 'react-native';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { logger } from '@/utils/logger';
import { decideYearEndBreak } from '@/lib/ads/yearEndBreak';
import { adSessionSnapshot, noteYearEndOffered } from '@/lib/ads/adSession';

// When this module last showed one. AdMobService records every fullscreen ad in
// the shared session too; this local copy keeps the floor honest if it doesn't.
let lastInterstitialAtMs = 0;

/** Test-only: reset the local frequency-cap state. */
export function __resetInterstitialCadence(): void {
  lastInterstitialAtMs = 0;
}

/**
 * Show an interstitial if `weeksLived` lands on a year boundary and every
 * year-end pacing rule passes. Safe to call on every week advance - it gates
 * itself. Returns true only when an ad was actually shown.
 */
export async function maybeShowInterstitialForWeek(
  weeksLived: number,
  opts: { adsRemoved?: boolean; blocked?: boolean; weeksThisLife?: number; isPayer?: boolean; now?: number } = {},
): Promise<boolean> {
  // Paid ad-free, no ad SDK, or a blocking popup is up → never show.
  if (opts.adsRemoved || opts.blocked) return false;
  if (!isFeatureEnabled('adMob') || Platform.OS === 'web') return false;

  // The grace measures weeks into THIS life when the caller supplies them:
  // `weeksLived` is seeded from the starting age ((age - 18) * 52, CLAUDE.md
  // §4.2). The year-boundary check stays on the absolute counter: it is a
  // calendar breakpoint, not a progress gate.
  const weeksThisLife = typeof opts.weeksThisLife === 'number' && isFinite(opts.weeksThisLife) && opts.weeksThisLife >= 0
    ? opts.weeksThisLife
    : weeksLived;
  const now = typeof opts.now === 'number' && isFinite(opts.now) ? opts.now : Date.now();

  try {
    const { adMobService } = await import('@/services/AdMobService');
    const session = adSessionSnapshot();
    const decision = decideYearEndBreak({
      weeksLived,
      weeksThisLife,
      adsRemoved: false,
      isPayer: opts.isPayer === true,
      blocked: false,
      now,
      sessionStartedAt: session.startedAt,
      lastFullscreenAt: Math.max(session.lastFullscreenAt, lastInterstitialAtMs),
      lastRewardedAt: session.lastRewardedAt,
      offeredThisSession: session.yearEndOffered,
      adReady: typeof adMobService.isReady === 'function' ? adMobService.isReady('interstitial') : true,
    });
    if (!decision.offer) return false;
    const shown = await adMobService.showInterstitialAd('year_end');
    if (shown) {
      lastInterstitialAtMs = now;
      // Counts toward the same per-session cap as the rewarded break - but only
      // once it actually showed: a no-fill must not use up the session.
      noteYearEndOffered();
    }
    return shown;
  } catch (err) {
    logger.warn('[ads] interstitial failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
