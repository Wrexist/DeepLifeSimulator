import { projectStreamOutcome, projectVideoOutcome } from '../algorithm';

describe('projectVideoOutcome', () => {
  it('produces low views with starter tier and zero subs', () => {
    const r = projectVideoOutcome({ quality: 0, subscribers: 0, rollViral: 0.99 });
    expect(r.viral).toBe(false);
    expect(r.views).toBeGreaterThanOrEqual(0);
    expect(r.views).toBeLessThan(500);
  });

  it('scales views with subscriber count and quality', () => {
    const low = projectVideoOutcome({ quality: 20, subscribers: 1000, rollViral: 0.99 });
    const high = projectVideoOutcome({ quality: 80, subscribers: 100_000, rollViral: 0.99 });
    expect(high.views).toBeGreaterThan(low.views * 10);
  });

  it('marks viral and multiplies views when rollViral is low', () => {
    const r = projectVideoOutcome({ quality: 40, subscribers: 10_000, rollViral: 0.01 });
    expect(r.viral).toBe(true);
    const normal = projectVideoOutcome({ quality: 40, subscribers: 10_000, rollViral: 0.99 });
    expect(r.views).toBeGreaterThan(normal.views * 4);
  });

  it('converts ~0.5% of views to subscribers at budget tier', () => {
    const r = projectVideoOutcome({ quality: 40, subscribers: 10_000, rollViral: 0.99 });
    expect(r.subscribersGained).toBeGreaterThan(0);
    expect(r.subscribersGained).toBeLessThan(r.views);
  });
});

describe('projectStreamOutcome', () => {
  it('produces non-negative viewers/donations', () => {
    const r = projectStreamOutcome({ quality: 0, followers: 0, duration: 30, rollHype: 0.99 });
    expect(r.viewers).toBeGreaterThanOrEqual(0);
    expect(r.donations).toBeGreaterThanOrEqual(0);
  });

  it('scales viewers with followers and quality', () => {
    const small = projectStreamOutcome({ quality: 20, followers: 500, duration: 60, rollHype: 0.99 });
    const big = projectStreamOutcome({ quality: 80, followers: 50_000, duration: 60, rollHype: 0.99 });
    expect(big.viewers).toBeGreaterThan(small.viewers * 10);
  });

  it('hype train roll multiplies donations and subs', () => {
    const hyped = projectStreamOutcome({ quality: 40, followers: 10_000, duration: 60, rollHype: 0.01 });
    const normal = projectStreamOutcome({ quality: 40, followers: 10_000, duration: 60, rollHype: 0.99 });
    expect(hyped.hypeTrain).toBe(true);
    expect(hyped.donations).toBeGreaterThan(normal.donations);
    expect(hyped.newSubs).toBeGreaterThan(normal.newSubs);
  });

  it('defaults hype chance to 8% when hypeChance is omitted (existing callers unchanged)', () => {
    // roll just under 0.08 → hype; just over → no hype.
    expect(projectStreamOutcome({ quality: 40, followers: 1000, duration: 60, rollHype: 0.079 }).hypeTrain).toBe(true);
    expect(projectStreamOutcome({ quality: 40, followers: 1000, duration: 60, rollHype: 0.081 }).hypeTrain).toBe(false);
  });

  it('a raised hypeChance makes a roll that would miss at 8% land a hype train', () => {
    const roll = 0.15; // above 0.08, below a streak-boosted 0.20
    expect(projectStreamOutcome({ quality: 40, followers: 1000, duration: 60, rollHype: roll }).hypeTrain).toBe(false);
    expect(projectStreamOutcome({ quality: 40, followers: 1000, duration: 60, rollHype: roll, hypeChance: 0.2 }).hypeTrain).toBe(true);
  });

  it('clamps hypeChance to 25% so it cannot be pushed arbitrarily high', () => {
    // A roll above the 0.25 ceiling never hypes even with a tampered hypeChance.
    expect(projectStreamOutcome({ quality: 40, followers: 1000, duration: 60, rollHype: 0.3, hypeChance: 0.99 }).hypeTrain).toBe(false);
  });
});
