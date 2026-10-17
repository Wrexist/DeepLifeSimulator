/**
 * The year-end break: pacing rules, preload window and the once-only reward.
 * lib/ads/yearEndBreak.ts.
 */
import {
  YEAR_END_BREAK,
  applyYearEndReward,
  claimYearEndReward,
  closeYearEndOffer,
  decideYearEndBreak,
  getYearEndOffer,
  isPayingPlayer,
  openYearEndOffer,
  shouldPreloadYearEnd,
  subscribeYearEndOffer,
  __resetYearEndBreak,
  type YearEndInputs,
} from '@/lib/ads/yearEndBreak';
import { createTestGameState } from '../helpers/createTestGameState';

const NOW = 10_000_000;

/** An input set that offers; each test breaks exactly one rule. */
function ok(overrides: Partial<YearEndInputs> = {}): YearEndInputs {
  return {
    weeksLived: 52 * 10,
    weeksThisLife: 52 * 3,
    adsRemoved: false,
    isPayer: false,
    blocked: false,
    now: NOW,
    sessionStartedAt: NOW - 10 * 60_000,
    lastFullscreenAt: 0,
    lastRewardedAt: 0,
    offeredThisSession: 0,
    adReady: true,
    ...overrides,
  };
}

beforeEach(() => __resetYearEndBreak());

describe('decideYearEndBreak', () => {
  it('offers when every rule passes', () => {
    expect(decideYearEndBreak(ok())).toEqual({ offer: true });
  });

  it.each([
    ['ads_removed', { adsRemoved: true }],
    ['payer', { isPayer: true }],
    ['blocked', { blocked: true }],
    ['not_year_end', { weeksLived: 52 * 10 + 1 }],
    ['grace', { weeksThisLife: YEAR_END_BREAK.graceWeeks - 1 }],
    ['session_warmup', { sessionStartedAt: NOW - YEAR_END_BREAK.sessionWarmupMs + 1 }],
    ['min_gap', { lastFullscreenAt: NOW - YEAR_END_BREAK.minGapMs + 1 }],
    ['after_rewarded', { lastFullscreenAt: NOW - YEAR_END_BREAK.minGapMs, lastRewardedAt: NOW - YEAR_END_BREAK.afterRewardedMs + 1 }],
    ['session_cap', { offeredThisSession: YEAR_END_BREAK.maxPerSession }],
    ['not_ready', { adReady: false }],
  ] as const)('skips with %s', (reason, overrides) => {
    expect(decideYearEndBreak(ok(overrides))).toEqual({ offer: false, reason });
  });

  it('offers exactly at each boundary', () => {
    expect(decideYearEndBreak(ok({ weeksThisLife: YEAR_END_BREAK.graceWeeks })).offer).toBe(true);
    expect(decideYearEndBreak(ok({ sessionStartedAt: NOW - YEAR_END_BREAK.sessionWarmupMs })).offer).toBe(true);
    expect(decideYearEndBreak(ok({ lastFullscreenAt: NOW - YEAR_END_BREAK.minGapMs })).offer).toBe(true);
    expect(decideYearEndBreak(ok({ lastRewardedAt: NOW - YEAR_END_BREAK.afterRewardedMs })).offer).toBe(true);
    expect(decideYearEndBreak(ok({ offeredThisSession: YEAR_END_BREAK.maxPerSession - 1 })).offer).toBe(true);
  });
});

describe('isPayingPlayer', () => {
  it('reads one-time purchase flags, not ad entitlements', () => {
    const base = createTestGameState().settings;
    expect(isPayingPlayer(base)).toBe(false);
    expect(isPayingPlayer({ ...base, hasRevivalPack: true })).toBe(true);
    expect(isPayingPlayer({ ...base, moneyMultiplier: 2 } as never)).toBe(true);
    expect(isPayingPlayer({ ...base, moneyMultiplier: 1 } as never)).toBe(false);
  });
});

describe('shouldPreloadYearEnd', () => {
  it('preloads only in the weeks before an eligible boundary', () => {
    // 3 weeks before a boundary that will be week 104 of this life.
    expect(shouldPreloadYearEnd(52 * 7 - 3, 104 - 3)).toBe(true);
    // Same position, but the boundary is still inside the grace period.
    expect(shouldPreloadYearEnd(52 * 7 - 3, 52 - 3)).toBe(false);
    // Mid-year.
    expect(shouldPreloadYearEnd(52 * 7 - 26, 104 + 26)).toBe(false);
  });
});

describe('the reward', () => {
  it('pays once per boundary even when the ad reports it twice', () => {
    expect(claimYearEndReward(520)).toBe(true);
    expect(claimYearEndReward(520)).toBe(false);
    expect(claimYearEndReward(572)).toBe(true);
  });

  it('pays only while the player is still on the boundary week', () => {
    const state = createTestGameState({ weeksLived: 520, stats: { gems: 10 } });
    expect(applyYearEndReward(state, 520).stats.gems).toBe(10 + YEAR_END_BREAK.rewardGems);
    expect(applyYearEndReward(state, 468)).toBe(state);
  });
});

describe('the offer store', () => {
  it('publishes open and close to subscribers', () => {
    const seen: (number | null)[] = [];
    const unsub = subscribeYearEndOffer((o) => seen.push(o ? o.boundaryWeek : null));
    openYearEndOffer({ boundaryWeek: 520, yearNumber: 3 });
    expect(getYearEndOffer()?.yearNumber).toBe(3);
    closeYearEndOffer();
    closeYearEndOffer();
    unsub();
    expect(seen).toEqual([520, null]);
  });
});
