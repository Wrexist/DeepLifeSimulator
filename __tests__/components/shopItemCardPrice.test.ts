/**
 * The price appears ONCE per card.
 *
 * Every real-money card rendered "$19.99" on the left and "BUY · $19.99" on the
 * button — the same number twice, a few centimetres apart, on every card in the
 * shop. Reported by the owner with device screenshots.
 *
 * The predicate keys off the BUTTON TEXT rather than off `priceKind`, and the
 * gem cases below are why. A gem-priced upgrade labels its button "Redeem" or
 * "Not enough gems" and never states the cost, so for those the standalone
 * label is the only place the price is visible; suppressing it there would hide
 * what an upgrade charges, which is a worse bug than the duplication.
 */
import { ctaStatesPrice } from '@/components/shop/ShopItemCard';

describe('ctaStatesPrice', () => {
  it('is true when the button already carries the money price', () => {
    expect(ctaStatesPrice('$9.99', 'Buy · $9.99')).toBe(true);
    expect(ctaStatesPrice('$19.99', 'BUY · $19.99')).toBe(true);
  });

  it('is FALSE for a gem upgrade, whose button never states the cost', () => {
    expect(ctaStatesPrice('1,500', 'Redeem')).toBe(false);
    expect(ctaStatesPrice('1,500', 'Not enough gems')).toBe(false);
    expect(ctaStatesPrice('1,500', 'Owned')).toBe(false);
  });

  it('is false for the non-price button states of a money card', () => {
    // Owned / Unavailable / Processing all drop the number, so the standalone
    // label has to come back or the card shows no price at all.
    for (const label of ['Owned', 'Unavailable', 'Processing…']) {
      expect(ctaStatesPrice('$9.99', label)).toBe(false);
    }
  });

  it('is false for an empty price label', () => {
    // `''.includes('')` is true for every string. Without the length guard a
    // card with no resolved price would take the suppressed path for no reason.
    expect(ctaStatesPrice('', 'Unavailable')).toBe(false);
    expect(ctaStatesPrice('', 'Buy')).toBe(false);
  });

  it('does not match a different price that merely looks similar', () => {
    // "$1.99" is not a substring of "Buy · $11.99" — the guard must not fire on
    // a near-miss and hide a price the button is not actually showing.
    expect(ctaStatesPrice('$1.99', 'Buy · $11.99')).toBe(false);
  });
});
