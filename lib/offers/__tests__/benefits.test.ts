/**
 * Benefit copy and value claims must be derived, never written.
 *
 * The bullets come from `PRODUCT_DISPLAY_META`, whose contents are the same
 * list `applyProductBenefitsToState` actually grants — so a bullet is a promise
 * the purchase code keeps. The value line is a ratio between two real prices,
 * and is omitted whenever it cannot be computed truthfully. These tests pin
 * both, and in particular pin that nothing invents a reference value.
 */
import { offerBenefits } from '@/lib/offers/benefits';
import { OFFER_ROTATION } from '@/lib/offers/catalogue';
import { IAP_PRODUCTS, getProductDisplayMeta } from '@/utils/iapConfig';

describe('offerBenefits', () => {
  it('lists a bundle from the same contents the grant code uses', () => {
    const { bullets } = offerBenefits(IAP_PRODUCTS.GEMS_PREMIUM);
    expect(bullets).toEqual(getProductDisplayMeta(IAP_PRODUCTS.GEMS_PREMIUM).contents);
    expect(bullets.join(' ')).toContain('3,500 Gems');
  });

  it('derives bullets for a SKU with no display-meta entry', () => {
    const { bullets } = offerBenefits(IAP_PRODUCTS.GEMS_1000);
    expect(bullets.some((b) => b.includes('1,000'))).toBe(true);
  });

  it('states gems per dollar and how it compares to the baseline pack', () => {
    // 3,500 gems at $24.99 = ~140/$; the 100-gem pack at $0.99 is ~101/$.
    const { valueLine } = offerBenefits(IAP_PRODUCTS.GEMS_PREMIUM);
    expect(valueLine).toMatch(/gems per \$1/);
    expect(valueLine).toMatch(/× the 100-gem pack/);
  });

  it('does not dress up a pack that is NOT better value', () => {
    // The baseline compared against itself is 1.0×. Claiming "1.0× better" is
    // the kind of empty superlative that makes every other claim suspect.
    const { valueLine } = offerBenefits(IAP_PRODUCTS.GEMS_100);
    expect(valueLine).toMatch(/gems per \$1/);
    expect(valueLine).not.toMatch(/×/);
  });

  it('omits the value line entirely for a SKU that grants no gems', () => {
    const { gems, valueLine } = offerBenefits(IAP_PRODUCTS.WORK_BOOST);
    expect(gems).toBeNull();
    expect(valueLine).toBeNull();
  });

  it('prefers a live discounted price, so a real sale improves the ratio', () => {
    const regular = offerBenefits(IAP_PRODUCTS.GEMS_PREMIUM);
    const onSale = offerBenefits(IAP_PRODUCTS.GEMS_PREMIUM, 14.99);
    // Pull the rate out by its own label. Stripping from the first non-digit
    // instead returns 0 for every line, because they all begin with "≈ ".
    const rate = (line: string | null) =>
      Number((/(\d[\d,]*) gems per/.exec(line ?? '')?.[1] ?? '0').replace(/,/g, ''));
    expect(rate(onSale.valueLine)).toBeGreaterThan(rate(regular.valueLine));
  });

  it('ignores a nonsense live price rather than printing a nonsense ratio', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { valueLine } = offerBenefits(IAP_PRODUCTS.GEMS_PREMIUM, bad);
      expect(valueLine).toMatch(/gems per \$1/);
      // `-` alone matches the hyphen in "100-gem pack"; the thing worth
      // rejecting is a NEGATIVE NUMBER.
      expect(valueLine).not.toMatch(/NaN|Infinity|-\d/);
    }
  });

  it('never claims a fabricated cash value', () => {
    // "A $60 value!" is unfalsifiable — nothing in this app ever sold those
    // gems for $60 — and it is what Apple's guidelines treat as misleading.
    for (const offer of OFFER_ROTATION) {
      const { valueLine, bullets } = offerBenefits(offer.productId);
      const text = [valueLine ?? '', ...bullets].join(' ');
      expect(text).not.toMatch(/worth \$|value of \$|was \$|normally \$/i);
    }
  });

  it('gives every offer in the rotation something to say', () => {
    // A featured offer that renders as a bare name is the placeholder look this
    // whole change exists to remove.
    for (const offer of OFFER_ROTATION) {
      expect(offerBenefits(offer.productId).bullets.length).toBeGreaterThan(0);
    }
  });

  it('degrades to empty on an unknown product', () => {
    expect(offerBenefits('not_a_real_sku')).toEqual({ bullets: [], gems: null, valueLine: null });
  });
});
