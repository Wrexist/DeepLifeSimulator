import { meritRate, quoteScholarship } from '../scholarships';

describe('meritRate', () => {
  it('returns 0 below 3.0', () => {
    expect(meritRate(2.5)).toBe(0);
    expect(meritRate(2.99)).toBe(0);
  });
  it('grows with GPA', () => {
    expect(meritRate(3.0)).toBeGreaterThan(0);
    expect(meritRate(3.5)).toBeGreaterThan(meritRate(3.2));
    expect(meritRate(4.0)).toBeGreaterThan(meritRate(3.8));
  });
  it('caps at 80% for 4.0', () => {
    expect(meritRate(4.0)).toBe(0.80);
  });
});

describe('quoteScholarship', () => {
  it('returns nothing for 0 tuition', () => {
    const q = quoteScholarship({ bestGpa: 4, tuitionCost: 0 });
    expect(q.totalUSD).toBe(0);
    expect(q.eligibility).toBe('none');
  });

  it('partial when GPA is low and no politics aid', () => {
    const q = quoteScholarship({ bestGpa: 3.1, tuitionCost: 10_000 });
    expect(q.totalUSD).toBeGreaterThan(0);
    expect(q.totalUSD).toBeLessThan(5_000);
    expect(q.eligibility).toBe('partial');
  });

  it('half when merit + politics combine to ~50%', () => {
    const q = quoteScholarship({
      bestGpa: 3.5,
      tuitionCost: 10_000,
      politicsScholarshipUSD: 2_000,
    });
    expect(q.eligibility).toBe('half');
  });

  it('full when combined aid covers tuition', () => {
    const q = quoteScholarship({
      bestGpa: 4.0,
      tuitionCost: 10_000,
      politicsScholarshipUSD: 5_000,
    });
    expect(q.totalUSD).toBe(10_000);
    expect(q.eligibility).toBe('full');
    expect(q.netCostUSD).toBe(0);
  });

  it('caps total assistance at tuition cost', () => {
    const q = quoteScholarship({
      bestGpa: 4.0,
      tuitionCost: 1_000,
      politicsScholarshipUSD: 1_000_000,
    });
    expect(q.totalUSD).toBeLessThanOrEqual(1_000);
  });

  it('breakdown sums correctly within tuition cap', () => {
    const q = quoteScholarship({
      bestGpa: 3.6,
      tuitionCost: 10_000,
      politicsScholarshipUSD: 1_000,
      politicsCostReduction: 0.1,
    });
    expect(q.breakdown.meritUSD).toBeGreaterThan(0);
    expect(q.breakdown.politicsUSD).toBe(1_000);
    expect(q.breakdown.politicsReductionUSD).toBe(1_000);
  });
});
