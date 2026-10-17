/**
 * Creator audience growth saturates instead of compounding (2026-10-17 audit).
 *
 * Video reach is `200 + subs * 0.05` and the subscriber gain was a fixed
 * `0.5% * qMult` of views, so every upload grew a channel by a fixed share of
 * itself: ~2%/wk at elite gear on a hot game, uncapped. Channel memberships
 * (5% of subscribers, paid weekly) compounded with it - ~$42k/wk four years in
 * on this exact schedule (measured on the pre-fix formula), headed for the $75k
 * cap. Streams had the same shape through follower conversion.
 */
import { audienceSaturation, AUDIENCE_SATURATION_SCALE, projectStreamOutcome, projectVideoOutcome } from '../algorithm';
import { qualityMultiplier } from '../quality';
import { applyContentMemberships } from '@/contexts/game/actions/weekly/applyContentMemberships';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const ELITE = 100;
const UPLOADS_PER_WEEK = 5; // MAX_VIDEOS_PER_WEEK / MAX_STREAMS_PER_WEEK
/** Deterministic, evenly spread rolls (golden-ratio sequence): ~5% land viral. */
const roll = (i: number) => (i * 0.6180339887) % 1;

function videoChannelAfter(weeks: number): number[] {
  let subs = 0;
  const history: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    for (let k = 0; k < UPLOADS_PER_WEEK; k++) {
      subs += projectVideoOutcome({ quality: ELITE, subscribers: subs, rollViral: roll(w * UPLOADS_PER_WEEK + k), trendBonus: 0.5 }).subscribersGained;
    }
    history.push(subs);
  }
  return history;
}

describe('audienceSaturation', () => {
  it('is ~1 for a small channel, 1/2 at the scale, and tends to 0', () => {
    expect(audienceSaturation(0)).toBe(1);
    expect(audienceSaturation(1_000)).toBeGreaterThan(0.96);
    expect(audienceSaturation(AUDIENCE_SATURATION_SCALE)).toBeCloseTo(0.5);
    expect(audienceSaturation(1e9)).toBeLessThan(0.001);
  });

  it.each([NaN, -5, Infinity])('degrades %s safely (never NaN)', a => {
    expect(Number.isFinite(audienceSaturation(a)) || audienceSaturation(a) === 0).toBe(true);
  });
});

describe('video subscriber growth', () => {
  it('a brand-new channel converts exactly as before (0.5% x quality)', () => {
    const q = qualityMultiplier(ELITE);
    const r = projectVideoOutcome({ quality: ELITE, subscribers: 0, rollViral: 0.99 });
    expect(r.subscribersGained).toBe(Math.round(Math.round(200 * q) * 0.005 * q));
  });

  it('no longer compounds: large-channel growth tends to a constant number of subscribers a year', () => {
    const h = videoChannelAfter(520);
    /** Subscribers gained during game-year `y` of the channel (1-based). */
    const gain = (y: number) => h[y * 52 - 1] - h[(y - 1) * 52 - 1];
    // Exponential growth (the old ~2%/wk) would make each year's gain ~2.8x the
    // last. Saturated, year 4 is under 2x year 2, and years 8 -> 10 are flat.
    expect(gain(4) / gain(2)).toBeLessThan(2);
    expect(gain(10) / gain(8)).toBeLessThan(1.1);
    // Year-10 weekly growth rate, measured against the channel's size.
    expect(gain(10) / h[9 * 52 - 1] / 52).toBeLessThan(0.0035);
  });

  it('memberships four years in sit far below the $75k/wk cap', () => {
    const subs = videoChannelAfter(208)[207];
    const gs = { ...createTestGameState().gamingStreaming!, subscribers: subs, lastMemberWeek: -1 };
    const { cashDelta } = applyContentMemberships({ gamingStreaming: gs, currentWeek: 1 });
    expect(cashDelta).toBeLessThan(15_000); // was ~$42k on the same schedule
    expect(cashDelta).toBeGreaterThan(0); // the channel still earns
  });
});

describe('stream follower growth', () => {
  it('follower conversion saturates the same way (a large streamer grows linearly)', () => {
    let followers = 100_000;
    const history: number[] = [];
    for (let w = 1; w <= 104; w++) {
      for (let k = 0; k < UPLOADS_PER_WEEK; k++) {
        followers += projectStreamOutcome({ quality: ELITE, followers, duration: 120, rollHype: roll(w * 7 + k) }).newFollowers;
      }
      history.push(followers);
    }
    const year1 = history[51] - 100_000;
    const year2 = history[103] - history[51];
    expect(year2 / year1).toBeLessThan(1.1); // compounding at ~1%/wk would be ~1.7x
    expect(year1 / 100_000 / 52).toBeLessThan(0.004); // was ~1.07%/wk at 120-minute elite streams
    expect(year1).toBeGreaterThan(0);
  });

  it('a small streamer converts followers almost exactly as before', () => {
    const r = projectStreamOutcome({ quality: 40, followers: 2_000, duration: 60, rollHype: 0.99 });
    // Budget gear (qMult 1.0): the unsaturated rule was round(viewers * 0.02).
    expect(Math.abs(r.newFollowers - Math.round(r.viewers * 0.02))).toBeLessThanOrEqual(1);
  });
});
