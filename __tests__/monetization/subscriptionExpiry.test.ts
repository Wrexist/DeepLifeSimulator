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

describe('a subscription term is finite', () => {
  it('gives monthly 30 days from the purchase', () => {
    expect(subscriptionExpiryFor(MONTHLY, NOW)).toBe(NOW + 30 * DAY);
  });

  it('gives yearly 365 days from the purchase', () => {
    expect(subscriptionExpiryFor(YEARLY, NOW)).toBe(NOW + 365 * DAY);
  });

  it('gives yearly a materially longer term than monthly', () => {
    // Guards against both collapsing onto the same constant.
    expect(subscriptionExpiryFor(YEARLY, NOW)!).toBeGreaterThan(
      subscriptionExpiryFor(MONTHLY, NOW)!,
    );
  });
});

describe('an expired term is not active', () => {
  it('refuses a monthly bought 31 days ago - the Restore exploit', () => {
    const expiry = subscriptionExpiryFor(MONTHLY, NOW - 31 * DAY);

    expect(isSubscriptionActiveAt(expiry, NOW)).toBe(false);
  });

  it('refuses a yearly bought 400 days ago', () => {
    const expiry = subscriptionExpiryFor(YEARLY, NOW - 400 * DAY);

    expect(isSubscriptionActiveAt(expiry, NOW)).toBe(false);
  });

  it('refuses at the exact moment the term ends', () => {
    const expiry = subscriptionExpiryFor(MONTHLY, NOW - 30 * DAY);

    expect(isSubscriptionActiveAt(expiry, NOW)).toBe(false);
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
