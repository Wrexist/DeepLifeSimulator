/**
 * Selling a luxury item must be NET-WORTH NEUTRAL.
 *
 * There were two answers to "what is this worth". `sellLuxuryItem` paid
 * `getLuxuryResaleValue(item)` — a flat 60% of the CATALOG price, ignoring the
 * holding entirely — while net worth counted the same item at
 * `getHoldingValue × 0.6 × conditionValueMultiplier`, i.e. appreciation- and
 * condition-aware. So whenever an item had depreciated or taken damage, the cash
 * paid on sale exceeded the value it was carrying, and NET WORTH ROSE on the
 * sale. That figure is what prestige points are computed from (100 per $1M), so
 * "sell everything, then prestige" was strictly profitable — and it made the
 * whole Phase-5 risk system consequence-free in cash terms.
 * 2026-07-28 audit econ-1.
 *
 * The invariant below is the one that closes it: what you get for an item equals
 * what it was contributing to net worth the instant before you sold it.
 */
import {
  LUXURY_CATALOG,
  getLuxuryItem,
  getLuxuryHoldingValue,
  getTotalLuxuryMarketValue,
  getLuxuryResaleValue,
} from '../index';
import type { LuxuryHolding } from '@/contexts/game/types';

const ITEM = LUXURY_CATALOG.find((i) => i.weeklyUpkeep > 0)!;

describe('one valuation, used by both the sale and net worth', () => {
  it('pays exactly what the item contributed to net worth', () => {
    const holdings: Record<string, LuxuryHolding> = {
      [ITEM.id]: { acquiredWeek: 10, currentValue: Math.round(ITEM.price * 0.8), condition: 72 },
    };

    const carriedInNetWorth = getTotalLuxuryMarketValue([ITEM.id], holdings);
    const paidOnSale = getLuxuryHoldingValue(ITEM, holdings[ITEM.id]);

    expect(paidOnSale).toBe(carriedInNetWorth);
  });

  it('is the sum of its parts across a whole collection', () => {
    const ids = LUXURY_CATALOG.slice(0, 4).map((i) => i.id);
    const holdings: Record<string, LuxuryHolding> = {};
    ids.forEach((id, i) => {
      holdings[id] = { acquiredWeek: 1, currentValue: getLuxuryItem(id)!.price * (0.7 + i * 0.1), condition: 80 - i * 10 };
    });

    const total = getTotalLuxuryMarketValue(ids, holdings);
    const summed = ids.reduce((sum, id) => sum + getLuxuryHoldingValue(getLuxuryItem(id)!, holdings[id]), 0);
    expect(total).toBe(summed);
  });

  it('pays LESS for a damaged item than a pristine one (the risk system now bites)', () => {
    const pristine = getLuxuryHoldingValue(ITEM, { acquiredWeek: 1, currentValue: ITEM.price, condition: 100 });
    const damaged = getLuxuryHoldingValue(ITEM, { acquiredWeek: 1, currentValue: ITEM.price, condition: 30 });

    expect(damaged).toBeLessThan(pristine);
  });

  it('pays LESS for a depreciated item, and MORE for an appreciated one', () => {
    const base = getLuxuryHoldingValue(ITEM, { acquiredWeek: 1, currentValue: ITEM.price, condition: 100 });
    const down = getLuxuryHoldingValue(ITEM, { acquiredWeek: 1, currentValue: ITEM.price * 0.5, condition: 100 });
    const up = getLuxuryHoldingValue(ITEM, { acquiredWeek: 1, currentValue: ITEM.price * 1.5, condition: 100 });

    expect(down).toBeLessThan(base);
    expect(up).toBeGreaterThan(base);
  });

  it('still matches the old flat quote for an untouched item (no silent nerf)', () => {
    // A pristine, never-appreciated holding must be worth exactly what the old
    // catalog-price formula said — otherwise this fix would be a stealth
    // repricing of every ordinary sale.
    const pristine = getLuxuryHoldingValue(ITEM, { acquiredWeek: 1 });
    expect(pristine).toBe(getLuxuryResaleValue(ITEM));
  });

  it('handles a missing holding (pre-appreciation save) without throwing', () => {
    expect(getLuxuryHoldingValue(ITEM, undefined)).toBe(getLuxuryResaleValue(ITEM));
  });

  it('never returns a negative or non-finite amount', () => {
    for (const bad of [
      { acquiredWeek: 1, currentValue: Number.NaN },
      { acquiredWeek: 1, currentValue: -5000 },
      { acquiredWeek: 1, condition: Number.NaN },
      { acquiredWeek: 1, condition: -40 },
    ] as LuxuryHolding[]) {
      const v = getLuxuryHoldingValue(ITEM, bad);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
