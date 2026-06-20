/**
 * DeepLife+ subscription benefit application — pure GameState transformers.
 *
 * Applies the in-game benefits of an active DeepLife+ subscription:
 *   - Removes ads (settings.adsRemoved) — same gate the Remove Ads IAP uses.
 *   - Grants a one-time gem welcome bonus (idempotent via
 *     settings.deepLifePlusActivated).
 *
 * The Legacy Pass premium track is gated separately on the subscription tier
 * (subscriptionService.getSubscriptionTier), so it needs no state change here.
 *
 * Pure + immutable — drop into `setGameState(prev => applyDeepLifePlusBenefits(prev))`.
 */
import type { GameState } from '@/contexts/game/types';
import { DEEP_LIFE_PLUS_WELCOME_GEMS } from '@/lib/subscription/deepLifePlus';

const safeAddGems = (base: number | undefined, amount: number): number => {
  const b = typeof base === 'number' && isFinite(base) ? base : 0;
  const a = isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return b + a;
};

/**
 * Grant DeepLife+ benefits. Idempotent for the welcome gems: they are only
 * granted on the first activation (gated by settings.deepLifePlusActivated);
 * ad removal is always (re)asserted.
 */
export function applyDeepLifePlusBenefits(state: GameState): GameState {
  // Welcome gems are gated by a STICKY flag so they are granted exactly once,
  // ever — a lapse + resubscribe must not re-grant them (the benefit copy says
  // "one-time"). `deepLifePlusActivated` toggles with the subscription; the
  // sticky `deepLifePlusWelcomeClaimed` does not.
  const welcomeClaimed = state.settings?.deepLifePlusWelcomeClaimed === true;
  const gemGrant = welcomeClaimed ? 0 : DEEP_LIFE_PLUS_WELCOME_GEMS;

  return {
    ...state,
    settings: {
      ...state.settings,
      adsRemoved: true,
      adsRemovedDate: state.settings?.adsRemovedDate ?? new Date().toISOString(),
      deepLifePlusActivated: true,
      deepLifePlusWelcomeClaimed: true,
    },
    stats: {
      ...state.stats,
      gems: safeAddGems(state.stats?.gems, gemGrant),
    },
  };
}

/**
 * Reconcile DeepLife+ benefits against the live entitlement at session start /
 * foreground. Pure — the caller supplies the two booleans read from the services.
 *
 *  - `plusActive`    : DeepLife+ subscription is currently active.
 *  - `ownsRemoveAds` : the player owns the permanent Remove Ads IAP. This MUST be
 *                      the authoritative union of ALL non-subscription ad-free
 *                      entitlements — if a future promo grants ad-free, fold it in
 *                      here, otherwise a lapse would wrongly revoke it.
 *
 * If active → (re)apply benefits. If lapsed → revert ONLY the ad-free that
 * DeepLife+ granted (tracked by `deepLifePlusActivated`), and NEVER strip ad-free
 * that the permanent Remove Ads IAP justifies. No-op when there is nothing owed.
 */
export function reconcileSubscriptionBenefits(
  state: GameState,
  plusActive: boolean,
  ownsRemoveAds: boolean,
): GameState {
  if (plusActive) {
    // applyDeepLifePlusBenefits is idempotent (welcome gems only on first activation).
    return applyDeepLifePlusBenefits(state);
  }

  // Lapsed (or never active). Only act if DeepLife+ had previously granted benefits.
  if (state.settings?.deepLifePlusActivated !== true) {
    return state;
  }

  return {
    ...state,
    settings: {
      ...state.settings,
      deepLifePlusActivated: false,
      // Ad-free is derived directly from the (authoritative) entitlement so a
      // stale `false` can't wrongly revoke a permanent Remove Ads purchase.
      adsRemoved: ownsRemoveAds,
    },
  };
}
