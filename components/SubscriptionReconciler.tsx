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
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSetGameState, useGameSelector } from '@/contexts/game/useGameSelector';
import { subscriptionService } from '@/services/SubscriptionService';
import { iapService } from '@/services/IAPService';
import { reconcileSubscriptionBenefits } from '@/contexts/game/actions/SubscriptionActions';
import { reconcileLegacyPassSeason } from '@/contexts/game/actions/LegacyPassActions';
import { logger } from '@/utils/logger';

export function SubscriptionReconciler(): null {
  const setGameState = useSetGameState();
  const runningRef = useRef(false);
  // `weeksLived` is a stable post-load value — its first change signals the save
  // has hydrated (closing the mount-vs-load race), and later changes catch a
  // season rollover that happens mid-session.
  const weeksLived = useGameSelector((s) => s.weeksLived ?? 0);

  const reconcile = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await subscriptionService.waitForInitialization();
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
  }, [setGameState]);

  // Reconcile on mount, on foreground, and whenever the save hydrates / weeks advance.
  useEffect(() => {
    void reconcile();
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') void reconcile();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [reconcile, weeksLived]);

  return null;
}
