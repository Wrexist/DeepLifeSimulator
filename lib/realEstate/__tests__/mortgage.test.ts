import {
  DOWN_PAYMENT_FRACTIONS,
  HIGH_DOWN_APR_DISCOUNT,
  MAX_LTV,
  mortgagePreflight,
  originateMortgage,
  PMI_APR_SURCHARGE,
  propertyEquity,
  refinanceQuote,
  TERM_OPTIONS_WEEKS,
} from '../mortgage';

describe('originateMortgage', () => {
  it('splits price by down-payment tier', () => {
    const r = originateMortgage({ purchasePrice: 500_000, tier: 'standard', term: '30y', availableCash: 1_000_000 });
    expect(r.downPaymentUSD).toBe(100_000); // 20%
    expect(r.loanPrincipal).toBe(400_000);
    expect(r.ltv).toBeCloseTo(0.8, 5);
  });

  it('cash purchase has no loan', () => {
    const r = originateMortgage({ purchasePrice: 500_000, tier: 'cash', term: '30y', availableCash: 1_000_000 });
    expect(r.loanPrincipal).toBe(0);
    expect(r.downPaymentUSD).toBe(500_000);
  });

  it('low-down-payment loans carry PMI surcharge', () => {
    const r = originateMortgage({ purchasePrice: 500_000, tier: 'low', term: '30y', availableCash: 1_000_000 });
    expect(r.aprAdjustment).toBeCloseTo(PMI_APR_SURCHARGE, 5);
  });

  it('high-down-payment loans get a rate discount', () => {
    const r = originateMortgage({ purchasePrice: 500_000, tier: 'high', term: '30y', availableCash: 1_000_000 });
    expect(r.aprAdjustment).toBeCloseTo(-HIGH_DOWN_APR_DISCOUNT, 5);
  });

  it('uses term constants', () => {
    expect(TERM_OPTIONS_WEEKS['15y']).toBe(15 * 52);
    expect(TERM_OPTIONS_WEEKS['30y']).toBe(30 * 52);
  });

  it('down-payment fractions are sane', () => {
    expect(DOWN_PAYMENT_FRACTIONS.low).toBeLessThan(DOWN_PAYMENT_FRACTIONS.standard);
    expect(DOWN_PAYMENT_FRACTIONS.high).toBeGreaterThan(DOWN_PAYMENT_FRACTIONS.standard);
  });
});

describe('mortgagePreflight', () => {
  it('rejects when cash < down payment', () => {
    const err = mortgagePreflight({ purchasePrice: 500_000, tier: 'standard', term: '30y', availableCash: 1_000 });
    expect(err).toMatch(/Need .* more for down payment/);
  });

  it('accepts when cash covers down payment', () => {
    expect(
      mortgagePreflight({ purchasePrice: 500_000, tier: 'standard', term: '30y', availableCash: 100_000 })
    ).toBeNull();
  });

  it('accepts cash purchase when cash covers full price', () => {
    expect(
      mortgagePreflight({ purchasePrice: 500_000, tier: 'cash', term: '30y', availableCash: 500_000 })
    ).toBeNull();
  });
});

describe('propertyEquity', () => {
  it('subtracts mortgage from value', () => {
    expect(propertyEquity(500_000, 300_000)).toBe(200_000);
  });

  it('floors at 0 for underwater mortgages', () => {
    expect(propertyEquity(400_000, 500_000)).toBe(0);
  });

  it('handles NaN defensively', () => {
    expect(propertyEquity(NaN, 0)).toBe(0);
  });
});

describe('refinanceQuote', () => {
  const loan: any = {
    rateAPR: 0.07,
    remaining: 400_000,
    weeksRemaining: 25 * 52,
  };

  it('returns null when no rate improvement', () => {
    expect(refinanceQuote(500_000, loan, 0.08)).toBeNull();
  });

  it('returns null with zero remaining principal', () => {
    expect(refinanceQuote(500_000, { ...loan, remaining: 0 }, 0.05)).toBeNull();
  });

  it('quotes positive savings for a lower rate', () => {
    const q = refinanceQuote(500_000, loan, 0.05);
    expect(q).not.toBeNull();
    expect(q!.canRefinance).toBe(true);
    expect(q!.estimatedSavings).toBeGreaterThan(0);
  });
});

describe('MAX_LTV constant', () => {
  it('is sub-100% (lenders never finance the whole thing)', () => {
    expect(MAX_LTV).toBeLessThanOrEqual(1);
    expect(MAX_LTV).toBeGreaterThanOrEqual(0.85);
  });
});
