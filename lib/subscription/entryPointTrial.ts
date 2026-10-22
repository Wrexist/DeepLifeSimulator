/**
 * What an upsell ENTRY POINT (crown button, banner, avatar badge, ad-sheet
 * pill) may say about the DeepLife+ free trial (MON-10).
 *
 * Owner decision 2026-10-22:
 *   - while subscription health is UNKNOWN (the once-per-session fetch has not
 *     landed, or this build has no RevenueCat), say "PREMIUM", never "N-DAY
 *     FREE". `trialClaimPlausible` treated unknown as plausible, so every
 *     player saw a trial promise on the way in that the paywall then withdrew.
 *   - when the loaded store product reports no intro offer
 *     (`storeFreeTrialDays === 0`), drop the trial, whatever the constant says.
 *
 * It reuses the paywall's own inputs (`resolveTrialClaim`), so an entry point
 * can never promise more than the paywall will.
 */
import { resolveTrialClaim } from './planPricing';
import { trialClaimPlausible, type SubscriptionHealth } from './subscriptionHealth';

/** Trial days an entry point may advertise; 0 means show "PREMIUM". */
export function entryPointTrialDays(params: {
  /** Last observed subscription health; null = unknown this session. */
  health: SubscriptionHealth | null;
  /** `storeFreeTrialDays` of the paywall's default plan: null unknown, 0 no offer. */
  storeTrialDays: number | null;
  /** `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS`; 0 silences every trial claim. */
  configuredTrialDays: number;
}): number {
  const { health, storeTrialDays, configuredTrialDays } = params;
  // Unknown is not evidence of eligibility.
  if (health == null) return 0;
  // A current or prior subscription has used the intro offer.
  if (!trialClaimPlausible(health)) return 0;
  // Entry points cannot ask the per-user eligibility question, so 'unknown'.
  return resolveTrialClaim({ eligibility: 'unknown', storeTrialDays, configuredTrialDays }).days;
}
