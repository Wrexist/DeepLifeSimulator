/**
 * Phase 4 — the collection stops being dead capital.
 *
 * Every luxury item used to be pure negative yield: pay sticker, lose 40% on
 * resale, bleed upkeep forever, receive 1-5 happiness. These tests pin the two
 * things that fix it AND the boundary that stops the fix going too far — a
 * trophy that paid for itself would stop being a trophy.
 */

import {
  LUXURY_CATALOG,
  LUXURY_RESALE_FRACTION,
  appreciateLuxuryHoldings,
  getHoldingValue,
  getLuxuryItem,
  getLuxuryYieldBreakdown,
  getTotalLuxuryMarketValue,
  getTotalLuxuryResaleValue,
  getTotalLuxuryUpkeep,
  getTotalLuxuryYield,
} from '../index';
import type { LuxuryHolding } from '@/contexts/game/types';

const ALL_IDS = LUXURY_CATALOG.map((i) => i.id);

describe('yield - the collection produces', () => {
  it('no item ever out-earns its own upkeep', () => {
    // The line that keeps a trophy a trophy. If any item paid for itself it
    // would stop being a money sink and start being an investment.
    for (const item of LUXURY_CATALOG) {
      const weekly = item.yield?.weekly ?? 0;
      if (weekly > 0) expect(weekly).toBeLessThan(item.weeklyUpkeep);
    }
  });

  it('a full collection still costs money to hold', () => {
    const upkeep = getTotalLuxuryUpkeep(ALL_IDS);
    const produced = getTotalLuxuryYield(ALL_IDS);

    expect(produced).toBeLessThan(upkeep);
  });

  it('but no longer bleeds the way it used to', () => {
    // Before Phase 4 this was a 100% drain. The target band: yield offsets a
    // meaningful chunk without approaching break-even.
    const upkeep = getTotalLuxuryUpkeep(ALL_IDS);
    const produced = getTotalLuxuryYield(ALL_IDS);
    const offset = produced / upkeep;

    expect(offset).toBeGreaterThan(0.4);
    expect(offset).toBeLessThan(0.75);
  });

  it('gives every earning item a label for the weekly breakdown', () => {
    for (const line of getLuxuryYieldBreakdown(ALL_IDS)) {
      expect(line.label.length).toBeGreaterThan(3);
      expect(line.weekly).toBeGreaterThan(0);
    }
  });

  it('earns nothing from an empty or unknown collection', () => {
    expect(getTotalLuxuryYield([])).toBe(0);
    expect(getTotalLuxuryYield(null)).toBe(0);
    expect(getTotalLuxuryYield(['not_a_real_item'])).toBe(0);
  });

  it('leaves pure trophies as pure trophies', () => {
    // A diamond in a vault does not earn. It appreciates, which is different.
    expect(getLuxuryItem('museum_diamond')!.yield).toBeUndefined();
    expect(getLuxuryItem('rare_watch_collection')!.yield).toBeUndefined();
  });
});

describe('appreciation - value drifts', () => {
  it('gains on the assets that actually appreciate', () => {
    const ids = ['fine_art_collection', 'rare_watch_collection'];
    const { holdings, valueDelta } = appreciateLuxuryHoldings(ids, {});

    expect(valueDelta).toBeGreaterThan(0);
    for (const id of ids) {
      expect(holdings[id].currentValue).toBeGreaterThan(getLuxuryItem(id)!.price);
    }
  });

  it('loses on the assets that actually depreciate', () => {
    // A yacht is not an investment and the game should not pretend otherwise.
    const { holdings, valueDelta } = appreciateLuxuryHoldings(['luxury_yacht'], {});

    expect(valueDelta).toBeLessThan(0);
    expect(holdings.luxury_yacht.currentValue).toBeLessThan(getLuxuryItem('luxury_yacht')!.price);
  });

  it('does not drift developable items - their property appreciates instead', () => {
    // The island mints a RealEstate that appreciates through the real-estate
    // system. Drifting both would count one island twice.
    const { holdings, valueDelta } = appreciateLuxuryHoldings(['private_island'], {});
    expect(valueDelta).toBe(0);
    expect(holdings.private_island).toBeUndefined();
  });

  it('returns the SAME holdings reference when nothing drifts', () => {
    // setState-identity safety: a collection of pure trophies must not churn
    // state every single week.
    const holdings: Record<string, LuxuryHolding> = { private_island: { acquiredWeek: 1 } };
    const result = appreciateLuxuryHoldings(['private_island'], holdings);
    expect(result.holdings).toBe(holdings);
  });

  it('stays linear rather than compounding into absurdity', () => {
    // Drift is a percentage of the ORIGINAL price. Over a long life compounding
    // off the running value would turn a watch collection into the economy.
    const id = 'rare_watch_collection';
    let holdings: Record<string, LuxuryHolding> = {};
    for (let week = 0; week < 200; week += 1) {
      holdings = appreciateLuxuryHoldings([id], holdings).holdings;
    }
    const price = getLuxuryItem(id)!.price;
    const grown = holdings[id].currentValue!;

    // 200 weeks at 0.10%/wk of sticker ≈ +20%, and nowhere near a doubling.
    expect(grown).toBeGreaterThan(price);
    expect(grown).toBeLessThan(price * 1.5);
  });

  it('never lets a value go negative', () => {
    const id = 'luxury_yacht';
    let holdings: Record<string, LuxuryHolding> = { [id]: { acquiredWeek: 0, currentValue: 100 } };
    for (let week = 0; week < 50; week += 1) {
      holdings = appreciateLuxuryHoldings([id], holdings).holdings;
    }
    expect(holdings[id].currentValue).toBeGreaterThanOrEqual(0);
  });

  it('preserves the rest of the holding', () => {
    const holdings = { supercar: { acquiredWeek: 42, propertyId: undefined } };
    const next = appreciateLuxuryHoldings(['supercar'], holdings).holdings;
    expect(next.supercar.acquiredWeek).toBe(42);
  });

  it('survives missing holdings entirely', () => {
    expect(() => appreciateLuxuryHoldings(['supercar'], null)).not.toThrow();
    expect(() => appreciateLuxuryHoldings(null, null)).not.toThrow();
  });
});

describe('market value - what net worth should count', () => {
  it('matches the old flat resale value before anything drifts', () => {
    // The guarantee that makes this safe to ship: an untouched collection is
    // valued exactly as it always was.
    expect(getTotalLuxuryMarketValue(ALL_IDS, {})).toBe(getTotalLuxuryResaleValue(ALL_IDS));
  });

  it('follows appreciation upward', () => {
    const ids = ['fine_art_collection'];
    const before = getTotalLuxuryMarketValue(ids, {});
    const { holdings } = appreciateLuxuryHoldings(ids, {});
    expect(getTotalLuxuryMarketValue(ids, holdings)).toBeGreaterThan(before);
  });

  it('still applies the resale haircut - luxury is never a net-worth exploit', () => {
    const item = getLuxuryItem('fine_art_collection')!;
    const value = getTotalLuxuryMarketValue([item.id], {});
    expect(value).toBe(Math.floor(item.price * LUXURY_RESALE_FRACTION));
    expect(value).toBeLessThan(item.price);
  });

  it('falls back to the catalog price for an untracked holding', () => {
    const item = getLuxuryItem('supercar')!;
    expect(getHoldingValue(item, undefined)).toBe(item.price);
    expect(getHoldingValue(item, { acquiredWeek: 0 })).toBe(item.price);
    expect(getHoldingValue(item, { acquiredWeek: 0, currentValue: NaN })).toBe(item.price);
  });
});
