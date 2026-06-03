import {
  annualizeWeeklyRate,
  calculatePeriodicPayment,
  creditScoreAPRAdjustment,
  exceedsDTI,
  splitPayment,
  totalInterestOverTerm,
} from '../amortization';

describe('calculatePeriodicPayment', () => {
  it('handles zero-rate loans as simple division', () => {
    expect(calculatePeriodicPayment(5200, 0, 52)).toBeCloseTo(100, 2);
  });

  it('matches the standard amortization formula for a 1y loan at 12% APR', () => {
    // 12% APR ÷ 52 weeks ≈ 0.2308% weekly. $1000 / 52 weeks should yield close to ~20.40/wk.
    const payment = calculatePeriodicPayment(1000, 0.12, 52);
    expect(payment).toBeGreaterThan(20);
    expect(payment).toBeLessThan(22);
  });

  it('returns 0 for non-positive principal', () => {
    expect(calculatePeriodicPayment(0, 0.05, 52)).toBe(0);
    expect(calculatePeriodicPayment(-100, 0.05, 52)).toBe(0);
  });

  it('handles NaN/Infinity defensively', () => {
    expect(calculatePeriodicPayment(NaN, 0.05, 52)).toBe(0);
    expect(calculatePeriodicPayment(1000, NaN, 52)).toBeCloseTo(1000 / 52, 2); // treats rate as 0
  });

  it('produces higher payments for shorter terms at the same APR', () => {
    const long = calculatePeriodicPayment(10_000, 0.10, 520);
    const short = calculatePeriodicPayment(10_000, 0.10, 52);
    expect(short).toBeGreaterThan(long);
  });
});

describe('totalInterestOverTerm', () => {
  it('returns 0 interest at 0% APR', () => {
    expect(totalInterestOverTerm(5000, 0, 52)).toBeCloseTo(0, 2);
  });

  it('returns positive interest for non-zero APR', () => {
    const interest = totalInterestOverTerm(10_000, 0.10, 260); // 5y, 10% APR
    expect(interest).toBeGreaterThan(0);
  });
});

describe('splitPayment', () => {
  it('splits a payment into interest + principal', () => {
    const split = splitPayment(1000, 0.52, 100); // 1% weekly interest
    expect(split.interest).toBeCloseTo(10, 2);
    expect(split.principal).toBeCloseTo(90, 2);
    expect(split.newBalance).toBeCloseTo(910, 2);
  });

  it('caps new balance at 0', () => {
    const split = splitPayment(50, 0.10, 200);
    expect(split.newBalance).toBe(0);
  });
});

describe('creditScoreAPRAdjustment', () => {
  it('rewards excellent scores with a discount', () => {
    expect(creditScoreAPRAdjustment(820)).toBeLessThan(0);
  });

  it('penalizes poor scores heavily', () => {
    expect(creditScoreAPRAdjustment(500)).toBeGreaterThanOrEqual(0.05);
  });

  it('returns the largest penalty for extremely low scores', () => {
    expect(creditScoreAPRAdjustment(350)).toBeCloseTo(0.08, 2);
  });

  it('clamps to the FICO range', () => {
    expect(creditScoreAPRAdjustment(900)).toBeLessThan(0); // treated as 850
    expect(creditScoreAPRAdjustment(200)).toBeCloseTo(0.08, 2); // treated as 300
  });
});

describe('exceedsDTI', () => {
  it('returns true when income is zero', () => {
    expect(exceedsDTI(0, 0, 100)).toBe(true);
  });

  it('allows a payment well inside the 43% cap', () => {
    expect(exceedsDTI(1000, 100, 200)).toBe(false); // 30% DTI
  });

  it('rejects a payment that pushes past the cap', () => {
    expect(exceedsDTI(1000, 200, 300)).toBe(true); // 50% DTI
  });
});

describe('annualizeWeeklyRate', () => {
  it('returns 0 for non-positive rates', () => {
    expect(annualizeWeeklyRate(0)).toBe(0);
    expect(annualizeWeeklyRate(-0.001)).toBe(0);
  });

  it('annualizes a small weekly rate correctly', () => {
    // 1% weekly compounded 52x ≈ 67.8% annual
    expect(annualizeWeeklyRate(0.01)).toBeGreaterThan(0.65);
    expect(annualizeWeeklyRate(0.01)).toBeLessThan(0.70);
  });
});
