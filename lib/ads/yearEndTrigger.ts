/**
 * Called after every committed week advance: preloads the year-end break as the
 * boundary approaches, and opens the offer when the boundary lands and every
 * pacing rule passes (lib/ads/yearEndBreak.ts). Returns true when an offer was
 * opened, so the caller skips the plain interstitial for that boundary.
 *
 * Never throws and never blocks the week loop: everything ad-related is a
 * dynamic import behind `adsAvailable`, so a build without the ad SDK pays
 * nothing.
 */
import type { GameState } from '@/contexts/game/types';
import { adsAvailable, areAdsRemoved } from '@/lib/ads/rewardedAd';
import { adSessionSnapshot, noteYearEndOffered } from '@/lib/ads/adSession';
import {
  decideYearEndBreak,
  isPayingPlayer,
  openYearEndOffer,
  shouldPreloadYearEnd,
} from '@/lib/ads/yearEndBreak';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { logger } from '@/utils/logger';

export async function maybeOfferYearEndBreak(
  state: GameState,
  opts: { blocked: boolean; weeksThisLife: number; now?: number },
): Promise<boolean> {
  const adsRemoved = areAdsRemoved(state);
  if (!adsAvailable(adsRemoved) || isPayingPlayer(state.settings)) return false;
  try {
    const { adMobService } = await import('@/services/AdMobService');
    const weeksLived = state.weeksLived ?? 0;
    if (shouldPreloadYearEnd(weeksLived, opts.weeksThisLife)) {
      void adMobService.ensureLoaded('rewardedInterstitial');
    }
    const session = adSessionSnapshot();
    const decision = decideYearEndBreak({
      weeksLived,
      weeksThisLife: opts.weeksThisLife,
      adsRemoved,
      isPayer: false,
      blocked: opts.blocked,
      now: opts.now ?? Date.now(),
      sessionStartedAt: session.startedAt,
      lastFullscreenAt: session.lastFullscreenAt,
      lastRewardedAt: session.lastRewardedAt,
      offeredThisSession: session.yearEndOffered,
      adReady: adMobService.isReady('rewardedInterstitial'),
    });
    if (!decision.offer) return false;
    noteYearEndOffered();
    openYearEndOffer({
      boundaryWeek: weeksLived,
      yearNumber: Math.max(1, Math.round(opts.weeksThisLife / WEEKS_PER_YEAR)),
    });
    return true;
  } catch (error) {
    logger.warn('[ads] year-end break check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
