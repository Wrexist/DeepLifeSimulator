/**
 * Taxonomy conformance — the guard that keeps the event catalogue readable.
 *
 * The failure this prevents is not dramatic, which is exactly why it needs a
 * test: nobody ever decides to name an event `ButtonClicked` alongside
 * `button_click` and `BUTTON_CLICK`. It happens one call site at a time, and by
 * the time it is obvious the historical data is already split across three
 * names that no query joins back together. A convention that is only written
 * down is a convention that erodes; this is the same rule, enforced.
 */
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_EVENT_NAME_LIST,
  isKnownAnalyticsEvent,
} from '@/lib/analytics/events';
import { IDEMPOTENT_EVENTS } from '@/lib/analytics/validation';

describe('event naming convention', () => {
  it('is lower snake_case throughout', () => {
    for (const name of ANALYTICS_EVENT_NAME_LIST) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(ANALYTICS_EVENT_NAME_LIST).size).toBe(ANALYTICS_EVENT_NAME_LIST.length);
  });

  it('keeps names short enough to read in a dashboard legend', () => {
    for (const name of ANALYTICS_EVENT_NAME_LIST) expect(name.length).toBeLessThanOrEqual(40);
  });
});

describe('one source of truth', () => {
  it('the runtime set is derived from the catalogue, so the two cannot drift', () => {
    // The bug this closes: the type and the Set used to be written out
    // separately, so adding a name to one and not the other type-checked at the
    // call site and was silently DROPPED at runtime — a funnel step that is
    // always empty, with no error anywhere.
    expect(ANALYTICS_EVENT_NAMES.size).toBe(ANALYTICS_EVENT_NAME_LIST.length);
    for (const name of ANALYTICS_EVENT_NAME_LIST) {
      expect(isKnownAnalyticsEvent(name)).toBe(true);
    }
  });

  it('rejects a name that is not in the catalogue', () => {
    expect(isKnownAnalyticsEvent('week_advance')).toBe(false); // near-miss typo
    expect(isKnownAnalyticsEvent('')).toBe(false);
  });
});

describe('de-duplication allowlist', () => {
  it('only names events that exist', () => {
    for (const name of IDEMPOTENT_EVENTS) {
      expect(isKnownAnalyticsEvent(name)).toBe(true);
    }
  });

  it('contains NO event that can represent a value transfer', () => {
    // The load-bearing invariant. Collapsing a repeat of one of these would
    // delete the evidence of the double-grant bug class this repo keeps
    // shipping (CLAUDE.md §4.4). Anything that moves money, grants a reward, or
    // advances progression must be able to arrive twice and be SEEN twice.
    const valueTransferPatterns = [
      /purchase/, /^restore/, /reward/, /^ad_rewarded$/, /premium_activated/,
      /^prestige$/, /^week_advanced$/, /^trial_/, /claimed/, /^achievement_/,
      /^challenge_/, /^goal_reached$/, /^feature_first_used$/,
    ];
    for (const name of IDEMPOTENT_EVENTS) {
      for (const pattern of valueTransferPatterns) {
        expect(name).not.toMatch(pattern);
      }
    }
  });
});

describe('funnel completeness', () => {
  /** Every step of a funnel must exist, or the funnel silently reports a cliff. */
  const funnels: Record<string, string[]> = {
    onboarding: ['session_start', 'onboarding_step', 'first_week_completed'],
    subscription: [
      'paywall_open_tapped', 'paywall_viewed', 'paywall_plan_selected', 'paywall_cta_tapped',
      'purchase_started', 'purchase_succeeded', 'premium_activated', 'first_premium_value',
    ],
    consumable: ['iap_shop_viewed', 'purchase_started', 'purchase_succeeded'],
    offers: ['offer_center_opened', 'offer_shown', 'offer_cta_tapped'],
    retention: ['session_start', 'retention_day', 'session_end'],
    progression: ['week_advanced', 'progression_stage', 'prestige', 'death'],
    adoption: ['feature_first_used', 'feature_used'],
    experiment: ['experiment_exposed'],
    economy: ['economy_week'],
    technical: ['save_failed', 'save_repaired', 'app_startup'],
  };

  for (const [funnel, steps] of Object.entries(funnels)) {
    it(`every step of the ${funnel} funnel is a real event`, () => {
      for (const step of steps) expect(isKnownAnalyticsEvent(step)).toBe(true);
    });
  }
});

describe('purchase outcomes stay distinguishable', () => {
  it('a cancellation is a separate event from a failure', () => {
    // One is a pricing signal, the other is a defect to fix. Merging them makes
    // the checkout look broken every time a player changes their mind.
    expect(isKnownAnalyticsEvent('purchase_cancelled')).toBe(true);
    expect(isKnownAnalyticsEvent('purchase_failed')).toBe(true);
  });
});
