import { organicMultiplier, projectStreamOutcome, projectVideoOutcome } from '../algorithm';

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

  it('omitting rollOrganic is neutral: identical to the pre-variance result', () => {
    // rollOrganic defaults to a 1.0× multiplier, so an omitted roll reproduces
    // the exact deterministic number callers/tests relied on before.
    const omitted = projectVideoOutcome({ quality: 40, subscribers: 10_000, rollViral: 0.99 });
    // 200 + 10000*0.05 = 700 base, budget qMult 1.0, no viral → 700 views.
    expect(omitted.views).toBe(700);
  });

  it('rollOrganic spreads views: flop < neutral < pop for the same inputs', () => {
    const base = { quality: 40, subscribers: 10_000, rollViral: 0.99 } as const;
    const flop = projectVideoOutcome({ ...base, rollOrganic: 0.02 }).views; // deep flop band
    const neutral = projectVideoOutcome({ ...base }).views; // omitted → 1.0×
    const pop = projectVideoOutcome({ ...base, rollOrganic: 0.98 }).views; // pop band
    expect(flop).toBeLessThan(neutral);
    expect(pop).toBeGreaterThan(neutral);
    // Bounded to the believable band (never below ~0.4×, never above ~2.2×).
    expect(flop).toBeGreaterThanOrEqual(Math.round(neutral * 0.4) - 1);
    expect(pop).toBeLessThanOrEqual(Math.round(neutral * 2.2) + 1);
  });
});

describe('organicMultiplier', () => {
  it('is centred near 1.0 and bounded to ~0.4×–2.2×', () => {
    for (let r = 0; r < 1; r += 0.01) {
      const m = organicMultiplier(r);
      expect(m).toBeGreaterThanOrEqual(0.4);
      expect(m).toBeLessThanOrEqual(2.2);
    }
    // Monotonic increasing across the roll.
    expect(organicMultiplier(0.05)).toBeLessThan(organicMultiplier(0.5));
    expect(organicMultiplier(0.5)).toBeLessThan(organicMultiplier(0.95));
    // Median-ish roll lands close to 1.0.
    expect(organicMultiplier(0.5)).toBeGreaterThan(0.9);
    expect(organicMultiplier(0.5)).toBeLessThan(1.2);
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

  it('omitting rollOrganic is neutral: viewers match the pre-variance result', () => {
    const omitted = projectStreamOutcome({ quality: 20, followers: 1000, duration: 60, rollHype: 0.99 });
    // (5 + 1000*0.015) * budget-ish... quality 20 → starter (0.5×): (5+15)*0.5 = 10.
    expect(omitted.viewers).toBe(10);
  });

  it('rollOrganic spreads viewers: flop < neutral < pop', () => {
    const base = { quality: 40, followers: 50_000, duration: 60, rollHype: 0.99 } as const;
    const flop = projectStreamOutcome({ ...base, rollOrganic: 0.02 }).viewers;
    const neutral = projectStreamOutcome({ ...base }).viewers;
    const pop = projectStreamOutcome({ ...base, rollOrganic: 0.98 }).viewers;
    expect(flop).toBeLessThan(neutral);
    expect(pop).toBeGreaterThan(neutral);
  });

  it('viewersOverride pins concurrent viewers and drives all conversions', () => {
    // A LIVE session supplies the accrued viewer count; followers/subs/donations
    // scale off it, ignoring the follower-derived estimate.
    const r = projectStreamOutcome({ quality: 40, followers: 0, duration: 30, rollHype: 0.99, viewersOverride: 500 });
    expect(r.viewers).toBe(500);
    expect(r.newFollowers).toBeGreaterThan(0);
    expect(r.donations).toBeGreaterThan(0);
  });
});
