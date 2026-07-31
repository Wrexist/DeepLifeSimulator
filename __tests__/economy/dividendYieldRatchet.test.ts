/**
 * A standing policy modifier must not accumulate into persistent state.
 *
 * `simulateWeek` ran `stock.dividendYield = Math.min(0.1, stock.dividendYield +
 * dividendBonus)` once per game week. `dividendBonus` is the aggregate of the
 * player's enacted policies — recomputed from scratch by
 * `calculateActivePolicyEffects` whenever a policy changes — so it is a
 * MODIFIER, not a grant. Adding it to the stored yield every week compounded:
 * a single $30k Mayor-level policy (`financial_literacy_program`, +0.001) took
 * IBM's 4.8% to the 10% cap in about a year of game time, and every dividend
 * payer eventually sat at a permanent 10%, roughly 3x the highest real yield on
 * the board.
 *
 * Two things made it permanent: `getStockPricesSnapshot` persists
 * `dividendYield`, so it survived save/reload, and nothing ever subtracted the
 * bonus, so repealing the policy did not undo it. The policy card advertises
 * "+0.5% bonus to dividend yields"; it delivered +0.5 points per week, forever.
 * 2026-07-31 audit round 3, R3-M1.
 */
import {
  simulateWeek,
  getStockInfo,
  getStockPricesSnapshot,
  restoreStockPrices,
  resetStockPrices,
  policyAdjustedYield,
  MAX_POLICY_DIVIDEND_YIELD,
} from '@/lib/economy/stockMarket';

/** A dividend payer with headroom below the 10% cap. */
const SYMBOL = 'KO';

beforeEach(() => {
  resetStockPrices();
});

describe('the weekly tick never mutates a stored dividend yield', () => {
  it('leaves the yield untouched across 200 weeks with a policy active', () => {
    const before = getStockInfo(SYMBOL).dividendYield;
    expect(before).toBeGreaterThan(0); // guards the comparison below

    for (let week = 1; week <= 200; week += 1) {
      // 0.005 is the largest single policy bonus in the catalogue.
      simulateWeek({ volatilityModifier: 1, dividendBonus: 0.005 }, week);
    }

    expect(getStockInfo(SYMBOL).dividendYield).toBe(before);
  });

  it('does not reach the cap, which is what the ratchet always converged to', () => {
    for (let week = 1; week <= 500; week += 1) {
      simulateWeek({ volatilityModifier: 1, dividendBonus: 0.005 }, week);
    }

    expect(getStockInfo(SYMBOL).dividendYield).toBeLessThan(MAX_POLICY_DIVIDEND_YIELD);
  });

  it('still moves prices, so the loop above really ran', () => {
    // Positive control: if `simulateWeek` no-oped, every assertion here would
    // pass while testing nothing.
    const priceBefore = getStockInfo(SYMBOL).price;
    for (let week = 1; week <= 50; week += 1) {
      simulateWeek({ volatilityModifier: 1, dividendBonus: 0.005 }, week);
    }

    expect(getStockInfo(SYMBOL).price).not.toBe(priceBefore);
  });
});

describe('the bonus is a read-time modifier', () => {
  it('raises the yield while the policy is in force', () => {
    const base = getStockInfo(SYMBOL).dividendYield;

    expect(policyAdjustedYield(base, 0.005)).toBeCloseTo(base + 0.005, 10);
  });

  it('returns the base yield the moment the policy is gone', () => {
    // The property the ratchet could never have: repeal actually reverses it.
    const base = getStockInfo(SYMBOL).dividendYield;

    expect(policyAdjustedYield(base, 0)).toBe(base);
  });

  it('honours the same 10% ceiling the old code capped at', () => {
    expect(policyAdjustedYield(0.09, 0.5)).toBe(MAX_POLICY_DIVIDEND_YIELD);
  });

  it('leaves a non-payer at zero rather than granting it a yield', () => {
    expect(policyAdjustedYield(0, 0.005)).toBe(0);
  });

  it('is NaN-safe in both arguments', () => {
    for (const bad of [NaN, Infinity, -1]) {
      expect(Number.isFinite(policyAdjustedYield(bad, 0.005))).toBe(true);
      expect(Number.isFinite(policyAdjustedYield(0.03, bad))).toBe(true);
      expect(policyAdjustedYield(0.03, bad)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('a save already inflated by the bug is healed on load', () => {
  it('clamps a persisted yield back down to the catalogue value', () => {
    const catalogueYield = getStockInfo(SYMBOL).dividendYield;

    // Exactly what an affected player's save holds: everything at the cap.
    restoreStockPrices({ [SYMBOL]: { price: 60, dividendYield: 0.1 } });

    expect(getStockInfo(SYMBOL).dividendYield).toBe(catalogueYield);
    // The price must still restore — the clamp is on the yield only.
    expect(getStockInfo(SYMBOL).price).toBe(60);
  });

  it('still honours a BELOW-default persisted yield', () => {
    // The clamp is one-directional on purpose: a future yield-cut mechanic
    // must not be silently reverted on every load.
    restoreStockPrices({ [SYMBOL]: { price: 60, dividendYield: 0.001 } });

    expect(getStockInfo(SYMBOL).dividendYield).toBe(0.001);
  });

  it('round-trips a clean save unchanged', () => {
    const snapshot = getStockPricesSnapshot();
    restoreStockPrices(snapshot);

    expect(getStockPricesSnapshot()).toEqual(snapshot);
  });
});

describe('the week loop reads the bonus from prev state', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'),
    'utf8',
  );

  it('applies policyAdjustedYield when building the yields map', () => {
    expect(source).toMatch(/yields\[sym\] = policyAdjustedYield\(info\.dividendYield, safeDividendBonus\)/);
  });

  it('reads the policy off prevState, not the stale closure', () => {
    // Inside a setGameState updater, `gameState` is the render-time snapshot.
    expect(source).toMatch(
      /const policyDividendBonus = Number\(prevState\.politics\?\.activePolicyEffects\?\.stocks\?\.dividendBonus\)/,
    );
  });
});
