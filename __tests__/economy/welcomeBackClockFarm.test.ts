/**
 * The welcome-back cash bonus was farmable by scrubbing the device clock forward.
 *
 * The grant in `app/(tabs)/home.tsx` was gated purely on
 * `Date.now() - prev.lastLogin`. That refuses a REWOUND clock (the day count
 * goes to zero) and nothing else, so setting the device date +7 days, opening
 * the app and closing the popup credited `0.5 × weeklySalary × 7` — 3.5 weeks of
 * salary — with zero game weeks played, bypassing the tax brackets, the
 * net-worth soft cap and the weekly tick entirely, and compounding without
 * limit. Architecture audit 2026-08-16 C1.
 *
 * The fix is the v44 carve-out `settings.lastWelcomeBackWeek`, the same shape as
 * v28's `lastNoFillGrantWeek`, v31's `lastLoginRewardWeek`, v35's
 * `lastAdCashGrantWeek` and v40's `deepLifePlusLastGemClaimWeek`: `weeksLived`
 * only advances by playing, so it is the one clock a scrubber cannot touch.
 *
 * These pin the pure gate + grant, which is what the updater now delegates to.
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  applyWelcomeBackBonus,
  computeWelcomeBackBonus,
  welcomeBackClaimed,
} from '@/utils/welcomeBackBonus';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const WEEK = 260;

function employedState(overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived: WEEK,
    lastLogin: NOW - 7 * DAY,
    currentJob: 'test_job',
    careers: [
      {
        ...(base.careers?.[0] as NonNullable<GameState['careers']>[number]),
        id: 'test_job',
        accepted: true,
        level: 0,
        levels: [{ ...(base.careers?.[0]?.levels?.[0] as object), salary: 1000 }],
      } as NonNullable<GameState['careers']>[number],
    ],
    stats: { ...base.stats, money: 0 },
    ...overrides,
  };
}

describe('welcomeBackClaimed — the pure gate the spawner and the updater share', () => {
  it('is false for a save that has never claimed (the carve-out default)', () => {
    expect(welcomeBackClaimed({ settings: {}, weeksLived: WEEK })).toBe(false);
    expect(welcomeBackClaimed(undefined)).toBe(false);
  });

  it('is true only for the exact week already paid', () => {
    expect(
      welcomeBackClaimed({ settings: { lastWelcomeBackWeek: WEEK }, weeksLived: WEEK })
    ).toBe(true);
    expect(
      welcomeBackClaimed({ settings: { lastWelcomeBackWeek: WEEK }, weeksLived: WEEK + 1 })
    ).toBe(false);
  });

  it('treats a missing/NaN weeksLived as week 0 rather than matching undefined', () => {
    // `undefined === undefined` would otherwise report "claimed" for a save with
    // neither field, silently suppressing the bonus forever.
    expect(welcomeBackClaimed({ settings: {} })).toBe(false);
    expect(welcomeBackClaimed({ settings: { lastWelcomeBackWeek: 0 } })).toBe(true);
  });
});

describe('applyWelcomeBackBonus', () => {
  it('grants the advertised amount and stamps the week', () => {
    const prev = employedState();
    const next = applyWelcomeBackBonus(prev, NOW);
    const expected = computeWelcomeBackBonus(prev, 7);
    expect(expected).toBe(3500);
    expect(next.stats.money).toBe(expected);
    expect(next.settings?.lastWelcomeBackWeek).toBe(WEEK);
    expect(next.lastLogin).toBe(NOW);
  });

  it('refuses a second grant in the same game week — the forward-clock scrub', () => {
    const prev = employedState();
    const first = applyWelcomeBackBonus(prev, NOW);
    // The scrub: the device date jumps another 7 days, so lastLogin is stale
    // again and the day count alone would happily pay a second time.
    const scrubbed = { ...first, lastLogin: NOW - 7 * DAY };
    const second = applyWelcomeBackBonus(scrubbed, NOW);
    expect(second).toBe(scrubbed); // prev returned unchanged = rejection
    expect(second.stats.money).toBe(first.stats.money);
  });

  it('pays again once a real game week has been played', () => {
    const prev = employedState();
    const first = applyWelcomeBackBonus(prev, NOW);
    const nextWeek = { ...first, weeksLived: WEEK + 1, lastLogin: NOW - 7 * DAY };
    const second = applyWelcomeBackBonus(nextWeek, NOW);
    expect(second.stats.money).toBeGreaterThan(first.stats.money);
    expect(second.settings?.lastWelcomeBackWeek).toBe(WEEK + 1);
  });

  it('still rejects the same-batch double close (daysAway < 1)', () => {
    const prev = employedState({ lastLogin: NOW });
    expect(applyWelcomeBackBonus(prev, NOW)).toBe(prev);
  });

  it('does not mutate the previous state', () => {
    const prev = employedState();
    applyWelcomeBackBonus(prev, NOW);
    expect(prev.stats.money).toBe(0);
    expect(prev.settings?.lastWelcomeBackWeek).toBeUndefined();
  });
});

describe('the v44 field is a carve-out', () => {
  it('is absent from a fresh state, so an absent key means "never claimed"', async () => {
    const { initialGameState } = await import('@/contexts/game/initialState');
    expect('lastWelcomeBackWeek' in initialGameState.settings).toBe(false);
  });
});
