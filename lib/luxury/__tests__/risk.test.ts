/**
 * Luxury risk — the last system that treated a collection as inert.
 *
 * The properties that matter: insurance is a real decision (a genuine cost
 * against a genuine risk), nothing is ever destroyed outright, and an old save
 * that predates all of this is completely unaffected.
 */

import {
  INSURANCE_MARGIN,
  getExpectedWeeklyLoss,
  applyLuxuryRiskForWeek,
  conditionValueMultiplier,
  getCondition,
  getItemPremium,
  getLuxuryRisk,
  getRestoreCost,
  getTotalPremiums,
} from '../risk';
import { LUXURY_CATALOG, getLuxuryItem, getTotalLuxuryMarketValue } from '../index';
import type { LuxuryHolding } from '@/contexts/game/types';

const ISLAND = getLuxuryItem('private_island')!;
const WATCHES = getLuxuryItem('rare_watch_collection')!;

/** Rolls that guarantee an incident for every item. */
const ALWAYS = [0];
/** Rolls that guarantee no incident. */
const NEVER = [0.99];

describe('risk profiles', () => {
  it('covers every item in the catalog', () => {
    for (const item of LUXURY_CATALOG) {
      expect(getLuxuryRisk(item.id)).toBeTruthy();
    }
  });

  it('keeps incidents rare', () => {
    // These are events that matter when they land, not a slow tax. Anything
    // above ~1%/wk would fire several times a year on a full collection.
    for (const item of LUXURY_CATALOG) {
      expect(getLuxuryRisk(item.id)!.weeklyChance).toBeLessThanOrEqual(0.01);
      expect(getLuxuryRisk(item.id)!.weeklyChance).toBeGreaterThan(0);
    }
  });

  it('makes things that move riskier than things in a vault', () => {
    expect(getLuxuryRisk('racehorse')!.weeklyChance).toBeGreaterThan(
      getLuxuryRisk('trophy_penthouse')!.weeklyChance,
    );
  });
});

describe('condition', () => {
  it('treats an absent condition as pristine — old saves are undamaged', () => {
    expect(getCondition(undefined)).toBe(100);
    expect(getCondition({ acquiredWeek: 0 })).toBe(100);
  });

  it('discounts value but never to nothing', () => {
    // Even a wrecked hypercar is worth something, and a floor stops a run of
    // bad luck zeroing a nine-figure asset.
    expect(conditionValueMultiplier(100)).toBe(1);
    expect(conditionValueMultiplier(50)).toBeLessThan(1);
    expect(conditionValueMultiplier(0)).toBeGreaterThan(0.4);
  });

  it('feeds through to net-worth market value', () => {
    const pristine = getTotalLuxuryMarketValue(['private_island'], {});
    const damaged = getTotalLuxuryMarketValue(['private_island'], {
      private_island: { acquiredWeek: 0, condition: 40 },
    });
    expect(damaged).toBeLessThan(pristine);
    expect(damaged).toBeGreaterThan(0);
  });

  it('values an untouched collection exactly as before', () => {
    // The guarantee that makes this safe to ship on top of existing saves.
    const ids = LUXURY_CATALOG.map((i) => i.id);
    expect(getTotalLuxuryMarketValue(ids, {})).toBe(getTotalLuxuryMarketValue(ids, undefined));
  });
});

describe('insurance pricing', () => {
  it('costs nothing when uninsured', () => {
    expect(getItemPremium(ISLAND, { acquiredWeek: 0 })).toBe(0);
    expect(getItemPremium(ISLAND, undefined)).toBe(0);
  });

  it('prices off the item own risk when insured', () => {
    const premium = getItemPremium(ISLAND, { acquiredWeek: 0, insured: true });
    expect(premium).toBe(Math.round(getExpectedWeeklyLoss(ISLAND, undefined) * INSURANCE_MARGIN));
    expect(premium).toBeGreaterThan(0);
  });

  it('costs more to insure the things that actually get damaged', () => {
    // A racehorse gets hurt; a penthouse does not. A flat rate would make the
    // safe items subsidise the dangerous ones.
    const horse = getLuxuryItem('racehorse')!;
    const penthouse = getLuxuryItem('trophy_penthouse')!;
    const rate = (i: typeof horse) =>
      getItemPremium(i, { acquiredWeek: 0, insured: true }) / i.price;

    expect(rate(horse)).toBeGreaterThan(rate(penthouse));
  });

  it('is a real decision, not a dominant strategy either way', () => {
    // Priced BELOW expected loss, insuring would be free money and nobody would
    // ever decline. Priced far above, nobody would ever take it. A modest
    // margin means you are paying to remove variance — which is the point.
    for (const item of LUXURY_CATALOG) {
      const premium = getItemPremium(item, { acquiredWeek: 0, insured: true });
      const expectedLoss = getExpectedWeeklyLoss(item, undefined);
      expect(premium).toBeGreaterThan(expectedLoss);
      expect(premium).toBeLessThan(expectedLoss * 2);
    }
  });

  it('totals across a collection', () => {
    const holdings = {
      private_island: { acquiredWeek: 0, insured: true },
      rare_watch_collection: { acquiredWeek: 0 },
    };
    expect(getTotalPremiums(['private_island', 'rare_watch_collection'], holdings)).toBe(
      getItemPremium(ISLAND, holdings.private_island),
    );
    expect(getTotalPremiums(null, null)).toBe(0);
  });
});

describe('restoration', () => {
  it('costs nothing on a pristine item', () => {
    expect(getRestoreCost(ISLAND, { acquiredWeek: 0 })).toBe(0);
  });

  it('scales with the damage', () => {
    const light = getRestoreCost(ISLAND, { acquiredWeek: 0, condition: 90 });
    const heavy = getRestoreCost(ISLAND, { acquiredWeek: 0, condition: 30 });
    expect(heavy).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(0);
  });

  it('is cheaper than replacing the item', () => {
    // Restoring must always beat selling and re-buying, or nobody would ever
    // restore anything.
    const wrecked = getRestoreCost(ISLAND, { acquiredWeek: 0, condition: 0 });
    expect(wrecked).toBeLessThan(ISLAND.price);
  });
});

describe('a week of risk', () => {
  const owned = ['rare_watch_collection'];

  it('does nothing on a quiet week', () => {
    const holdings = { rare_watch_collection: { acquiredWeek: 0 } };
    const result = applyLuxuryRiskForWeek(owned, holdings, NEVER);

    expect(result.incidents).toHaveLength(0);
    expect(result.cashOwed).toBe(0);
    // Same reference — no state churn for the common case.
    expect(result.holdings).toBe(holdings);
  });

  it('damages an uninsured item and reports it', () => {
    const result = applyLuxuryRiskForWeek(owned, { rare_watch_collection: { acquiredWeek: 0 } }, ALWAYS);

    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].insured).toBe(false);
    expect(result.incidents[0].conditionLost).toBeGreaterThan(0);
    expect(getCondition(result.holdings!.rare_watch_collection)).toBeLessThan(100);
    // Uninsured means no bill this week — the cost is the damage itself.
    expect(result.cashOwed).toBe(0);
  });

  it('makes an insured item good for a deductible', () => {
    const holdings = { rare_watch_collection: { acquiredWeek: 0, insured: true } };
    const result = applyLuxuryRiskForWeek(owned, holdings, ALWAYS);

    expect(result.incidents[0].insured).toBe(true);
    // The whole point of insurance: the item is NOT left damaged.
    expect(getCondition(result.holdings?.rare_watch_collection)).toBe(100);
    // Premium + deductible.
    expect(result.cashOwed).toBeGreaterThan(getItemPremium(WATCHES, holdings.rare_watch_collection));
  });

  it('charges premiums even on a quiet week', () => {
    const holdings = { rare_watch_collection: { acquiredWeek: 0, insured: true } };
    const result = applyLuxuryRiskForWeek(owned, holdings, NEVER);

    expect(result.incidents).toHaveLength(0);
    expect(result.cashOwed).toBe(getItemPremium(WATCHES, holdings.rare_watch_collection));
  });

  it('never destroys an item outright', () => {
    // Losing a nine-figure asset to a dice roll would make players stop buying
    // the feature. Condition floors at 0 and the item is always still owned.
    let holdings: Record<string, LuxuryHolding> = { rare_watch_collection: { acquiredWeek: 0 } };
    for (let week = 0; week < 40; week += 1) {
      holdings = applyLuxuryRiskForWeek(owned, holdings, ALWAYS).holdings!;
    }
    expect(getCondition(holdings.rare_watch_collection)).toBeGreaterThanOrEqual(0);
    expect(holdings.rare_watch_collection).toBeTruthy();
  });

  it('is inert for a player who owns nothing', () => {
    const result = applyLuxuryRiskForWeek([], {}, ALWAYS);
    expect(result.incidents).toHaveLength(0);
    expect(result.cashOwed).toBe(0);
  });

  it('survives missing rolls and missing holdings', () => {
    expect(() => applyLuxuryRiskForWeek(owned, null, undefined)).not.toThrow();
    expect(applyLuxuryRiskForWeek(owned, null, undefined).incidents).toHaveLength(0);
  });
});
