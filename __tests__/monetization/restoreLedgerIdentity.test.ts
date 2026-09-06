/**
 * A restore may never spend the store's retry.
 *
 * The native (non-RevenueCat) restore loop re-applies a MIXED product -
 * a consumable that also carries permanent entitlements - with
 * `entitlementsOnly`, so the perks come back and the quantities are dropped.
 * That half is correct and deliberate (R4-MON-5). What was not: it handed
 * `applyBenefit` the REAL store transaction id.
 *
 * `applyBenefit` records whatever id it is given, and `setupPurchaseListener`
 * dedups store REDELIVERY on that same real id and then calls
 * `finishTransactionAsync`. So for a purchase whose original grant failed -
 * app killed mid-purchase, save unwritable - the sequence was:
 *
 *   1. buy the $99.99 Mega Pack (40,000 gems + four perks + four unlocks)
 *   2. the grant fails; the transaction is deliberately left UNFINISHED so the
 *      store redelivers it (MON-6)
 *   3. the gems never arrive, so the player taps Restore Purchases - which is
 *      exactly what the failure message tells them to do
 *   4. restore applies the perks and records the real txid
 *   5. the redelivery arrives, sees the ledger entry, finishes the transaction
 *   6. the 40,000 gems are gone for good
 *
 * Paid once, received half, and the recovery action is what destroyed the
 * retry. `REVIVAL_PACK` was already defused by hand with a synthetic
 * `native_restore:revival_pack` id, and the comment there names the general
 * shape - it was simply only applied to that one product.
 *
 * This pins the rule for the CLASS rather than for one SKU: the id a native
 * restore may record is derived from the product, and every product whose
 * quantities the restore drops must get a synthetic one. A new mixed SKU is
 * covered the day it is added to the catalogue.
 */
import { nativeRestoreLedgerId } from '@/services/IAPService';
import {
  CONSUMABLE_PRODUCTS,
  NON_CONSUMABLE_PRODUCTS,
  hasPermanentEntitlements,
  isConsumableProduct,
} from '@/utils/iapConfig';

/** A real-looking store transaction id - the value that must never be recorded. */
const STORE_TXID = '2000000712345678';

/** The products the restore loop actually reaches: mixed consumables. */
const mixedConsumables = CONSUMABLE_PRODUCTS.filter((id) => hasPermanentEntitlements(id));

describe('a native restore never records the store transaction id it did not fulfil', () => {
  it('the catalogue still HAS a mixed product, so this suite is proving something', () => {
    // If this ever hits zero the assertions below sweep an empty list and pass
    // for the wrong reason. The Mega Pack is the standing example.
    expect(mixedConsumables.length).toBeGreaterThan(0);
  });

  it('every mixed consumable restores under a synthetic id', () => {
    for (const productId of mixedConsumables) {
      const ledgerId = nativeRestoreLedgerId(productId, STORE_TXID);
      expect(ledgerId).not.toBe(STORE_TXID);
      expect(ledgerId.startsWith('native_restore:')).toBe(true);
    }
  });

  it('the synthetic id is per-product, so two SKUs cannot mask each other', () => {
    const ids = new Set(mixedConsumables.map((id) => nativeRestoreLedgerId(id, STORE_TXID)));
    expect(ids.size).toBe(mixedConsumables.length);
  });

  it('a synthetic id can never collide with a store transaction id', () => {
    // Store ids are digits; the prefix guarantees the ledger entry the restore
    // writes is not the one the redelivery will look up.
    for (const productId of mixedConsumables) {
      expect(/^\d+$/.test(nativeRestoreLedgerId(productId, STORE_TXID))).toBe(false);
    }
  });

  it('a plain non-consumable keeps the REAL id - that grant did land in full', () => {
    // The rule is not "always synthetic". A boolean entitlement restore applies
    // the whole product, so recording the store id is correct and is what stops
    // the listener re-running work that is already done.
    const plain = NON_CONSUMABLE_PRODUCTS.filter((id) => !isConsumableProduct(id));
    expect(plain.length).toBeGreaterThan(0);
    for (const productId of plain) {
      expect(nativeRestoreLedgerId(productId, STORE_TXID)).toBe(STORE_TXID);
    }
  });
});
