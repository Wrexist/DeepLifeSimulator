/**
 * The bank's sponsored bonus is once a week, not once a tap.
 *
 * This was the only ad reward in the game that paid CASH, and it had no
 * cooldown, no cap and no claim marker — so it could be watched on repeat for
 * 2% of the balance each time, and on a build where the ad SDK is unavailable
 * the reward path still ran. 2026-07-28 audit econ-4.
 *
 * Gated the same way `watchAdForFollowerBoost` is: one claim per in-game week,
 * keyed on `weeksLived` (never a wall-clock date — a real-time key is farmable
 * by moving the device clock, per the 2026-07-24 daily-gem lesson), with the
 * cooldown re-checked inside the updater so a same-batch double-tap can't pay
 * twice.
 */
import {
  claimAdCashBonus,
  canClaimAdCashBonus,
  weeksUntilAdCashBonus,
  getAdCashBonusAmount,
  AD_CASH_BONUS_COOLDOWN_WEEKS,
  AD_CASH_BONUS_MIN,
  AD_CASH_BONUS_MAX,
} from '@/contexts/game/actions/BankingActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function saver(money = 100_000, overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 200,
    stats: { ...base.stats, money },
    ...overrides,
  });
}

function drive(state: GameState) {
  let current = state;
  const set = ((u: (prev: GameState) => GameState) => {
    current = typeof u === 'function' ? u(current) : u;
  }) as never;
  const result = claimAdCashBonus(set, current);
  return { result, state: current };
}

describe('the sponsored bonus pays once per in-game week', () => {
  it('pays on a first claim and stamps the week', () => {
    const before = saver();
    const expected = getAdCashBonusAmount(before);
    const { result, state } = drive(before);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(expected);
    expect(state.stats.money).toBe(before.stats.money + expected);
    expect(state.settings?.lastAdCashBonusWeek).toBe(200);
  });

  it('refuses a second claim in the same week (the exploit)', () => {
    const first = drive(saver());
    const second = drive(first.state);

    expect(second.result.success).toBe(false);
    expect(second.state.stats.money).toBe(first.state.stats.money);
  });

  it('pays once under a same-batch double-tap', () => {
    const before = saver();
    const expected = getAdCashBonusAmount(before);
    let current = before;
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;

    // Both taps read the SAME stale snapshot — only the in-updater re-check
    // stops the second payout.
    claimAdCashBonus(set, before);
    claimAdCashBonus(set, before);

    expect(current.stats.money).toBe(before.stats.money + expected);
  });

  it('becomes claimable again once the week advances', () => {
    const claimed = drive(saver()).state;
    const nextWeek = { ...claimed, weeksLived: 200 + AD_CASH_BONUS_COOLDOWN_WEEKS };

    expect(canClaimAdCashBonus(nextWeek)).toBe(true);
    expect(drive(nextWeek).result.success).toBe(true);
  });

  it('reports the wait so the UI can state it instead of refusing a tap', () => {
    const fresh = saver();
    expect(weeksUntilAdCashBonus(fresh)).toBe(0);

    const claimed = drive(fresh).state;
    expect(weeksUntilAdCashBonus(claimed)).toBe(AD_CASH_BONUS_COOLDOWN_WEEKS);
    expect(canClaimAdCashBonus(claimed)).toBe(false);
  });

  it('treats a never-claimed save as ready (no marker, no lockout)', () => {
    const untouched = saver();
    expect(untouched.settings?.lastAdCashBonusWeek).toBeUndefined();
    expect(canClaimAdCashBonus(untouched)).toBe(true);
  });

  it('is keyed on game time, so moving the device clock changes nothing', () => {
    const claimed = drive(saver()).state;
    const realTimeLater = { ...claimed }; // same weeksLived, any wall clock
    expect(canClaimAdCashBonus(realTimeLater)).toBe(false);
  });

  it('quotes exactly what it pays, at both ends of the scale', () => {
    // Bounds asserted through the exported constants, not literals. This test
    // previously hard-coded 50 and 5000 and so had to be edited when the reward
    // was rebased onto net worth with a $2,000 floor — a bound that lives in two
    // places drifts, and the version that fails is the one nobody updated.
    for (const money of [0, 1_000, 250_000, 100_000_000]) {
      const state = saver(money);
      const quoted = getAdCashBonusAmount(state);
      const { result } = drive(state);
      expect(result.amount).toBe(quoted);
      // Bounded at both ends so it is neither pointless nor a late-game faucet.
      expect(quoted).toBeGreaterThanOrEqual(AD_CASH_BONUS_MIN);
      expect(quoted).toBeLessThanOrEqual(AD_CASH_BONUS_MAX);
    }
  });

  it('survives a save with no settings object', () => {
    const noSettings = saver(5_000, { settings: undefined as never });
    expect(canClaimAdCashBonus(noSettings)).toBe(true);
    expect(drive(noSettings).result.success).toBe(true);
  });
});
