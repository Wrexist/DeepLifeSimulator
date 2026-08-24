/**
 * Paywall price + offer honesty.
 *
 * The invariant under test is the same one the module documents: the paywall
 * shows what the STORE reports for this player's storefront, or it shows
 * nothing. Every case where a number cannot be proven must degrade to an empty
 * string / 0 / null, never to a guess and never to the config USD price.
 */
import {
  resolvePlanPrice,
  reformatPriceAmount,
  perWeekPrice,
  yearlySavingsPercent,
  storeFreeTrialDays,
  resolveTrialClaim,
  type StoreProductLike,
} from '@/lib/subscription/planPricing';

const YEARLY = 'deeplife_premium_yearly';
const MONTHLY = 'deeplife_premium_monthly';

/** A store product the way the expo-iap adapter normalises it. */
const product = (over: Partial<StoreProductLike>): StoreProductLike => ({
  productId: YEARLY,
  displayPrice: '$49.99',
  priceAmount: 49.99,
  currency: 'USD',
  ...over,
});

describe('resolvePlanPrice', () => {
  it('renders the store display price verbatim', () => {
    const p = resolvePlanPrice(YEARLY, product({ displayPrice: '54,99 €', currency: 'EUR', priceAmount: 54.99 }));
    expect(p.displayPrice).toBe('54,99 €');
    expect(p.currency).toBe('EUR');
    expect(p.amount).toBe(54.99);
    expect(p.fromStore).toBe(true);
  });

  it('returns an EMPTY price when the product did not load - never a fallback', () => {
    const p = resolvePlanPrice(YEARLY, null);
    expect(p.displayPrice).toBe('');
    expect(p.fromStore).toBe(false);
    expect(p.amount).toBeNull();
  });

  it('keeps the display price when the SDK exposed no numeric amount', () => {
    const p = resolvePlanPrice(YEARLY, { displayPrice: '¥7,800' });
    expect(p.displayPrice).toBe('¥7,800');
    expect(p.fromStore).toBe(true);
    // No amount/currency → downstream derivations must stay silent.
    expect(p.amount).toBeNull();
    expect(p.currency).toBeNull();
  });

  it('refuses a bare number as a price string (no currency = ambiguous)', () => {
    const p = resolvePlanPrice(YEARLY, { price: 49.99, currency: 'USD' });
    expect(p.displayPrice).toBe('');
    expect(p.fromStore).toBe(false);
  });

  it('reads localizedPrice and priceCurrencyCode from other SDK shapes', () => {
    const p = resolvePlanPrice(YEARLY, { localizedPrice: '£39.99', price: 39.99, priceCurrencyCode: 'gbp' });
    expect(p.displayPrice).toBe('£39.99');
    expect(p.amount).toBe(39.99);
    expect(p.currency).toBe('GBP'); // upper-cased for comparison
  });
});

describe('reformatPriceAmount - keeps the storefront\'s own formatting', () => {
  it.each([
    // [store string, new amount, expected]
    ['$49.99', 0.9613, '$0.97'],
    ['54,99 €', 1.0575, '1,06 €'],
    ['¥7,800', 150.0, '¥150'],
    ['R$ 249,90', 4.8058, 'R$ 4,81'],
    ['£39.99', 0.769, '£0.77'],
    ['SEK 499.00', 9.596, 'SEK 9.60'],
  ])('%s → %s', (display, amount, expected) => {
    expect(reformatPriceAmount(display, amount)).toBe(expected);
  });

  it('regroups thousands using the source separator', () => {
    expect(reformatPriceAmount('¥120,000', 12345)).toBe('¥12,345');
  });

  it('does not float-error an exact value up a unit', () => {
    // 0.96 * 100 === 95.99999999999999 in IEEE-754; a naive ceil yields 0.97.
    expect(reformatPriceAmount('$1.00', 0.96)).toBe('$0.96');
  });

  it('rounds UP so a derived price is never advertised below the real one', () => {
    expect(reformatPriceAmount('$1.00', 0.961)).toBe('$0.97');
  });

  it('returns empty when no numeric run can be located', () => {
    expect(reformatPriceAmount('Free', 1)).toBe('');
    expect(reformatPriceAmount('', 1)).toBe('');
  });
});

describe('perWeekPrice', () => {
  it('divides the yearly price by 52 in the storefront currency', () => {
    const yearly = resolvePlanPrice(YEARLY, product({}));
    expect(perWeekPrice(yearly)).toBe('$0.97'); // 49.99 / 52 = 0.9613 → ceil
  });

  it('is SILENT when the store gave no numeric amount', () => {
    const yearly = resolvePlanPrice(YEARLY, { displayPrice: '¥7,800' });
    expect(perWeekPrice(yearly)).toBe('');
  });

  it('is SILENT when the product did not load', () => {
    expect(perWeekPrice(resolvePlanPrice(YEARLY, null))).toBe('');
  });
});

describe('yearlySavingsPercent - only a provable saving earns a badge', () => {
  const monthlyUSD = resolvePlanPrice(MONTHLY, { displayPrice: '$4.99', priceAmount: 4.99, currency: 'USD' });

  it('computes the real saving when both plans are numeric and same-currency', () => {
    const yearly = resolvePlanPrice(YEARLY, product({}));
    // 4.99*12 = 59.88 vs 49.99 → 16.51% → floored to 16.
    expect(yearlySavingsPercent(monthlyUSD, yearly)).toBe(16);
  });

  it('FLOORS rather than rounds, so the claim never overstates', () => {
    const monthly = resolvePlanPrice(MONTHLY, { displayPrice: '$5.00', priceAmount: 5, currency: 'USD' });
    const yearly = resolvePlanPrice(YEARLY, { displayPrice: '$50.00', priceAmount: 50, currency: 'USD' });
    // 60 vs 50 → 16.67% → 16, not 17.
    expect(yearlySavingsPercent(monthly, yearly)).toBe(16);
  });

  it('refuses a CROSS-CURRENCY comparison - no exchange rate exists here', () => {
    const yearlyEUR = resolvePlanPrice(YEARLY, { displayPrice: '54,99 €', priceAmount: 54.99, currency: 'EUR' });
    expect(yearlySavingsPercent(monthlyUSD, yearlyEUR)).toBe(0);
  });

  it('claims nothing when either plan has no numeric amount', () => {
    const yearlyNoAmount = resolvePlanPrice(YEARLY, { displayPrice: '¥7,800' });
    expect(yearlySavingsPercent(monthlyUSD, yearlyNoAmount)).toBe(0);
  });

  it('claims nothing when the yearly plan is not actually cheaper', () => {
    const yearly = resolvePlanPrice(YEARLY, { displayPrice: '$99.99', priceAmount: 99.99, currency: 'USD' });
    expect(yearlySavingsPercent(monthlyUSD, yearly)).toBe(0);
  });

  it('treats a sub-1% gap as tier noise, not a saving', () => {
    const monthly = resolvePlanPrice(MONTHLY, { displayPrice: '$5.00', priceAmount: 5, currency: 'USD' });
    const yearly = resolvePlanPrice(YEARLY, { displayPrice: '$59.95', priceAmount: 59.95, currency: 'USD' });
    expect(yearlySavingsPercent(monthly, yearly)).toBe(0);
  });
});

describe('storeFreeTrialDays - null (unknown) vs 0 (no offer)', () => {
  it('reads the current iOS shape', () => {
    expect(
      storeFreeTrialDays({
        subscriptionInfoIOS: {
          introductoryOffer: { paymentMode: 'free-trial', periodCount: 1, period: { unit: 'week', value: 1 } },
        },
      }),
    ).toBe(7);
  });

  it('reads the legacy flat iOS fields', () => {
    expect(
      storeFreeTrialDays({
        introductoryPricePaymentModeIOS: 'free-trial',
        introductoryPriceSubscriptionPeriodIOS: 'day',
        introductoryPriceNumberOfPeriodsIOS: '3',
      }),
    ).toBe(3);
  });

  it('returns 0 - NOT null - when iOS reports a paid intro offer', () => {
    // A pay-up-front intro is still an offer, but it is not a FREE trial, so no
    // trial copy may be shown even though the configured constant says 7.
    expect(
      storeFreeTrialDays({
        introductoryPricePaymentModeIOS: 'pay-up-front',
        introductoryPriceSubscriptionPeriodIOS: 'month',
        introductoryPriceNumberOfPeriodsIOS: '1',
      }),
    ).toBe(0);
  });

  it('reads an Android zero-cost pricing phase', () => {
    expect(
      storeFreeTrialDays({
        subscriptionOfferDetailsAndroid: [
          {
            pricingPhases: {
              pricingPhaseList: [
                { priceAmountMicros: '0', billingPeriod: 'P1W', billingCycleCount: 1 },
                { priceAmountMicros: '49990000', billingPeriod: 'P1Y', billingCycleCount: 0 },
              ],
            },
          },
        ],
      }),
    ).toBe(7);
  });

  it('returns 0 when Android offers exist and none of them is free', () => {
    expect(
      storeFreeTrialDays({
        subscriptionOfferDetailsAndroid: [
          {
            pricingPhases: {
              pricingPhaseList: [{ priceAmountMicros: '49990000', billingPeriod: 'P1Y', billingCycleCount: 0 }],
            },
          },
        ],
      }),
    ).toBe(0);
  });

  it('returns null (unknown) when nothing loaded or the SDK said nothing', () => {
    expect(storeFreeTrialDays(null)).toBeNull();
    expect(storeFreeTrialDays({ displayPrice: '$49.99' })).toBeNull();
    expect(storeFreeTrialDays({ introductoryPricePaymentModeIOS: 'empty' })).toBeNull();
  });
});

describe('resolveTrialClaim - what the paywall is allowed to SAY', () => {
  const CONFIGURED = 7;

  it('promises $0.00 only when the store confirms BOTH the offer and this player', () => {
    expect(
      resolveTrialClaim({ eligibility: 'eligible', storeTrialDays: 7, configuredTrialDays: CONFIGURED }),
    ).toEqual({ claim: 'promise', days: 7 });
  });

  it('downgrades to CONDITIONAL copy when per-user eligibility is unknown', () => {
    // Android exposes no per-user answer, and an RC-disabled build returns the
    // same 'unknown'. This is the case that used to render "Start for $0.00
    // Today" to a player the store was about to charge in full.
    expect(
      resolveTrialClaim({ eligibility: 'unknown', storeTrialDays: 7, configuredTrialDays: CONFIGURED }),
    ).toEqual({ claim: 'conditional', days: 7 });
  });

  it('says NOTHING when the store reports this player ineligible', () => {
    expect(
      resolveTrialClaim({ eligibility: 'ineligible', storeTrialDays: 7, configuredTrialDays: CONFIGURED }),
    ).toEqual({ claim: 'none', days: 0 });
  });

  it('says NOTHING when the product carries no free-trial offer, even if eligible', () => {
    // The configured constant is hand-maintained; the store is authoritative.
    expect(
      resolveTrialClaim({ eligibility: 'eligible', storeTrialDays: 0, configuredTrialDays: CONFIGURED }),
    ).toEqual({ claim: 'none', days: 0 });
  });

  it('prefers the STORE trial length over the configured constant', () => {
    expect(
      resolveTrialClaim({ eligibility: 'eligible', storeTrialDays: 14, configuredTrialDays: CONFIGURED }),
    ).toEqual({ claim: 'promise', days: 14 });
  });

  it('falls back to the constant when the store length is unknown', () => {
    expect(
      resolveTrialClaim({ eligibility: 'unknown', storeTrialDays: null, configuredTrialDays: CONFIGURED }),
    ).toEqual({ claim: 'conditional', days: 7 });
  });

  it('honours the kill switch: configured 0 silences every trial claim', () => {
    expect(
      resolveTrialClaim({ eligibility: 'eligible', storeTrialDays: 7, configuredTrialDays: 0 }),
    ).toEqual({ claim: 'none', days: 0 });
  });
});
