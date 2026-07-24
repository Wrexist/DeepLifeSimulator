/**
 * Review-moment detection — which state transitions count as a "genuine
 * positive beat" worth spending one of the three yearly review asks on.
 *
 * Pure module: no storage, no native modules, no React.
 */

import {
  detectReviewMoment,
  detectSourMoment,
  isCalmEnoughToAsk,
  decideReviewTiming,
  BIG_WIN_MIN_ABSOLUTE,
  BIG_WIN_MIN_NET_WORTH_FRACTION,
  MIN_REVIEW_INTENSITY,
  AFTERGLOW_MS,
  QUIET_MS,
  MAX_WAIT_MS,
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
    expect(detectReviewMoment(prev, next)).toMatchObject({ trigger: 'promotion' });
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
    expect(detectReviewMoment(prev, next)).toMatchObject({ trigger: 'ambition_milestone' });
  });

  it('fires when the ambition payoff is claimed', () => {
    const prev = makeState({ ambitionRewardClaimed: false });
    const next = makeState({ ambitionRewardClaimed: true });
    expect(detectReviewMoment(prev, next)).toMatchObject({ trigger: 'ambition_milestone' });
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
    expect(detectReviewMoment(prev, next)).toMatchObject({ trigger: 'investment_win' });
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
    expect(detectReviewMoment(prev, next)).toMatchObject({ trigger: 'investment_win' });
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
    expect(detectReviewMoment(prev, next)).toMatchObject({ trigger: 'promotion' });
  });
});

describe('detectReviewMoment — intensity scoring', () => {
  const ladder = (id: string, level: number, rungs: number) => ({
    id,
    level,
    accepted: true,
    progress: 0,
    levels: Array.from({ length: rungs }, (_, i) => ({ name: `L${i}`, salary: 100 })),
  });

  it('scores a promotion higher the further up the ladder it lands', () => {
    const early = detectReviewMoment(
      makeState({ careers: [ladder('dev', 1, 6)] as never }),
      makeState({ careers: [ladder('dev', 2, 6)] as never }),
    );
    const top = detectReviewMoment(
      makeState({ careers: [ladder('dev', 4, 6)] as never }),
      makeState({ careers: [ladder('dev', 5, 6)] as never }),
    );
    expect(top!.intensity).toBeGreaterThan(early!.intensity);
    expect(top!.intensity).toBe(1);
  });

  it('scores fulfilling the whole ambition as the peak beat in the game', () => {
    const fulfilled = detectReviewMoment(
      makeState({ ambitionRewardClaimed: false }),
      makeState({ ambitionRewardClaimed: true }),
    );
    expect(fulfilled).toEqual({ trigger: 'ambition_milestone', intensity: 1 });
  });

  it('scores a bigger windfall higher than a smaller one', () => {
    const base = (money: number, gain: number) =>
      detectReviewMoment(
        makeState({ stats: { money } as never, stocks: { realizedGains: 0 } as never }),
        makeState({ stats: { money } as never, stocks: { realizedGains: gain } as never }),
      );
    const modest = base(100000, 30000); // +30%
    const lifeChanging = base(100000, 200000); // doubled and then some
    expect(lifeChanging!.intensity).toBeGreaterThan(modest!.intensity);
    expect(lifeChanging!.intensity).toBe(1);
  });

  it('keeps every peak beat above the ask threshold', () => {
    const peak = detectReviewMoment(
      makeState({ ambitionRewardClaimed: false }),
      makeState({ ambitionRewardClaimed: true }),
    );
    expect(peak!.intensity).toBeGreaterThanOrEqual(MIN_REVIEW_INTENSITY);
  });

  it('parks an unscoreable milestone below the ask threshold', () => {
    // No resolvable ambition means no path length to score against — this
    // could be the first of three milestones or the last of ten. With only
    // three asks a year, ambiguous data must not spend one.
    const moment = detectReviewMoment(
      makeState({ ambitionCompletedMilestones: [] }),
      makeState({ ambitionCompletedMilestones: ['mystery'] }),
    );
    expect(moment!.trigger).toBe('ambition_milestone');
    expect(moment!.intensity).toBeLessThan(MIN_REVIEW_INTENSITY);
  });

  it('never scores outside 0..1', () => {
    const absurd = detectReviewMoment(
      makeState({ stats: { money: 1 } as never, stocks: { realizedGains: 0 } as never }),
      makeState({ stats: { money: 1 } as never, stocks: { realizedGains: 5_000_000 } as never }),
    );
    expect(absurd!.intensity).toBeLessThanOrEqual(1);
    expect(absurd!.intensity).toBeGreaterThanOrEqual(0);
  });
});

describe('detectSourMoment', () => {
  it('flags death, bankruptcy and jail', () => {
    expect(detectSourMoment(makeState({ showDeathPopup: false }), makeState({ showDeathPopup: true }))).toBe(true);
    expect(
      detectSourMoment(makeState({ bankruptcyTriggered: false }), makeState({ bankruptcyTriggered: true })),
    ).toBe(true);
    expect(detectSourMoment(makeState({ jailWeeks: 0 }), makeState({ jailWeeks: 4 }))).toBe(true);
  });

  it('flags a health collapse', () => {
    const prev = makeState({ stats: { money: 10000, health: 90 } as never });
    const next = makeState({ stats: { money: 10000, health: 60 } as never });
    expect(detectSourMoment(prev, next)).toBe(true);
  });

  it('flags losing half your money in one step', () => {
    const prev = makeState({ stats: { money: 100000 } as never });
    const next = makeState({ stats: { money: 20000 } as never });
    expect(detectSourMoment(prev, next)).toBe(true);
  });

  it('stays quiet on an ordinary week', () => {
    const prev = makeState({ stats: { money: 10000, health: 80 } as never });
    const next = makeState({ stats: { money: 10500, health: 79 } as never, weeksLived: 101 });
    expect(detectSourMoment(prev, next)).toBe(false);
  });
});

describe('isCalmEnoughToAsk', () => {
  it('rejects a screen that already has (or is about to have) a modal', () => {
    expect(isCalmEnoughToAsk(makeState({ pendingEvents: [{ id: 'e1' }] as never }))).toBe(false);
    expect(isCalmEnoughToAsk(makeState({ showDeathPopup: true }))).toBe(false);
    expect(isCalmEnoughToAsk(makeState({ jailWeeks: 2 }))).toBe(false);
    expect(isCalmEnoughToAsk(null)).toBe(false);
  });

  it('accepts an idle screen', () => {
    expect(isCalmEnoughToAsk(makeState({ pendingEvents: [] as never }))).toBe(true);
  });
});

describe('decideReviewTiming', () => {
  const base = {
    now: 10_000,
    armedAt: 10_000,
    lastWeekChangeAt: 0,
    appActive: true,
    soured: false,
    calm: true,
  };

  it('waits while the celebration is still playing', () => {
    expect(decideReviewTiming({ ...base, now: base.armedAt + AFTERGLOW_MS - 1 })).toBe('wait');
  });

  it('asks once the afterglow has elapsed on a calm, idle screen', () => {
    expect(decideReviewTiming({ ...base, now: base.armedAt + AFTERGLOW_MS })).toBe('ask');
  });

  it('waits while the player is still ticking weeks', () => {
    const now = base.armedAt + AFTERGLOW_MS + 1000;
    expect(decideReviewTiming({ ...base, now, lastWeekChangeAt: now - (QUIET_MS - 1) })).toBe('wait');
    expect(decideReviewTiming({ ...base, now, lastWeekChangeAt: now - QUIET_MS })).toBe('ask');
  });

  it('waits while a modal is in the way', () => {
    expect(decideReviewTiming({ ...base, now: base.armedAt + AFTERGLOW_MS, calm: false })).toBe('wait');
  });

  it('abandons the moment when something sours, even mid-afterglow', () => {
    expect(decideReviewTiming({ ...base, now: base.armedAt + 100, soured: true })).toBe('abandon');
  });

  it('abandons rather than asking a backgrounded app', () => {
    // A sheet requested while backgrounded is shown to nobody and still spends
    // one of the three yearly asks.
    expect(decideReviewTiming({ ...base, now: base.armedAt + AFTERGLOW_MS, appActive: false })).toBe('abandon');
  });

  it('gives up once the glow has faded', () => {
    const now = base.armedAt + MAX_WAIT_MS + 1;
    expect(decideReviewTiming({ ...base, now, calm: false })).toBe('abandon');
  });

  it('prefers abandoning over waiting when both apply', () => {
    // A soured beat that is also mid-afterglow must stop immediately rather
    // than idle until the deadline.
    expect(decideReviewTiming({ ...base, now: base.armedAt, soured: true })).toBe('abandon');
  });
});
