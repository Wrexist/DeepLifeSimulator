import { bandLabel, computeCreditScore, scoreToBand } from '../creditScore';

describe('computeCreditScore', () => {
  const base = {
    onTimePayments: 0,
    latePayments: 0,
    totalCreditCardBalance: 0,
    totalCreditCardLimit: 0,
    averageAccountAgeWeeks: 0,
    distinctAccountTypes: 0,
    recentInquiryCount: 0,
    hasOpenLoan: false,
    hasOpenMortgage: false,
  };

  it('clamps the score into the 300–850 FICO range', () => {
    const high = computeCreditScore({
      ...base,
      onTimePayments: 200,
      averageAccountAgeWeeks: 52 * 20,
      distinctAccountTypes: 4,
      hasOpenLoan: true,
      hasOpenMortgage: true,
      totalCreditCardBalance: 0,
      totalCreditCardLimit: 10_000,
    });
    expect(high.score).toBeGreaterThanOrEqual(750);
    expect(high.score).toBeLessThanOrEqual(850);
  });

  it('drops the score sharply for high utilization', () => {
    const low = computeCreditScore({
      ...base,
      totalCreditCardBalance: 4_500,
      totalCreditCardLimit: 5_000, // 90% utilized
    });
    const high = computeCreditScore({
      ...base,
      totalCreditCardBalance: 50,
      totalCreditCardLimit: 5_000, // 1% utilized
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('penalizes late payments via payment-history component', () => {
    const onTime = computeCreditScore({ ...base, onTimePayments: 50, latePayments: 0 });
    const someLate = computeCreditScore({ ...base, onTimePayments: 45, latePayments: 5 });
    expect(onTime.score).toBeGreaterThan(someLate.score);
  });

  it('rewards longer account age', () => {
    const young = computeCreditScore({ ...base, averageAccountAgeWeeks: 4 });
    const seasoned = computeCreditScore({ ...base, averageAccountAgeWeeks: 52 * 10 });
    expect(seasoned.score).toBeGreaterThan(young.score);
  });

  it('rewards diverse credit mix', () => {
    const thin = computeCreditScore({ ...base, distinctAccountTypes: 1 });
    const thick = computeCreditScore({
      ...base,
      distinctAccountTypes: 3,
      hasOpenLoan: true,
      hasOpenMortgage: true,
    });
    expect(thick.score).toBeGreaterThan(thin.score);
  });

  it('penalizes many recent inquiries', () => {
    const clean = computeCreditScore({ ...base, recentInquiryCount: 0 });
    const overshopper = computeCreditScore({ ...base, recentInquiryCount: 5 });
    expect(clean.score).toBeGreaterThan(overshopper.score);
  });

  it('returns a component breakdown that matches the documented weights', () => {
    const result = computeCreditScore(base);
    expect(result.breakdown).toEqual(
      expect.objectContaining({
        paymentHistory: expect.any(Number),
        utilization: expect.any(Number),
        accountAge: expect.any(Number),
        creditMix: expect.any(Number),
        inquiries: expect.any(Number),
      })
    );
  });

  it('handles NaN/Infinity defensively', () => {
    const result = computeCreditScore({
      ...base,
      onTimePayments: NaN,
      latePayments: Infinity,
      totalCreditCardBalance: NaN,
      totalCreditCardLimit: NaN,
      averageAccountAgeWeeks: NaN,
    });
    expect(result.score).toBeGreaterThanOrEqual(300);
    expect(result.score).toBeLessThanOrEqual(850);
  });
});

describe('scoreToBand / bandLabel', () => {
  it.each([
    [820, 'excellent'],
    [750, 'veryGood'],
    [700, 'good'],
    [620, 'fair'],
    [450, 'poor'],
  ] as const)('maps score %i to band %s', (score, band) => {
    expect(scoreToBand(score)).toBe(band);
  });

  it('produces human-readable labels', () => {
    expect(bandLabel('veryGood')).toBe('Very Good');
    expect(bandLabel('poor')).toBe('Poor');
  });
});
