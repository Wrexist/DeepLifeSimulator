/**
 * Regression (M-2): gaming/streaming income must decay by REAL elapsed weeks
 * (currentWeek - uploadedAt), not by array position. The old position-based
 * decay let a player sustain income near the cap forever by spamming fresh
 * uploads to keep refilling the top array slots.
 */
import { calcGamingStreamingIncome } from '../gamingStreamingIncome';
import { GamingStreamingState } from '@/contexts/game/types';

const video = (views: number, uploadedAt: number, timestamp: number) =>
  ({ id: `v${timestamp}`, title: 't', views, uploadedAt, timestamp } as never);

describe('content income decays by elapsed weeks, not array index', () => {
  it('a 25-week-old video earns ~0 even when it is first in the array', () => {
    const state = { videos: [video(100000, 0, 9999)] } as unknown as GamingStreamingState;
    // currentWeek 25 → age 25 → decayFactor 0. Index 0 would previously pay full.
    expect(calcGamingStreamingIncome(state, 25).gaming).toBe(0);
  });

  it("spamming fresh uploads does NOT keep an old video's income alive", () => {
    // One old video (age 25 → 0) plus 30 brand-new ones. With index-based decay
    // the old video could sit at a low index and keep paying; with week-based
    // decay it stays at 0 no matter where it sorts.
    const fresh = Array.from({ length: 30 }, (_, i) => video(1000, 30, 1000 + i));
    const withOld = { videos: [...fresh, video(100000, 5, 1)] } as unknown as GamingStreamingState;
    const withoutOld = { videos: fresh } as unknown as GamingStreamingState;
    // Old video (age 25) contributes nothing → totals match.
    expect(calcGamingStreamingIncome(withOld, 30).gaming).toBeCloseTo(
      calcGamingStreamingIncome(withoutOld, 30).gaming,
      5
    );
  });

  it('a brand-new video earns full income', () => {
    const state = { videos: [video(100000, 30, 1)] } as unknown as GamingStreamingState;
    expect(calcGamingStreamingIncome(state, 30).gaming).toBeGreaterThan(0);
  });
});
