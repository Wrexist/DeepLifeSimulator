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
});

describe('monetizationSummary', () => {
  it('exposes rpm, viewerPay, and membership weekly', () => {
    const s = monetizationSummary(60, 50);
    expect(s.rpm).toBeGreaterThan(0);
    expect(s.viewerPay).toBeGreaterThan(0);
    expect(s.membershipWeekly).toBeGreaterThan(0);
  });
});
