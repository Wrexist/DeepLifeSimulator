/**
 * How many free-trial days an upsell entry point (crown button, banner, badge,
 * ad-sheet pill) may advertise - 0 means show "PREMIUM". MON-10; the rule is
 * `entryPointTrialDays` (lib/subscription/entryPointTrial.ts).
 *
 * Re-evaluates when the once-per-session subscription-health fetch lands and
 * when the IAP catalog loads, so a surface already on screen picks up the real
 * answer without a remount. It reads only what is already loaded: no store
 * traffic from an entry point. The paywall still resolves the per-player
 * claim itself (`resolveTrialClaim`) before any purchase.
 */
import { useEffect, useState } from 'react';
import { entryPointTrialDays } from '@/lib/subscription/entryPointTrial';
import { storeFreeTrialDays, type StoreProductLike } from '@/lib/subscription/planPricing';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS, DEEP_LIFE_PLUS_PLANS } from '@/lib/subscription/deepLifePlus';
import {
  lastObservedSubscriptionHealth,
  subscribeSubscriptionHealth,
} from '@/services/subscriptionHealthMonitor';
import { iapService } from '@/services/IAPService';

/** The plan the paywall opens on (yearly), whose intro offer the copy describes. */
const DEFAULT_PLAN_ID =
  (DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'yearly') ?? DEEP_LIFE_PLUS_PLANS[0])?.productId;

function loadedStoreTrialDays(): number | null {
  try {
    const product = (iapService.getState().products ?? []).find(
      (p) => p && p.productId === DEFAULT_PLAN_ID,
    );
    return storeFreeTrialDays((product ?? null) as StoreProductLike | null);
  } catch {
    return null;
  }
}

function compute(): number {
  return entryPointTrialDays({
    health: lastObservedSubscriptionHealth(),
    storeTrialDays: loadedStoreTrialDays(),
    configuredTrialDays: DEEP_LIFE_PLUS_FREE_TRIAL_DAYS,
  });
}

export function useEntryPointTrialDays(): number {
  const [days, setDays] = useState<number>(compute);

  useEffect(() => {
    // `subscribeSubscriptionHealth` replays the last observation immediately
    // when one exists, so a late mount catches up without a fetch.
    const offHealth = subscribeSubscriptionHealth(() => setDays(compute()));
    let offIap: (() => void) | undefined;
    try {
      offIap = iapService.addListener(() => setDays(compute()));
    } catch {
      offIap = undefined;
    }
    return () => {
      offHealth();
      offIap?.();
    };
  }, []);

  return days;
}
