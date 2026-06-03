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
});
