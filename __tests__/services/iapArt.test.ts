/**
 * One art map, and every featured offer resolves through it.
 *
 * The paths used to be inlined in `GemShopModal`, which was fine while it was
 * the only surface that rendered a product and a duplicated source of truth the
 * moment the Offer Center existed.
 */
import { IAP_ART, iapArtFor } from '@/utils/iapArt';
import { OFFER_ROTATION } from '@/lib/offers/catalogue';
import { IAP_PRODUCTS } from '@/utils/iapConfig';

describe('IAP art map', () => {
  it('resolves art for every product it lists', () => {
    for (const [id, art] of Object.entries(IAP_ART)) {
      expect(art).toBeDefined();
      expect(iapArtFor(id)).toBe(art);
    }
  });

  it('covers every offer in the rotation except the one documented gap', () => {
    // Private Banking has no dedicated artwork. The card renders without a
    // picture rather than borrowing a misleading one — asserted here so the
    // exception stays deliberate instead of becoming a silent hole.
    const missing = OFFER_ROTATION.filter((o) => !iapArtFor(o.productId)).map((o) => o.productId);
    expect(missing).toEqual([IAP_PRODUCTS.PRIVATE_BANKING]);
  });

  it('returns undefined for an unknown product rather than a stand-in', () => {
    expect(iapArtFor('not_a_real_sku')).toBeUndefined();
  });
});
