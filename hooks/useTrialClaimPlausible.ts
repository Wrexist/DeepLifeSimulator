/**
 * Whether upsell entry points (crown button, banner, badge) may advertise the
 * free trial — false once this session has OBSERVED a current or prior
 * subscription, because an introductory offer is once per subscription group
 * and a lapsed ex-subscriber has burned theirs. The paywall itself resolves
 * the real, store-backed claim (`resolveTrialClaim`); this only stops the
 * entry points printing a promise the paywall would immediately withdraw.
 *
 * Subscribes to the subscription-health monitor, so a surface already on
 * screen drops its trial flag the moment the once-per-session health fetch
 * lands on an ex-subscriber.
 */
import { useEffect, useState } from 'react';
import type { SubscriptionHealth } from '@/lib/subscription/subscriptionHealth';
import { trialClaimPlausible } from '@/lib/subscription/subscriptionHealth';
import {
  lastObservedSubscriptionHealth,
  subscribeSubscriptionHealth,
} from '@/services/subscriptionHealthMonitor';

export function useTrialClaimPlausible(): boolean {
  const [plausible, setPlausible] = useState<boolean>(() =>
    trialClaimPlausible(lastObservedSubscriptionHealth()),
  );

  useEffect(() => {
    // `subscribeSubscriptionHealth` replays the last observation immediately
    // when one exists, so a late mount catches up without a fetch.
    return subscribeSubscriptionHealth((health: SubscriptionHealth) => {
      setPlausible(trialClaimPlausible(health));
    });
  }, []);

  return plausible;
}
