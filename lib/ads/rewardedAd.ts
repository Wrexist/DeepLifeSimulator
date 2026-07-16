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
  | 'granted-no-fill' // ads ON but no inventory; `grantOnNoFill` honored the reward with NO ad shown
  | 'no-fill' // ad system on but no ad was available — NOT granted
  | 'error'; // ad failed to load / show — NOT granted

/** True when the reward was actually applied (with or without an ad). */
export function isGranted(outcome: RewardedAdOutcome): boolean {
  return outcome === 'granted-ad' || outcome === 'granted-direct' || outcome === 'granted-no-fill';
}

/**
 * True when the reward was granted via the no-fill courtesy path — ads are ON
 * for this build but there was no inventory, so `grantOnNoFill` honored the
 * reward WITHOUT showing an ad. Callers use this to rate-limit the courtesy
 * grant (an unlimited faucet of no-ad rewards would be exploitable).
 */
export function isNoFillGrant(outcome: RewardedAdOutcome): boolean {
  return outcome === 'granted-no-fill';
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
 * True when THIS build/entitlement can present a real fullscreen rewarded ad
 * (AdMob enabled, native platform, player has not paid to remove ads).
 *
 * CONTRACT FOR MODAL HOSTS: when this returns true, any react-native `Modal`
 * that hosts the "Watch ad" button MUST be dismissed — and its native
 * dismissal allowed to finish — BEFORE calling {@link runRewardedAd}.
 * Presenting a fullscreen ad over an open RN Modal is unsupported by the ad
 * SDK: on iOS the ad's view controller fights the Modal's, and when the ad
 * closes the sheet vanishes natively while an invisible modal window keeps
 * intercepting every touch (the app reads as completely frozen) and the
 * earned-reward/closed handshake is lost, so the reward is never granted.
 */
export function adsAvailable(adsRemoved?: boolean): boolean {
  return !adsRemoved && isFeatureEnabled('adMob') && Platform.OS !== 'web';
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
  const adsOn = adsAvailable(opts.adsRemoved);
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
    // Reported as 'granted-no-fill' (distinct from 'granted-direct') so callers
    // can rate-limit the no-ad courtesy grant without conflating it with the
    // ads-removed paid-perk path.
    if (opts.grantOnNoFill) {
      grant();
      return 'granted-no-fill';
    }
    return 'no-fill';
  } catch (err) {
    logger.warn('[rewardedAd] rewarded ad failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    if (opts.grantOnNoFill) {
      grant();
      return 'granted-no-fill';
    }
    return 'error';
  }
}
