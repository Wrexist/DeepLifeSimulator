/**
 * Prestige point value - owner call, 2026-10-17.
 *
 * The defect: on 2026-03-09 (6e9bdc71) the first-prestige threshold was cut
 * 10x, $100M -> $10M, and the earn rate - 100 points per $1M - was left alone.
 * The shop (45 bonuses, median first level 6,000, legendaries 25,000-50,000)
 * had been priced against a threshold prestige paying 10,000 base points; it
 * started paying 1,000. Measured on the old formula with a realistic first
 * life (age 45, 50 achievements): 1,527 points, +1,000 for "First Prestige";
 * five prestiges at the threshold banked ~18k - no legendary, and the median
 * bonus took three lives.
 *
 * The fix anchors the payout to the threshold constant itself (10,000 points
 * at BASE_PRESTIGE_THRESHOLD), linear below it, square root above it, never
 * below the old 100 per $1M. Every test here goes through the public
 * `calculatePrestigePoints`, so each one fails on the old formula as an
 * assertion rather than an import error.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import {
  BASE_PRESTIGE_THRESHOLD,
  defaultPrestigeData,
  getPrestigeThreshold,
  type PrestigeData,
} from '@/lib/prestige/prestigeTypes';
import { PURCHASABLE_PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { PRESTIGE_ACHIEVEMENTS } from '@/lib/prestige/prestigeAchievements';
import { applyStartingBonuses } from '@/lib/prestige/applyBonuses';

/** A life at the moment it prestiges: 27 years in, a few dozen achievements. */
const lifeAtPrestige = (achievementsEarned: number): GameState =>
  createTestGameState({
    date: { age: 45 },
    generationNumber: 1,
    claimedProgressAchievements: Array.from({ length: achievementsEarned }, (_, i) => `ach-${i}`),
  });

const prestigeAt = (level: number, alreadyCredited: number): PrestigeData => ({
  ...defaultPrestigeData,
  prestigeLevel: level,
  totalPrestiges: level,
  achievementsCreditedForPoints: alreadyCredited,
});

const base = (netWorth: number): number =>
  calculatePrestigePoints(createTestGameState(), netWorth, defaultPrestigeData, 'reset').basePoints;

const oneTimeReward = (id: string): number =>
  PRESTIGE_ACHIEVEMENTS.find(a => a.id === id)?.reward?.prestigePoints ?? 0;

const firstLevelPrices = PURCHASABLE_PRESTIGE_BONUSES.map(b => b.cost).sort((a, b) => a - b);
const medianPrice = firstLevelPrices[Math.floor(firstLevelPrices.length / 2)];
const cheapestLegendary = Math.min(
  ...PURCHASABLE_PRESTIGE_BONUSES.filter(b => b.rarity === 'legendary').map(b => b.cost),
);
const shopFirstLevels = firstLevelPrices.reduce((sum, c) => sum + c, 0);

/** Points banked by `lives` prestiges, each at `mult` x its own threshold. */
function bankedAfter(lives: number, mult: number): number {
  let bank = 0;
  for (let level = 0; level < lives; level++) {
    const earned = 50 + level * 10; // ten new achievements a life
    bank += calculatePrestigePoints(
      lifeAtPrestige(earned),
      getPrestigeThreshold(level) * mult,
      prestigeAt(level, level === 0 ? 0 : earned - 10),
      'reset',
    ).total;
  }
  if (lives >= 1) bank += oneTimeReward('prestige_first');
  if (lives >= 5) bank += oneTimeReward('prestige_5');
  return bank;
}

describe('what a prestige is worth against the shop it pays into', () => {
  it('a prestige at the first threshold pays the 10,000 base points the shop is priced on', () => {
    expect(BASE_PRESTIGE_THRESHOLD).toBe(10_000_000);
    expect(base(BASE_PRESTIGE_THRESHOLD)).toBe(10_000); // was 1,000
  });

  it('a realistic first prestige buys a median-priced bonus', () => {
    expect(medianPrice).toBe(6_000); // the anchor; re-measure if the shop is repriced
    const first = calculatePrestigePoints(
      lifeAtPrestige(50), BASE_PRESTIGE_THRESHOLD, prestigeAt(0, 0), 'reset',
    ).total + oneTimeReward('prestige_first');
    // Old formula: 1,527 + 1,000 = 2,527 - under half the median price.
    expect(first).toBeGreaterThanOrEqual(medianPrice);
  });

  it('five prestiges at the threshold afford a legendary', () => {
    // Old formula: ~18k banked, against a 25,000 cheapest legendary.
    expect(bankedAfter(5, 1)).toBeGreaterThanOrEqual(cheapestLegendary);
  });

  it('still leaves a long tail: five lives at 5x the threshold buy under half the shop', () => {
    expect(bankedAfter(5, 5)).toBeLessThan(shopFirstLevels / 2);
  });

  it('later prestiges pay more than earlier ones at their own thresholds', () => {
    const atOwnThreshold = (level: number) =>
      calculatePrestigePoints(lifeAtPrestige(50), getPrestigeThreshold(level), prestigeAt(level, 50), 'reset').total;
    expect(atOwnThreshold(1)).toBeGreaterThan(atOwnThreshold(0));
    expect(atOwnThreshold(4)).toBeGreaterThan(atOwnThreshold(1));
  });
});

describe('the net-worth curve', () => {
  it('is linear up to the threshold: 1,000 points per $1M', () => {
    expect(base(1_000_000)).toBe(1_000);
    expect(base(5_000_000)).toBe(5_000);
  });

  it('bends to a square root past it: 4x the net worth pays 2x the points', () => {
    expect(base(40_000_000)).toBe(20_000);
    expect(base(1_000_000_000)).toBe(100_000);
    // One long $100M life is worth ~3 threshold lives, not 10 - the linear
    // 1,000/$1M alternative would have paid 100,000 here.
    expect(base(100_000_000)).toBeLessThan(10 * base(BASE_PRESTIGE_THRESHOLD));
  });

  it('never pays fewer points than the pre-retune 100 per $1M, at any net worth', () => {
    const sweep = [
      0, 1, 999_999, 1_000_000, 4_500_000, 9_999_999, 10_000_000, 12_500_000,
      40_000_000, 100_000_000, 999_999_999, 1_000_000_000, 2_500_000_000, 10_000_000_000,
    ];
    for (const nw of sweep) {
      expect(base(nw)).toBeGreaterThanOrEqual(Math.floor(nw / 1_000_000) * 100);
    }
    // Past $1B the old line is the higher one, and it is what pays.
    expect(base(2_500_000_000)).toBe(250_000);
  });

  it('pays nothing for debt or a corrupt figure', () => {
    expect(base(-5_000_000)).toBe(0);
    expect(base(Number.NaN)).toBe(0);
    expect(base(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('Family Business (starting_company) beside a carried family business', () => {
  const carried = (id: Company['type']): Company => ({
    id,
    name: 'Carried',
    type: id,
    weeklyIncome: 5_000,
    baseWeeklyIncome: 5_000,
    upgrades: [],
    employees: 0,
    workerSalary: 2_000,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  });

  it('grants the factory when the dynasty carried a different company type', () => {
    // Both prestige paths carry family businesses in BEFORE bonuses apply;
    // the old "no companies at all" guard made this 15,000-point epic grant
    // nothing to any dynasty holding one.
    const ai = carried('ai');
    const state = createTestGameState({ companies: [ai], company: ai });
    const out = applyStartingBonuses(state, ['starting_company']);
    expect(out.companies.map(c => c.id).sort()).toEqual(['ai', 'factory']);
    expect(out.company?.id).toBe('ai'); // the carried business stays active
  });

  it('does not duplicate a carried factory', () => {
    const factory = carried('factory');
    const state = createTestGameState({ companies: [factory], company: factory });
    const out = applyStartingBonuses(state, ['starting_company']);
    expect(out.companies).toHaveLength(1);
    expect(out.companies[0].name).toBe('Carried');
  });

  it('still grants it on an empty start, as the active company', () => {
    const out = applyStartingBonuses(createTestGameState({ companies: [] }), ['starting_company']);
    expect(out.companies.map(c => c.id)).toEqual(['factory']);
    expect(out.company?.id).toBe('factory');
  });
});
