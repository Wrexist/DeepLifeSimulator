/**
 * Review-moment detection — which state transitions count as a "genuine
 * positive beat" worth spending one of the three yearly review asks on.
 *
 * Pure module: no storage, no native modules, no React.
 */

import {
  detectReviewMoment,
  BIG_WIN_MIN_ABSOLUTE,
  BIG_WIN_MIN_NET_WORTH_FRACTION,
} from '../reviewMoments';
import type { GameState } from '@/contexts/game/types';

// The detector reads a handful of fields, each null-safely, so a partial object
// cast to GameState is sufficient (same approach as the ambitions tests).
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    weeksLived: 100,
    stats: { money: 10000 },
    careers: [],
    ...overrides,
  } as unknown as GameState;
}

const career = (id: string, level: number, accepted = true) => ({
  id,
  level,
  accepted,
  progress: 0,
  levels: [],
});

describe('detectReviewMoment — promotion', () => {
  it('fires when an accepted career climbs a level', () => {
    const prev = makeState({ careers: [career('dev', 2)] as never });
    const next = makeState({ careers: [career('dev', 3)] as never });
    expect(detectReviewMoment(prev, next)).toBe('promotion');
  });

  it('does not fire when a career appears for the first time (that is a hire)', () => {
    const prev = makeState({ careers: [] as never });
    const next = makeState({ careers: [career('dev', 1)] as never });
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('does not fire on progress that has not yet become a level', () => {
    const prev = makeState({ careers: [{ ...career('dev', 2), progress: 10 }] as never });
    const next = makeState({ careers: [{ ...career('dev', 2), progress: 95 }] as never });
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('ignores level changes on careers the player never accepted', () => {
    const prev = makeState({ careers: [career('dev', 2, false)] as never });
    const next = makeState({ careers: [career('dev', 5, false)] as never });
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('does not fire when a career level goes DOWN', () => {
    const prev = makeState({ careers: [career('dev', 4)] as never });
    const next = makeState({ careers: [career('dev', 2)] as never });
    expect(detectReviewMoment(prev, next)).toBeNull();
  });
});

describe('detectReviewMoment — ambition milestones', () => {
  it('fires when a milestone becomes sticky', () => {
    const prev = makeState({ ambitionCompletedMilestones: ['m1'] });
    const next = makeState({ ambitionCompletedMilestones: ['m1', 'm2'] });
    expect(detectReviewMoment(prev, next)).toBe('ambition_milestone');
  });

  it('fires when the ambition payoff is claimed', () => {
    const prev = makeState({ ambitionRewardClaimed: false });
    const next = makeState({ ambitionRewardClaimed: true });
    expect(detectReviewMoment(prev, next)).toBe('ambition_milestone');
  });

  it('does not fire when the milestone set is unchanged', () => {
    const prev = makeState({ ambitionCompletedMilestones: ['m1', 'm2'] });
    const next = makeState({ ambitionCompletedMilestones: ['m1', 'm2'] });
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('does not fire for a life with no ambition chosen', () => {
    expect(detectReviewMoment(makeState(), makeState())).toBeNull();
  });
});

describe('detectReviewMoment — investment wins', () => {
  const withGains = (money: number, stocks: number, crypto = 0) =>
    makeState({
      stats: { money } as never,
      stocks: { realizedGains: stocks } as never,
      cryptoMarket: { totalRealizedGains: crypto } as never,
    });

  it('fires on a gain that is large in both absolute and relative terms', () => {
    const prev = withGains(20000, 0);
    const next = withGains(20000, 40000);
    expect(detectReviewMoment(prev, next)).toBe('investment_win');
  });

  it('ignores a gain below the absolute floor even when the player is broke', () => {
    const prev = withGains(10, 0);
    const next = withGains(10, BIG_WIN_MIN_ABSOLUTE - 1);
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('ignores a gain that is pocket change relative to the player net worth', () => {
    // Clears the absolute floor, but is trivial next to $10m in the bank.
    const money = 10_000_000;
    const gain = BIG_WIN_MIN_ABSOLUTE * 2;
    expect(gain).toBeLessThan(money * BIG_WIN_MIN_NET_WORTH_FRACTION);
    const prev = withGains(money, 0);
    const next = withGains(money, gain);
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('counts crypto gains alongside stock gains', () => {
    const prev = withGains(20000, 0, 0);
    const next = withGains(20000, 0, 40000);
    expect(detectReviewMoment(prev, next)).toBe('investment_win');
  });

  it('does not fire on a realised LOSS', () => {
    const prev = withGains(20000, 50000);
    const next = withGains(20000, 10000);
    expect(detectReviewMoment(prev, next)).toBeNull();
  });

  it('reads lifetime crypto gains, not the yearly bucket that resets', () => {
    // realizedGainsThisYear is debited to 0 at each game-year boundary. If the
    // detector read that field, the week after a reset would look like a
    // massive fresh win. Only totalRealizedGains (monotonic) must matter.
    const prev = makeState({
      stats: { money: 20000 } as never,
      cryptoMarket: { totalRealizedGains: 100000, realizedGainsThisYear: 0 } as never,
    });
    const next = makeState({
      stats: { money: 20000 } as never,
      cryptoMarket: { totalRealizedGains: 100000, realizedGainsThisYear: 90000 } as never,
    });
    expect(detectReviewMoment(prev, next)).toBeNull();
  });
});

describe('detectReviewMoment — safety', () => {
  it('returns null when either snapshot is missing', () => {
    expect(detectReviewMoment(null, makeState())).toBeNull();
    expect(detectReviewMoment(makeState(), null)).toBeNull();
    expect(detectReviewMoment(undefined, undefined)).toBeNull();
  });

  it('tolerates malformed slices without throwing', () => {
    const junk = {
      careers: 'not-an-array',
      stocks: { realizedGains: NaN },
      ambitionCompletedMilestones: null,
    } as unknown as GameState;
    expect(() => detectReviewMoment(junk, junk)).not.toThrow();
    expect(detectReviewMoment(junk, junk)).toBeNull();
  });

  it('prefers the promotion when several beats land in one tick', () => {
    const prev = makeState({
      careers: [career('dev', 1)] as never,
      ambitionCompletedMilestones: [],
    });
    const next = makeState({
      careers: [career('dev', 2)] as never,
      ambitionCompletedMilestones: ['m1'],
    });
    expect(detectReviewMoment(prev, next)).toBe('promotion');
  });
});
