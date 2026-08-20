import { OFFER_ROTATION } from '@/lib/offers/catalogue';
import { getProductConfig, PRODUCT_CONFIGS } from '@/utils/iapConfig';

describe('offer catalogue', () => {
  it('has unique offer ids', () => {
    const ids = OFFER_ROTATION.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only features SKUs that actually exist', () => {
    // A featured product that is not in the IAP config can never load from the
    // store, so its card would render an unbuyable button in the most
    // prominent slot in the shop.
    for (const offer of OFFER_ROTATION) {
      expect(Object.keys(PRODUCT_CONFIGS)).toContain(offer.productId);
    }
  });

  it('records a regular price that matches the product config', () => {
    // THE DRIFT GUARD. `regularPriceUSD` is the basis for the discount badge.
    // If it drifts above the config price, every US player sees a permanent
    // fake discount; if it drifts below, a real sale is never badged. Either
    // way the number on screen stops being true.
    for (const offer of OFFER_ROTATION) {
      const config = getProductConfig(offer.productId) as { price?: string } | undefined;
      const configUSD = parseFloat(String(config?.price ?? '').replace(/[^0-9.]/g, ''));
      expect(offer.regularPriceUSD).toBeCloseTo(configUSD, 2);
    }
  });

  it('never features the same product twice in a row', () => {
    // Including across the wrap, since the rotation repeats.
    for (let i = 0; i < OFFER_ROTATION.length; i += 1) {
      const a = OFFER_ROTATION[i];
      const b = OFFER_ROTATION[(i + 1) % OFFER_ROTATION.length];
      expect(a.productId).not.toBe(b.productId);
    }
  });

  it('describes every offer in plain words', () => {
    for (const offer of OFFER_ROTATION) {
      expect(offer.name.length).toBeGreaterThan(0);
      expect(offer.blurb.length).toBeGreaterThan(0);
      expect(offer.regularPriceUSD).toBeGreaterThan(0);
    }
  });
});
