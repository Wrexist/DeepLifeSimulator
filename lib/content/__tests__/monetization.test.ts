import {
  BASE_RPM,
  membershipWeeklyRevenue,
  monetizationSummary,
  streamEarnings,
  videoEarnings,
} from '../monetization';

describe('videoEarnings', () => {
  it('returns 0 for 0 views', () => {
    expect(videoEarnings(0, 40)).toBe(0);
  });
  it('scales linearly with views', () => {
    expect(videoEarnings(10_000, 40)).toBe(Math.round(10 * BASE_RPM));
  });
  it('multiplies by quality tier', () => {
    const budget = videoEarnings(10_000, 40);
    const elite = videoEarnings(10_000, 90);
    expect(elite).toBeGreaterThan(budget * 2);
  });
});

describe('streamEarnings', () => {
  it('combines viewer + duration + donation revenue', () => {
    const r = streamEarnings(1000, 60, 50, 40);
    expect(r).toBeGreaterThan(0);
    // viewer revenue 1000*0.005*1 = 5; duration 60*0.02=1.2; donations 50 → ~56
    expect(r).toBeGreaterThanOrEqual(55);
    expect(r).toBeLessThanOrEqual(60);
  });
});

describe('membershipWeeklyRevenue', () => {
  it('returns 0 with no members', () => {
    expect(membershipWeeklyRevenue(0)).toBe(0);
  });
  it('scales with member count', () => {
    expect(membershipWeeklyRevenue(100)).toBeGreaterThan(membershipWeeklyRevenue(10));
  });
  it('pays each member the given rate per week (matches the tick payout formula)', () => {
    expect(membershipWeeklyRevenue(100, 4.99)).toBe(Math.round(100 * 4.99));
  });
  it('a higher rate yields more revenue for the same members', () => {
    expect(membershipWeeklyRevenue(100, 10)).toBeGreaterThan(membershipWeeklyRevenue(100, 4.99));
  });
});

describe('monetizationSummary', () => {
  it('exposes rpm, viewerPay, and membership weekly', () => {
    const s = monetizationSummary(60, 50);
    expect(s.rpm).toBeGreaterThan(0);
    expect(s.viewerPay).toBeGreaterThan(0);
    expect(s.membershipWeekly).toBeGreaterThan(0);
  });
  it('threads the channel membership rate into the weekly figure', () => {
    const cheap = monetizationSummary(60, 50, 4.99);
    const pricey = monetizationSummary(60, 50, 20);
    expect(pricey.membershipWeekly).toBeGreaterThan(cheap.membershipWeekly);
  });
});
