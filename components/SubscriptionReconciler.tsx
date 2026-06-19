/**
 * SubscriptionReconciler — keeps subscription-driven state in sync with the live
 * entitlement at the right moments (after subscription data loads + on every
 * foreground, since a subscription can lapse/restore while backgrounded).
 *
 * Two reconciliations, both keyed off the live subscription tier:
 *   1. DeepLife+ benefits — revert the ad-free DeepLife+ granted if it lapsed,
 *      without stripping ad-free owned via the permanent Remove Ads IAP.
 *   2. Legacy Pass season — roll the seasonal pass over (auto-collecting unclaimed
 *      rewards, no silent loss) and re-derive its premium flag from the subscription.
 *
 * Render-free; mount once inside the GameProvider tree.
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { subscriptionService } from '@/services/SubscriptionService';
import { iapService } from '@/services/IAPService';
import { reconcileSubscriptionBenefits } from '@/contexts/game/actions/SubscriptionActions';
import { reconcileLegacyPassSeason } from '@/contexts/game/actions/LegacyPassActions';
import { logger } from '@/utils/logger';

export function SubscriptionReconciler(): null {
  const setGameState = useSetGameState();
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await subscriptionService.waitForInitialization();
        if (cancelled) return;
        const plusActive = subscriptionService.getSubscriptionTier() !== 'free';
        const ownsRemoveAds =
          typeof iapService.isAdsRemoved === 'function' ? iapService.isAdsRemoved() : false;
        setGameState((prev) => {
          const afterSub = reconcileSubscriptionBenefits(prev, plusActive, ownsRemoveAds);
          return reconcileLegacyPassSeason(afterSub, plusActive);
        });
      } catch (err) {
        // Never let entitlement reconciliation break the app.
        logger.warn('[SubscriptionReconciler] reconcile failed (non-critical):', { error: err });
      } finally {
        runningRef.current = false;
      }
    };

    // Initial reconcile after mount.
    void reconcile();

    // Re-reconcile on foreground.
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') void reconcile();
    };
    const sub = AppState.addEventListener('change', onChange);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [setGameState]);

  return null;
}
