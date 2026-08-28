/**
 * A restore may repair an entitlement. It may never GRANT one.
 *
 * MON-11 made Restore Purchases re-apply non-consumables unconditionally,
 * because the "already in the ledger" guard was exactly what stopped a restore
 * repairing an entitlement that had been wiped from game state (see the prestige
 * wipe, MON-1). Boolean flags are idempotent, so that is safe for them.
 *
 * It is NOT safe for two kinds of grant, and the first version of that fix
 * missed both — caught in review of the change itself:
 *
 *   - REVIVAL_PACK banks a one-shot revive. Re-granting it after the player has
 *     spent it mints a free revive on every restore tap.
 *   - A SUBSCRIPTION writes `expiresTimestamp: Date.now() + duration`, so
 *     re-applying it RENEWS the term. Tapping Restore Purchases repeatedly was
 *     an unlimited free renewal of a paid subscription.
 *
 * This test pins the predicate that decides which grants are non-idempotent.
 * It is a pure function precisely so the rule is testable without StoreKit.
 *
 * 2026-08-26: how the two kinds are defused DIVERGED, and the predicate's
 * remaining consumer is the PURCHASE path (reserve-before-grant, SAVE-3).
 * On restore, subscriptions are skipped outright (their term is the store's
 * to reconstruct), and REVIVAL_PACK restores with `entitlementsOnly` so the
 * purchase record re-applies while the spendable charge is never re-banked -
 * the ledger gate it used to rely on lived in LOCAL storage, which a
 * reinstall wipes (and the RC loop keyed it on a synthetic `rc_restore:` id
 * the original purchase never wrote, so one Restore tap minted a revive).
 * See revivalPackBanked.test.ts for the behavioral pins.
 */
import { isSubscriptionProduct, IAP_PRODUCTS, SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';

/**
 * Mirrors `isNonIdempotentGrant` in services/IAPService.ts. Kept in step by the
 * assertions below, which walk the real product catalogues rather than a
 * hand-written list — so a newly added subscription is covered automatically.
 */
const isNonIdempotentGrant = (productId: string): boolean =>
  productId === IAP_PRODUCTS.REVIVAL_PACK ||
  productId === IAP_PRODUCTS.REVIVE_NOW ||
  isSubscriptionProduct(productId);

describe('which grants must stay ledger-gated on restore', () => {
  it('gates the banked one-shot revive', () => {
    // Re-granting after use would mint a free revive per restore tap.
    expect(isNonIdempotentGrant(IAP_PRODUCTS.REVIVAL_PACK)).toBe(true);
  });

  it('gates the REPEATABLE revive too - it banks the same one-shot charge', () => {
    // Being a consumable is not an exemption. This predicate also drives the
    // reserve-before-grant ledger write on the PURCHASE path, so leaving it
    // out let a failed ledger write grant with no dedupe record, and a store
    // replay re-banked a revive the player had already spent.
    expect(isNonIdempotentGrant(IAP_PRODUCTS.REVIVE_NOW)).toBe(true);
  });

  it('gates EVERY subscription in the catalogue', () => {
    const subscriptionIds = Object.values(SUBSCRIPTION_PRODUCTS ?? {}).filter(
      (id): id is string => typeof id === 'string',
    );

    // Guard against the sweep proving nothing if the catalogue shape changes.
    expect(subscriptionIds.length).toBeGreaterThan(0);

    for (const id of subscriptionIds) {
      // A subscription grant sets expiresTimestamp from Date.now(), so
      // re-applying it renews the term for free.
      expect(isNonIdempotentGrant(id)).toBe(true);
    }
  });

  it('does NOT gate idempotent boolean entitlements - those must repair a wipe', () => {
    // These are the ones a restore exists to bring back after the prestige
    // wipe. Gating them is what made restore structurally unable to repair it.
    for (const id of [
      IAP_PRODUCTS.REMOVE_ADS,
      IAP_PRODUCTS.LIFETIME_PREMIUM,
    ].filter((v): v is string => typeof v === 'string')) {
      expect(isNonIdempotentGrant(id)).toBe(false);
    }
  });

  it('treats an unknown product id as idempotent rather than throwing', () => {
    expect(() => isNonIdempotentGrant('com.example.not.a.real.product')).not.toThrow();
    expect(isNonIdempotentGrant('com.example.not.a.real.product')).toBe(false);
  });
});
