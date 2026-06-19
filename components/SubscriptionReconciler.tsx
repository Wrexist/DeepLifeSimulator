/**
 * SubscriptionReconciler — keeps in-game DeepLife+ benefits in sync with the
 * live subscription entitlement.
 *
 * Runs once after subscription data loads, and again whenever the app returns to
 * the foreground (a subscription can lapse or be restored while backgrounded).
 * Reverts the ad-free that DeepLife+ granted if the subscription has lapsed —
 * without ever stripping ad-free owned via the permanent Remove Ads IAP.
 *
 * Render-free; mount once inside the GameProvider tree.
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { subscriptionService } from '@/services/SubscriptionService';
import { iapService } from '@/services/IAPService';
import { reconcileSubscriptionBenefits } from '@/contexts/game/actions/SubscriptionActions';
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
        setGameState((prev) => reconcileSubscriptionBenefits(prev, plusActive, ownsRemoveAds));
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
