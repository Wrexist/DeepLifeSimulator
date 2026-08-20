/**
 * Price honesty.
 *
 * Apple's guidelines prohibit misleading pricing, and the brief's hard rule is
 * that a discount must never be derived in the UI. These tests encode the
 * single property that makes both true: a badge appears ONLY when the store's
 * own price is provably below the recorded regular price in the same currency.
 * Every other path renders the real price with no claim attached.
 */
import { resolveOfferPrice } from '@/lib/offers/pricing';
import type { OfferDefinition } from '@/lib/offers/types';

const OFFER: OfferDefinition = {
  id: 'test_offer',
  productId: 'deeplife_gems_1000',
  name: 'Gem Boost',
  blurb: '1,000 gems.',
  regularPriceUSD: 9.99,
  audience: 'everyone',
};

describe('resolveOfferPrice', () => {
  it('is not purchasable and shows no price when the SKU did not load', () => {
    for (const product of [null, undefined, {}, { displayPrice: '' }]) {
      const resolved = resolveOfferPrice(OFFER, product as never);
      expect(resolved.purchasable).toBe(false);
      expect(resolved.displayPrice).toBe('');
      expect(resolved.discountPercent).toBeNull();
    }
  });

  it('renders the store string verbatim', () => {
    const resolved = resolveOfferPrice(OFFER, { displayPrice: '¥1,500' });
    expect(resolved.displayPrice).toBe('¥1,500');
    expect(resolved.purchasable).toBe(true);
  });

  it('claims NO discount when no price change is scheduled', () => {
    // The default state of the world. The rotation runs every week regardless
    // of whether anyone scheduled a temporary price change in App Store
    // Connect, so "featured, at its normal price" must be a first-class,
    // silent outcome — not a 0% badge.
    const resolved = resolveOfferPrice(OFFER, {
      displayPrice: '$9.99',
      priceAmount: 9.99,
      currency: 'USD',
    });
    expect(resolved.discountPercent).toBeNull();
    expect(resolved.strikethroughPrice).toBeNull();
    expect(resolved.displayPrice).toBe('$9.99');
  });

  it('badges a real, scheduled reduction', () => {
    const resolved = resolveOfferPrice(OFFER, {
      displayPrice: '$6.99',
      priceAmount: 6.99,
      currency: 'USD',
    });
    expect(resolved.discountPercent).toBe(30);
    expect(resolved.strikethroughPrice).toBe('$9.99');
    expect(resolved.displayPrice).toBe('$6.99');
  });

  it('refuses to claim a discount on a non-USD storefront', () => {
    // `regularPriceUSD` is USD by definition and the app has no exchange rate.
    // Under-claiming a real sale abroad is the accepted cost of making a false
    // claim structurally impossible.
    const resolved = resolveOfferPrice(OFFER, {
      displayPrice: '€6,99',
      priceAmount: 6.99,
      currency: 'EUR',
    });
    expect(resolved.discountPercent).toBeNull();
    expect(resolved.strikethroughPrice).toBeNull();
    expect(resolved.purchasable).toBe(true);
    expect(resolved.displayPrice).toBe('€6,99');
  });

  it('never parses a formatted price string into a number', () => {
    // "1.234,56 €" and "$1,234.56" do not parse the same way, so a localized
    // string is display-only. Without a numeric amount there is no comparison
    // and therefore no badge.
    const resolved = resolveOfferPrice(OFFER, { displayPrice: '$6.99' });
    expect(resolved.discountPercent).toBeNull();
    expect(resolved.displayPrice).toBe('$6.99');
  });

  it('treats a price ABOVE the recorded regular price as no sale', () => {
    // Apple adjusts prices for tax and FX, so our record can go stale. A
    // negative discount, or a strikethrough below the price being charged,
    // would both be worse than saying nothing.
    const resolved = resolveOfferPrice(OFFER, {
      displayPrice: '$12.99',
      priceAmount: 12.99,
      currency: 'USD',
    });
    expect(resolved.discountPercent).toBeNull();
    expect(resolved.strikethroughPrice).toBeNull();
  });

  it('ignores sub-1% FX noise', () => {
    const resolved = resolveOfferPrice(OFFER, {
      displayPrice: '$9.95',
      priceAmount: 9.95,
      currency: 'USD',
    });
    expect(resolved.discountPercent).toBeNull();
  });

  it('reads the currency code under any of the adapter spellings', () => {
    for (const product of [
      { displayPrice: '$4.99', priceAmount: 4.99, currency: 'usd' },
      { displayPrice: '$4.99', priceAmount: 4.99, currencyCode: 'USD' },
      { displayPrice: '$4.99', priceAmount: 4.99, priceCurrencyCode: 'USD' },
      { displayPrice: '$4.99', price: 4.99, currency: 'USD' },
    ]) {
      expect(resolveOfferPrice(OFFER, product).discountPercent).toBe(50);
    }
  });

  it('never emits a strikethrough without a discount, or vice versa', () => {
    // The two must always agree — a strikethrough alone reads as a fake
    // "was" price, which is the specific thing Apple's guidelines forbid.
    const products = [
      null,
      { displayPrice: '$9.99' },
      { displayPrice: '$9.99', priceAmount: 9.99, currency: 'USD' },
      { displayPrice: '$4.99', priceAmount: 4.99, currency: 'USD' },
      { displayPrice: '€4,99', priceAmount: 4.99, currency: 'EUR' },
      { displayPrice: '$99.99', priceAmount: 99.99, currency: 'USD' },
    ];
    for (const product of products) {
      const r = resolveOfferPrice(OFFER, product as never);
      expect(r.discountPercent === null).toBe(r.strikethroughPrice === null);
    }
  });

  it('claims nothing when the offer has no usable regular price', () => {
    const broken = { ...OFFER, regularPriceUSD: 0 };
    const resolved = resolveOfferPrice(broken, {
      displayPrice: '$1.99',
      priceAmount: 1.99,
      currency: 'USD',
    });
    expect(resolved.discountPercent).toBeNull();
  });
});
