/**
 * A lapsed subscription must not come back for free on a Restore tap.
 *
 * `syncSubscriptions` set `isActive: true` purely because the product appeared
 * in `iapService.hasPurchased(productId)`. That reads `state.purchases`, which
 * `restorePurchases` fills from `getPurchaseHistoryAsync()` — purchase HISTORY,
 * which includes subscriptions that expired or were cancelled long ago.
 * `Subscription.expiresAt` was declared on the type and never assigned or read
 * anywhere in the repo.
 *
 * So a player whose DeepLife+ had lapsed tapped Restore Purchases and got the
 * whole premium tier back indefinitely — ad-free, the Legacy Pass premium
 * track, +25% career income, the 250/day gem drop instead of 20, and 20% off
 * gem upgrades — without paying. `syncSubscriptions` re-runs on every
 * `iapService` state change, so a single Restore was enough.
 *
 * Live on any build without RevenueCat keys, which includes the `preview` EAS
 * profile. 2026-07-30 audit MON-3.
 *
 * These test the PURE term rule rather than the singleton: an earlier version
 * of this file drove `SubscriptionService` directly and its headline assertion
 * passed for the wrong reason (the harness never populated the service at all,
 * so every tier read "free" including the ones that should not have).
 */
import {
  subscriptionExpiryFor,
  isSubscriptionActiveAt,
} from '@/services/SubscriptionService';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const MONTHLY = Object.values(SUBSCRIPTION_PRODUCTS).find((id) => /month/i.test(id))!;
const YEARLY = Object.values(SUBSCRIPTION_PRODUCTS).find((id) => /year|annual/i.test(id))!;

describe('the catalogue really has the products these assertions rely on', () => {
  it('exposes a monthly and a yearly subscription id', () => {
    expect(MONTHLY).toBeTruthy();
    expect(YEARLY).toBeTruthy();
    expect(MONTHLY).not.toBe(YEARLY);
  });
});

// The synthetic term carries a 3-day billing-retry buffer (2026-08-26): on
// this no-RevenueCat path a renewal in the store's billing retry produces no
// new purchase record, so a hard cutoff at exactly day 30 revoked a subscriber
// whose card hiccuped on renewal morning. Far short of Apple's 16-day grace on
// purpose - here the buffer is also free access for a genuinely lapsed
// subscriber until the ledger catches up.
const GRACE = 3 * DAY;

describe('a subscription term is finite', () => {
  it('gives monthly 30 days (plus the retry buffer) from the purchase', () => {
    expect(subscriptionExpiryFor(MONTHLY, NOW)).toBe(NOW + 30 * DAY + GRACE);
  });

  it('gives yearly 365 days (plus the retry buffer) from the purchase', () => {
    expect(subscriptionExpiryFor(YEARLY, NOW)).toBe(NOW + 365 * DAY + GRACE);
  });

  it('gives yearly a materially longer term than monthly', () => {
    // Guards against both collapsing onto the same constant.
    expect(subscriptionExpiryFor(YEARLY, NOW)!).toBeGreaterThan(
      subscriptionExpiryFor(MONTHLY, NOW)!,
    );
  });
});

describe('an expired term is not active', () => {
  it('refuses a monthly bought 34 days ago - the Restore exploit', () => {
    const expiry = subscriptionExpiryFor(MONTHLY, NOW - 34 * DAY);

    expect(isSubscriptionActiveAt(expiry, NOW)).toBe(false);
  });

  it('refuses a yearly bought 400 days ago', () => {
    const expiry = subscriptionExpiryFor(YEARLY, NOW - 400 * DAY);

    expect(isSubscriptionActiveAt(expiry, NOW)).toBe(false);
  });

  it('refuses at the exact moment the term (with its buffer) ends', () => {
    const expiry = subscriptionExpiryFor(MONTHLY, NOW - 30 * DAY - GRACE);

    expect(isSubscriptionActiveAt(expiry, NOW)).toBe(false);
  });
});

describe('the billing-retry buffer', () => {
  it('keeps a monthly whose renewal charge is a day late', () => {
    // Day 31: the term is over but the charge may be in billing retry - the
    // exact subscriber the hard day-30 cutoff used to strip.
    expect(isSubscriptionActiveAt(subscriptionExpiryFor(MONTHLY, NOW - 31 * DAY), NOW)).toBe(true);
  });
});

describe('a live term IS active - the fix must not strip paying subscribers', () => {
  it('keeps a monthly bought yesterday', () => {
    expect(isSubscriptionActiveAt(subscriptionExpiryFor(MONTHLY, NOW - DAY), NOW)).toBe(true);
  });

  it('keeps a yearly bought 100 days ago', () => {
    expect(isSubscriptionActiveAt(subscriptionExpiryFor(YEARLY, NOW - 100 * DAY), NOW)).toBe(true);
  });

  it('keeps one bought a second ago', () => {
    expect(isSubscriptionActiveAt(subscriptionExpiryFor(MONTHLY, NOW - 1_000), NOW)).toBe(true);
  });
});

describe('UNKNOWN is not EXPIRED', () => {
  it('returns undefined when the ledger has no timestamp', () => {
    expect(subscriptionExpiryFor(MONTHLY, undefined)).toBeUndefined();
    expect(subscriptionExpiryFor(MONTHLY, 0)).toBeUndefined();
    expect(subscriptionExpiryFor(MONTHLY, NaN)).toBeUndefined();
    expect(subscriptionExpiryFor(MONTHLY, -1)).toBeUndefined();
  });

  it('treats an unknown expiry as still active', () => {
    // Revoking on a missing timestamp would strip a paying subscriber's
    // access — the same failure mode as MON-1, where a cold-start-empty check
    // wrote `false` over a purchase.
    expect(isSubscriptionActiveAt(undefined, NOW)).toBe(true);
  });
});
