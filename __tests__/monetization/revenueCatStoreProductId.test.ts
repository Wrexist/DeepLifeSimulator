/**
 * The subscription purchase path looked packages up by
 * `storeProduct.productIdentifier`, a field `PurchasesStoreProduct` does not
 * have (it is `identifier`), and Android subscription ids carry a base-plan
 * suffix (`productId:basePlanId`). Either way the lookup missed, and every
 * subscription purchase fell through to the direct path that fails on Android.
 */
import { storeProductBaseId } from '@/services/RevenueCatService';

describe('storeProductBaseId', () => {
  it('reads the SDK identifier field', () => {
    expect(storeProductBaseId({ identifier: 'deeplife_plus_monthly' })).toBe('deeplife_plus_monthly');
  });

  it('strips an Android base-plan suffix', () => {
    expect(storeProductBaseId({ identifier: 'deeplife_plus_monthly:monthly' })).toBe('deeplife_plus_monthly');
  });

  it('still accepts the legacy productIdentifier shape', () => {
    expect(storeProductBaseId({ productIdentifier: 'deeplife_plus_yearly' })).toBe('deeplife_plus_yearly');
  });

  it('returns undefined for anything unusable', () => {
    expect(storeProductBaseId(undefined)).toBeUndefined();
    expect(storeProductBaseId({})).toBeUndefined();
    expect(storeProductBaseId({ identifier: 42 })).toBeUndefined();
  });
});
