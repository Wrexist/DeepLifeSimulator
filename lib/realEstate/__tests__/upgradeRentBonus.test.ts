/**
 * ECO-12 (owner decision 2026-10-22): an upgrade tier's rent bonus is a share
 * of the property's value, not a flat $100/$250/$500 a week.
 *
 * Flat, the bonus paid ~51%/yr on tier 1 of a $95k studio and ~28%/yr on the
 * whole ladder, 2.8x the studio's own market rent. Value-scaled, no tier's
 * rent earns more than ~20%/yr on its price at any value.
 */
import {
  UPGRADE_TIERS,
  UPGRADE_UPKEEP_SHARE,
  getUpgradeRentBonus,
  getUpgradeUpkeepBonus,
  getUpgradeTierCost,
} from '../housing';

const tier = (level: number) => UPGRADE_TIERS.find((t) => t.level === level)!;
const studio = { price: 95_000, currentValue: 95_000 };
const mansion = { price: 5_000_000, currentValue: 5_000_000 };

describe('ECO-12: upgrade rent bonus scales with value', () => {
  it('pays $4 / $12 / $28 a week on the $95k studio (was a flat $100 / $250 / $500)', () => {
    expect([1, 2, 3].map((l) => getUpgradeRentBonus(tier(l), studio))).toEqual([4, 12, 28]);
  });

  it('pays $200 / $650 / $1,500 a week on a $5M home', () => {
    expect([1, 2, 3].map((l) => getUpgradeRentBonus(tier(l), mansion))).toEqual([200, 650, 1500]);
  });

  it('adds upkeep of a fixed share of the bonus', () => {
    for (const l of [1, 2, 3]) {
      expect(getUpgradeUpkeepBonus(tier(l), mansion)).toBe(
        Math.round(getUpgradeRentBonus(tier(l), mansion) * UPGRADE_UPKEEP_SHARE)
      );
    }
    expect(getUpgradeRentBonus(tier(0), mansion)).toBe(0);
    expect(getUpgradeUpkeepBonus(undefined, mansion)).toBe(0);
  });

  it('every tier pays 10-20%/yr net rent on its price where cost tracks value, and no more below', () => {
    for (const value of [95_000, 300_000, 1_000_000, 5_000_000, 8_000_000]) {
      const p = { price: value, currentValue: value };
      for (const l of [1, 2, 3]) {
        const prev = l - 1;
        const marginalNet =
          (getUpgradeRentBonus(tier(l), p) - getUpgradeUpkeepBonus(tier(l), p)) -
          (getUpgradeRentBonus(tier(prev), p) - getUpgradeUpkeepBonus(tier(prev), p));
        const annualYield = (marginalNet * 52) / getUpgradeTierCost(tier(l), p);
        expect(annualYield).toBeLessThanOrEqual(0.2);
        if (value >= 1_000_000) expect(annualYield).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it('degrades a missing value to no bonus instead of NaN', () => {
    expect(getUpgradeRentBonus(tier(3), { price: NaN, currentValue: undefined as unknown as number })).toBe(0);
  });
});
