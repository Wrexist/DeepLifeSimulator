/**
 * Shared rewarded-ad plumbing.
 *
 * Every "watch ad → reward" surface (the floating reward orb, the Pulse
 * follower boost, in-app reward buttons) funnels through `runRewardedAd` so the
 * ad-vs-direct-grant decision lives in exactly ONE place:
 *
 *  - Ads removed (Remove Ads IAP / DeepLife+)   → grant directly, never show an ad.
 *  - AdMob enabled (release build, flag on)      → show a real rewarded video and
 *    grant ONLY when the SDK reports the reward earned. Granting without the ad
 *    completing is a deceptive-UX risk (Apple 2.3.1) and lost ad revenue.
 *  - Otherwise (dev / boring / web build)        → grant directly (no ad SDK).
 *
 * Callers should ALSO hide their "watch ad" affordance when `areAdsRemoved` is
 * true — a player who paid to remove ads shouldn't see ad prompts at all. This
 * helper's ads-removed branch is defense-in-depth for any entry point that
 * slips through.
 */
import { Platform } from 'react-native';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { logger } from '@/utils/logger';
import type { GameState } from '@/contexts/game/types';

export type RewardedAdOutcome =
  | 'granted-ad' // real rewarded video watched to completion, reward earned
  | 'granted-direct' // no ad shown (ads removed / no ad SDK) — reward granted
  | 'no-fill' // ad system on but no ad was available — NOT granted
  | 'error'; // ad failed to load / show — NOT granted

/** True when the reward was actually applied (with or without an ad). */
export function isGranted(outcome: RewardedAdOutcome): boolean {
  return outcome === 'granted-ad' || outcome === 'granted-direct';
}

/**
 * True when the player owns any ad-free entitlement (Remove Ads IAP, DeepLife+).
 * Both routes set `settings.adsRemoved`, so this single flag is authoritative.
 */
export function areAdsRemoved(state?: Pick<GameState, 'settings'> | null): boolean {
  return state?.settings?.adsRemoved === true;
}

/** Options for {@link runRewardedAd}. */
export interface RunRewardedAdOptions {
  /** Player owns an ad-free entitlement (Remove Ads / DeepLife+) — grant directly, no ad. */
  adsRemoved?: boolean;
  /** On no-fill / error, grant the reward anyway rather than returning ungranted. */
  grantOnNoFill?: boolean;
}

/**
 * Show a rewarded ad (when appropriate for this build/entitlement) and grant the
 * reward. `grant` is invoked exactly once on success — either by the ad SDK's
 * reward callback, or directly when there is no ad to show. It is NEVER called
 * on `no-fill` / `error`.
 */
export async function runRewardedAd(
  grant: () => void,
  opts: RunRewardedAdOptions = {}
): Promise<RewardedAdOutcome> {
  const adsOn = !opts.adsRemoved && isFeatureEnabled('adMob') && Platform.OS !== 'web';
  if (!adsOn) {
    // No ad inventory in this configuration (paid ad-free, or no ad SDK). Not
    // deceptive: there is simply no ad to show, so grant the reward directly.
    grant();
    return 'granted-direct';
  }
  try {
    const { adMobService } = await import('@/services/AdMobService');
    const shown = await adMobService.showRewardedAd(grant);
    if (shown) return 'granted-ad';
    // No ad was available to serve (no-fill — very common in TestFlight and on
    // brand-new ad units). `grantOnNoFill` callers (e.g. the rate-limited reward
    // orb) grant the reward anyway rather than cheating a player who tapped
    // "Watch ad" when there was simply no inventory. Real ads still play and earn
    // revenue whenever inventory IS available — this is only the empty fallback.
    if (opts.grantOnNoFill) {
      grant();
      return 'granted-direct';
    }
    return 'no-fill';
  } catch (err) {
    logger.warn('[rewardedAd] rewarded ad failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    if (opts.grantOnNoFill) {
      grant();
      return 'granted-direct';
    }
    return 'error';
  }
}
