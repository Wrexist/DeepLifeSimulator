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
import { LUXURY_CATALOG, getLuxuryItem, getLuxuryHoldingValue, getTotalLuxuryMarketValue } from '../index';
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
  it('treats an absent condition as pristine - old saves are undamaged', () => {
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

/**
 * R4-X4 — insurance was strictly dominated by ~100×, so the "genuine call" this
 * module was built to create never existed.
 *
 * `RESTORE_COST_PER_POINT_PCT` was documented as "a fraction of item value" and
 * set to 0.006, and all three call sites then divided it by 100 as well —
 * pricing restoration, and the insured deductible derived from it, at 1/100th
 * of intent. The `_PCT` in the name is how the stray divide looked correct
 * everywhere it appeared.
 *
 * The consequence, on the private island: an incident destroys 13.75% of its
 * value, the premium runs 0.103% of value EVERY WEEK, and restoring the damage
 * yourself cost 0.15% of value once. Never insuring was optimal by two orders
 * of magnitude, and an incident was a rounding error rather than an event.
 *
 * The tests above are all directional ("heavy costs more than light", "cheaper
 * than replacing"), which a 100× error passes comfortably. These pin the
 * MAGNITUDE against the module's own stated design. 2026-07-31 audit round 4.
 */
describe('R4-X4 - the insurance decision is actually a decision', () => {
  const PRISTINE: LuxuryHolding = { acquiredWeek: 0 };

  it('restoring costs what the repair is WORTH, on the same basis net worth uses', () => {
    /**
     * The assertion that should have been written the first time.
     *
     * The original compared restore cost against `item.price * (1 - cvm)` — the
     * RAW item value. Net worth counts `getLuxuryHoldingValue`, which is
     * `rawValue * LUXURY_RESALE_FRACTION * cvm`. Pricing off one basis and
     * valuing off the other made restoring cost a flat 1.818x what it returned,
     * for every item at every condition, and the loose `[0.5, 2]` band I used
     * accepted that quite happily. Comparing against the value the player
     * actually gets back is the only comparison that means anything.
     */
    for (const item of LUXURY_CATALOG) {
      const risk = getLuxuryRisk(item.id)!;
      const damaged: LuxuryHolding = { acquiredWeek: 0, condition: 100 - risk.severity };

      const recovered = getLuxuryHoldingValue(item, { acquiredWeek: 0 })
        - getLuxuryHoldingValue(item, damaged);
      const cost = getRestoreCost(item, damaged);
      const ratio = cost / recovered;

      expect(`${item.id} cost/recovered within 2% of 1: ${Math.abs(ratio - 1) < 0.02} (${ratio.toFixed(3)})`)
        .toBe(`${item.id} cost/recovered within 2% of 1: true (${ratio.toFixed(3)})`);
    }
  });

  it('restoring is never a net loss the UI invites the player into', () => {
    /**
     * The player-facing form. `LuxuryApp` renders a "Restore - $X" button; if X
     * exceeds the net worth the restore returns, that button is a trap, and it
     * was one for every item: restore a damaged private island for $18,000,000
     * and gain $9,900,000.
     */
    for (const item of LUXURY_CATALOG) {
      for (const condition of [0, 25, 50, 75, 99]) {
        const damaged: LuxuryHolding = { acquiredWeek: 0, condition };
        const recovered = getLuxuryHoldingValue(item, { acquiredWeek: 0 })
          - getLuxuryHoldingValue(item, damaged);
        const cost = getRestoreCost(item, damaged);

        expect(`${item.id}@${condition} cost <= recovered + 1%: ${cost <= recovered * 1.01}`)
          .toBe(`${item.id}@${condition} cost <= recovered + 1%: true`);
      }
    }
  });

  it('a lifetime of premiums is the same order as the loss they cover', () => {
    // Premiums over one expected incident interval (1/weeklyChance weeks)
    // should sit near INSURANCE_MARGIN × the loss - that IS the margin's
    // definition. At the old scale this held, which is why the bug survived:
    // the premium side was always right. It is the restore side that decides
    // whether paying those premiums is ever rational.
    for (const item of LUXURY_CATALOG) {
      const risk = getLuxuryRisk(item.id)!;
      const insured: LuxuryHolding = { acquiredWeek: 0, insured: true };

      const weeksPerIncident = 1 / risk.weeklyChance;
      const premiumsPerIncident = getItemPremium(item, insured) * weeksPerIncident;
      const valueLost = item.price * (1 - conditionValueMultiplier(100 - risk.severity));
      const ratio = premiumsPerIncident / valueLost;

      expect(`${item.id} premium/loss ≈ margin: ${Math.abs(ratio - INSURANCE_MARGIN) < 0.15}`)
        .toBe(`${item.id} premium/loss ≈ margin: true`);
    }
  });

  it('the deductible is a real share of the repair, not a rounding error', () => {
    // Insured, the owner pays INSURANCE_DEDUCTIBLE_FRACTION of the repair. At
    // the old scale that was ~0.015% of item value - indistinguishable from
    // free, which is the other half of why the decision was not a decision.
    const risk = getLuxuryRisk(ISLAND.id)!;
    const insured: LuxuryHolding = { acquiredWeek: 0, insured: true };
    const { cashOwed } = applyLuxuryRiskForWeek([ISLAND.id], { [ISLAND.id]: insured }, ALWAYS);
    const premium = getItemPremium(ISLAND, insured);
    const deductible = cashOwed - premium;

    expect(deductible / ISLAND.price).toBeGreaterThan(0.005);
    expect(deductible / ISLAND.price).toBeLessThan(0.05);
  });

  it('skipping insurance is not free money', () => {
    // Passes at the old scale too - both sides were small, so the inequality
    // held while being economically meaningless. Kept as the shape the fix must
    // preserve; the two magnitude assertions above are the discriminators.
    const risk = getLuxuryRisk(ISLAND.id)!;
    const uninsured = applyLuxuryRiskForWeek([ISLAND.id], { [ISLAND.id]: PRISTINE }, ALWAYS);
    const damagedHolding = uninsured.holdings?.[ISLAND.id];

    expect(getCondition(damagedHolding)).toBe(100 - risk.severity);

    const selfRepair = getRestoreCost(ISLAND, damagedHolding);
    const insured: LuxuryHolding = { acquiredWeek: 0, insured: true };
    const insuredCost = applyLuxuryRiskForWeek([ISLAND.id], { [ISLAND.id]: insured }, ALWAYS).cashOwed;

    expect(selfRepair).toBeGreaterThan(insuredCost);
  });

  it('a wrecked item is still cheaper to restore than to replace', () => {
    // The control in the other direction: the 100× correction must not have
    // made restoration irrational.
    for (const item of LUXURY_CATALOG) {
      const wrecked = getRestoreCost(item, { acquiredWeek: 0, condition: 0 });

      expect(`${item.id} restore < price: ${wrecked < item.price}`).toBe(`${item.id} restore < price: true`);
    }
  });
});
