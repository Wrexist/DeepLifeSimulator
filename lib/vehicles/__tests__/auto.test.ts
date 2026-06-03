import {
  AUTO_DOWN_FRACTIONS,
  AUTO_HIGH_DOWN_DISCOUNT,
  AUTO_PMI_SURCHARGE,
  AUTO_TERM_WEEKS,
  autoPreflight,
  maxLTVFor,
  originateAuto,
} from '../auto';

describe('originateAuto', () => {
  it('splits price by down-payment tier', () => {
    const r = originateAuto({
      price: 30_000,
      tier: 'standard',
      term: '5y',
      availableCash: 100_000,
      vehicleYear: 2025,
      currentYear: 2025,
    });
    expect(r.downPaymentUSD).toBe(6_000);
    expect(r.loanPrincipal).toBe(24_000);
    expect(r.ltv).toBeCloseTo(0.8, 5);
  });

  it('cash purchase has no loan', () => {
    const r = originateAuto({
      price: 20_000,
      tier: 'cash',
      term: '3y',
      availableCash: 100_000,
      vehicleYear: 2025,
      currentYear: 2025,
    });
    expect(r.loanPrincipal).toBe(0);
    expect(r.downPaymentUSD).toBe(20_000);
  });

  it('low-tier carries PMI surcharge', () => {
    const r = originateAuto({
      price: 20_000,
      tier: 'low',
      term: '5y',
      availableCash: 100_000,
      vehicleYear: 2025,
      currentYear: 2025,
    });
    expect(r.aprAdjustment).toBeCloseTo(AUTO_PMI_SURCHARGE, 5);
  });

  it('high-tier carries APR discount', () => {
    const r = originateAuto({
      price: 20_000,
      tier: 'high',
      term: '5y',
      availableCash: 100_000,
      vehicleYear: 2025,
      currentYear: 2025,
    });
    expect(r.aprAdjustment).toBeCloseTo(-AUTO_HIGH_DOWN_DISCOUNT, 5);
  });

  it('term constants are correct', () => {
    expect(AUTO_TERM_WEEKS['3y']).toBe(156);
    expect(AUTO_TERM_WEEKS['5y']).toBe(260);
    expect(AUTO_TERM_WEEKS['7y']).toBe(364);
  });

  it('down fractions sane', () => {
    expect(AUTO_DOWN_FRACTIONS.low).toBeLessThan(AUTO_DOWN_FRACTIONS.standard);
    expect(AUTO_DOWN_FRACTIONS.high).toBeGreaterThan(AUTO_DOWN_FRACTIONS.standard);
  });
});

describe('maxLTVFor', () => {
  it.each([
    [2024, 2025, 0.95],
    [2020, 2025, 0.90],
    [2017, 2025, 0.80],
    [2010, 2025, 0.65],
  ] as const)('year %i in %i → %f LTV cap', (vYear, cYear, expected) => {
    expect(maxLTVFor(vYear, cYear)).toBe(expected);
  });
});

describe('autoPreflight', () => {
  it('rejects when cash is below down payment', () => {
    const err = autoPreflight({
      price: 20_000,
      tier: 'standard',
      term: '5y',
      availableCash: 100,
      vehicleYear: 2025,
      currentYear: 2025,
    });
    expect(err).toMatch(/Need .* more for down payment/);
  });

  it('rejects when LTV exceeds the ceiling on an old car', () => {
    const err = autoPreflight({
      price: 20_000,
      tier: 'low',         // 10% down → 90% LTV
      term: '5y',
      availableCash: 100_000,
      vehicleYear: 2014,   // 11 years old → 65% cap
      currentYear: 2025,
    });
    expect(err).toMatch(/Loan-to-value exceeds/);
  });

  it('accepts when cash + LTV are within limits', () => {
    expect(
      autoPreflight({
        price: 20_000,
        tier: 'standard',
        term: '5y',
        availableCash: 100_000,
        vehicleYear: 2025,
        currentYear: 2025,
      })
    ).toBeNull();
  });
});
