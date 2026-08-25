/**
 * No mining tier may be unrecoverable by arithmetic (2026-08-25 economy audit).
 *
 * The price ladder and the weekly-earnings ladder were authored consistently -
 * every tier costs ~71 weeks of its own gross output. The flat $100k/week cap
 * then clipped the top two: a giga ($10M, $140k/wk gross) paid back in 100
 * weeks and a tera ($50M, $700k/wk) in 500, and a SECOND big rig earned
 * literally nothing. Two SKUs on the shop shelf that could never be recovered.
 *
 * The cap now scales with the capital deployed, so the whole ladder shares one
 * payback - and mining still cannot out-run that payback however much hardware
 * is bought, which is what the cap was protecting.
 */
import {
  MINER_PRICES,
  MINING_PAYBACK_WEEKS,
  MINING_INCOME_CAP_BASE,
  miningIncomeCap,
} from '../constants';

/** Gross weekly output per rig - mirrors MINERS_DATA in applyMiningCryptos. */
const GROSS: Record<string, number> = {
  basic: 22, advanced: 105, pro: 438, industrial: 1575,
  quantum: 7000, mega: 35000, giga: 140000, tera: 700000,
};

describe('miningIncomeCap', () => {
  it('leaves every fleet the old flat cap was written for untouched', () => {
    expect(miningIncomeCap(undefined)).toBe(MINING_INCOME_CAP_BASE);
    expect(miningIncomeCap({})).toBe(MINING_INCOME_CAP_BASE);
    expect(miningIncomeCap({ quantum: 1 })).toBe(MINING_INCOME_CAP_BASE);
    // ~$7.1M is where capital/71 finally overtakes the $100k floor.
    expect(miningIncomeCap({ mega: 2 })).toBe(MINING_INCOME_CAP_BASE);
  });

  it('scales with the hardware actually bought, above that floor', () => {
    expect(miningIncomeCap({ giga: 1 })).toBeGreaterThan(MINING_INCOME_CAP_BASE);
    expect(miningIncomeCap({ tera: 1 })).toBeGreaterThan(miningIncomeCap({ giga: 1 }));
  });

  it('never lets mining return faster than its payback, however big the fleet', () => {
    // THE brake the cap exists to be: every dollar earned had to be a dollar
    // put at risk first, and the rate is fixed.
    const fleets: Record<string, number>[] = [{ tera: 5 }, { giga: 20 }, { mega: 50, tera: 3 }];
    for (const fleet of fleets) {
      const capital = Object.entries(fleet)
        .reduce((sum, [id, n]) => sum + MINER_PRICES[id] * n, 0);
      expect(miningIncomeCap(fleet)).toBeLessThanOrEqual(
        Math.max(MINING_INCOME_CAP_BASE, Math.ceil(capital / MINING_PAYBACK_WEEKS)),
      );
    }
  });

  it('RATCHET: the cap never clips a single rig of any tier', () => {
    // THE defect, stated precisely. A rig whose own gross output exceeds its
    // cap can never reach the payback its price was authored against - that is
    // what made giga and tera unrecoverable. No tier may be in that state.
    const clipped: string[] = [];
    for (const id of Object.keys(MINER_PRICES)) {
      const gross = GROSS[id] ?? 0;
      if (gross > miningIncomeCap({ [id]: 1 })) clipped.push(id);
    }
    expect(clipped).toEqual([]);
  });

  it('RATCHET: every tier keeps the authored payback curve', () => {
    // The ladder is deliberately an economy of SCALE - the cheap rigs pay back
    // slowest (basic ~114wk) and the big ones converge on MINING_PAYBACK_WEEKS.
    // Pinned so a price edit that inverts the curve is caught here.
    const paybacks = Object.keys(MINER_PRICES).map((id) => ({
      id,
      weeks: MINER_PRICES[id] / Math.min(GROSS[id] ?? 0, miningIncomeCap({ [id]: 1 })),
    }));
    for (const { weeks } of paybacks) {
      expect(weeks).toBeGreaterThanOrEqual(MINING_PAYBACK_WEEKS - 1);
      expect(weeks).toBeLessThanOrEqual(120);
    }
    // Non-increasing: a dearer rig never pays back slower than a cheaper one.
    for (let i = 1; i < paybacks.length; i++) {
      expect(paybacks[i].weeks).toBeLessThanOrEqual(paybacks[i - 1].weeks + 0.01);
    }
  });

  it('is defensive about garbage counts', () => {
    expect(miningIncomeCap({ tera: NaN as unknown as number })).toBe(MINING_INCOME_CAP_BASE);
    expect(miningIncomeCap({ tera: -4 })).toBe(MINING_INCOME_CAP_BASE);
    expect(miningIncomeCap({ notARig: 100 })).toBe(MINING_INCOME_CAP_BASE);
  });
});
