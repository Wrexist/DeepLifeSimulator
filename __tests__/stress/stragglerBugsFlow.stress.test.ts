/**
 * Straggler bugs round — covers three latent bugs found during the final
 * pre-ship sweep:
 *  - BUGFIX #28: lifeExpectancy used `||` instead of `??`, masking dying
 *    players (health=0) as fully healthy in the UI.
 *  - BUGFIX #29: calculatePatentIncome / updatePatents crashed on undefined
 *    patents array (fresh companies have no patents field).
 *  - BUGFIX #30: retirementCalculator divided by withdrawalRate without
 *    guarding against 0 → Infinity propagated through savingsGap.
 *
 * Also pins a few invariants in untouched modules (housing weekly tick,
 * spark match probability, FIRE tracker) so a regression in those areas
 * cannot land silently.
 */

import { calculateLifeExpectancy } from '@/lib/statistics/lifeExpectancy';
import {
  calculatePatentIncome,
  updatePatents,
  createPatent,
  type Patent,
} from '@/lib/rd/patents';
import { calculateRetirementPlanning } from '@/lib/statistics/retirementCalculator';
import { calculateFIRETracker } from '@/lib/statistics/fireTracker';
import {
  processWeeklyHousing,
  calculatePropertyHappiness,
  appreciatePropertyValue,
  getUpgradeTier,
} from '@/lib/realEstate/housing';
import {
  calculateMatchProbability,
  calculateCatfishProbability,
  swipesRemaining,
  superLikesRemaining,
  scorePlayerProfile,
  perksForTier,
} from '@/lib/dating/sparkLogic';
import { createTestGameState } from '../helpers/createTestGameState';
import type { RealEstate } from '@/contexts/game/types';

// ---------------------------------------------------------------------------
// Life expectancy — BUGFIX #28
// ---------------------------------------------------------------------------
describe('Life expectancy — BUGFIX #28', () => {
  it('correctly treats health=0 as worst case (NOT as 100 via || fallback)', () => {
    const dying = createTestGameState({
      stats: { ...createTestGameState().stats, health: 0, happiness: 0 },
    });
    const healthy = createTestGameState({
      stats: { ...createTestGameState().stats, health: 100, happiness: 100 },
    });
    const dyingR = calculateLifeExpectancy(dying);
    const healthyR = calculateLifeExpectancy(healthy);
    expect(dyingR.totalLifeExpectancy).toBeLessThan(healthyR.totalLifeExpectancy);
    expect(dyingR.healthModifier).toBeLessThan(0);
    expect(dyingR.happinessModifier).toBeLessThan(0);
  });

  it('uses default 100 only when health is truly undefined', () => {
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, health: undefined as any, happiness: undefined as any },
    });
    const r = calculateLifeExpectancy(state);
    expect(Number.isFinite(r.totalLifeExpectancy)).toBe(true);
    expect(r.healthModifier).toBe(25); // (100 - 50) * 0.5
    expect(r.happinessModifier).toBe(15); // (100 - 50) * 0.3
  });

  it('never returns negative yearsRemaining', () => {
    const ancient = createTestGameState({
      date: { ...createTestGameState().date, age: 200 },
      stats: { ...createTestGameState().stats, health: 10, happiness: 10 },
    });
    const r = calculateLifeExpectancy(ancient);
    expect(r.yearsRemaining).toBeGreaterThanOrEqual(0);
  });

  it('recommendations populated based on stat thresholds', () => {
    const lowAll = createTestGameState({
      stats: { ...createTestGameState().stats, health: 50, happiness: 50, fitness: 20 },
    });
    const r = calculateLifeExpectancy(lowAll);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('100 random states never produce non-finite output', () => {
    for (let i = 0; i < 100; i++) {
      const r = calculateLifeExpectancy(createTestGameState({
        stats: {
          ...createTestGameState().stats,
          health: Math.random() * 100,
          happiness: Math.random() * 100,
          fitness: Math.random() * 100,
        },
        date: { ...createTestGameState().date, age: 18 + Math.random() * 80 },
      }));
      expect(Number.isFinite(r.totalLifeExpectancy)).toBe(true);
      expect(Number.isFinite(r.yearsRemaining)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Patent income — BUGFIX #29
// ---------------------------------------------------------------------------
describe('Patent income — BUGFIX #29', () => {
  it('calculatePatentIncome: returns 0 for undefined patents (legacy company)', () => {
    expect(calculatePatentIncome(undefined as any)).toBe(0);
    expect(calculatePatentIncome(null as any)).toBe(0);
  });

  it('calculatePatentIncome: returns 0 for empty array', () => {
    expect(calculatePatentIncome([])).toBe(0);
  });

  it('calculatePatentIncome: sums active patents only', () => {
    const patents: Patent[] = [
      { id: 'p1', technologyId: 't1', name: 'A', filedWeek: 0, weeklyIncome: 100, duration: 10, totalDuration: 10 },
      { id: 'p2', technologyId: 't2', name: 'B', filedWeek: 0, weeklyIncome: 200, duration: 0, totalDuration: 10 }, // expired
      { id: 'p3', technologyId: 't3', name: 'C', filedWeek: 0, weeklyIncome: 50, duration: 5, totalDuration: 10 },
    ];
    expect(calculatePatentIncome(patents)).toBe(150); // 100 + 50
  });

  it('calculatePatentIncome: ignores patents with NaN weeklyIncome', () => {
    const patents = [
      { id: 'p1', technologyId: 't1', name: 'A', filedWeek: 0, weeklyIncome: NaN, duration: 10, totalDuration: 10 },
      { id: 'p2', technologyId: 't2', name: 'B', filedWeek: 0, weeklyIncome: 100, duration: 5, totalDuration: 10 },
    ];
    expect(calculatePatentIncome(patents)).toBe(100);
  });

  it('updatePatents: handles undefined input', () => {
    expect(updatePatents(undefined as any)).toEqual([]);
  });

  it('updatePatents: decrements duration and removes expired', () => {
    const patents: Patent[] = [
      { id: 'p1', technologyId: 't1', name: 'A', filedWeek: 0, weeklyIncome: 100, duration: 1, totalDuration: 10 },
      { id: 'p2', technologyId: 't2', name: 'B', filedWeek: 0, weeklyIncome: 200, duration: 5, totalDuration: 10 },
    ];
    const r = updatePatents(patents);
    expect(r.length).toBe(1); // p1 expires after this tick
    expect(r[0].id).toBe('p2');
    expect(r[0].duration).toBe(4);
  });

  it('updatePatents: 100 tick lifecycle expires patents naturally', () => {
    let patents: Patent[] = [
      createPatent('automation_lvl1', 'Automation v1', 0, 'basic'),
      createPatent('quantum_computing', 'QC', 0, 'cutting_edge'),
    ];
    for (let i = 0; i < 100; i++) {
      patents = updatePatents(patents);
    }
    expect(patents.length).toBe(0); // all expired
  });
});

// ---------------------------------------------------------------------------
// Retirement calculator — BUGFIX #30
// ---------------------------------------------------------------------------
describe('Retirement calculator — BUGFIX #30', () => {
  it('does not produce Infinity when withdrawalRate is 0', () => {
    const state = createTestGameState();
    const r = calculateRetirementPlanning(state, 65, 7, 3, 0);
    expect(Number.isFinite(r.requiredNetWorth)).toBe(true);
    expect(Number.isFinite(r.savingsGap)).toBe(true);
    expect(Number.isFinite(r.monthlySavingsNeeded)).toBe(true);
  });

  it('handles negative withdrawalRate by defaulting to 4', () => {
    const state = createTestGameState();
    const r1 = calculateRetirementPlanning(state, 65, 7, 3, -5);
    const r2 = calculateRetirementPlanning(state, 65, 7, 3, 4);
    expect(r1.requiredNetWorth).toBe(r2.requiredNetWorth);
  });

  it('yearsToRetirement clamps at 0 for older players', () => {
    const old = createTestGameState({
      date: { ...createTestGameState().date, age: 80 },
    });
    const r = calculateRetirementPlanning(old, 65);
    expect(r.yearsToRetirement).toBe(0);
    expect(r.monthlySavingsNeeded).toBe(0);
  });

  it('fuzz: 100 random inputs always finite', () => {
    for (let i = 0; i < 100; i++) {
      const state = createTestGameState({
        date: { ...createTestGameState().date, age: 18 + Math.random() * 80 },
        stats: { ...createTestGameState().stats, money: Math.random() * 1_000_000 },
      });
      const r = calculateRetirementPlanning(
        state,
        50 + Math.random() * 40,
        Math.random() * 15,
        Math.random() * 10,
        Math.random() * 10,
      );
      expect(Number.isFinite(r.requiredNetWorth)).toBe(true);
      expect(Number.isFinite(r.savingsGap)).toBe(true);
      expect(Number.isFinite(r.monthlySavingsNeeded)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// FIRE tracker — verify no crashes / NaN
// ---------------------------------------------------------------------------
describe('FIRE tracker', () => {
  it('returns finite values for default state', () => {
    const r = calculateFIRETracker(createTestGameState());
    expect(Number.isFinite(r.fireNumber)).toBe(true);
    expect(Number.isFinite(r.currentNetWorth)).toBe(true);
    expect(Number.isFinite(r.progressToFIRE)).toBe(true);
    expect(Number.isFinite(r.savingsRate)).toBe(true);
  });

  it('yearsToFIRE caps at 999 instead of Infinity', () => {
    const broke = createTestGameState({
      stats: { ...createTestGameState().stats, money: 0 },
      bankSavings: 0,
    });
    const r = calculateFIRETracker(broke);
    expect(r.yearsToFIRE).toBeLessThanOrEqual(999);
  });

  it('achieved flag flips once net worth crosses FIRE number', () => {
    const rich = createTestGameState({
      stats: { ...createTestGameState().stats, money: 100_000_000 },
    });
    const r = calculateFIRETracker(rich);
    expect(r.milestones.achieved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Housing weekly tick — pin invariants
// ---------------------------------------------------------------------------
describe('Housing weekly tick', () => {
  const baseProp: RealEstate = {
    id: 'p1', name: 'Test House', price: 200_000, weeklyHappiness: 0, weeklyEnergy: 0,
    owned: true, interior: [], upgradeLevel: 0, rent: 0, upkeep: 100,
  } as any;

  it('processWeeklyHousing: only mutates owned properties', () => {
    const unowned = { ...baseProp, owned: false, condition: 100 };
    const r = processWeeklyHousing([unowned], 10);
    expect(r.properties[0].condition).toBe(100); // not decayed
  });

  it('processWeeklyHousing: condition decays for owned property', () => {
    const r = processWeeklyHousing([{ ...baseProp, condition: 100 } as any], 10);
    expect(r.properties[0].condition).toBeLessThan(100);
    expect(r.properties[0].condition).toBeGreaterThanOrEqual(0);
  });

  it('processWeeklyHousing: handles empty array', () => {
    const r = processWeeklyHousing([], 10);
    expect(r.properties).toEqual([]);
    expect(r.totalHappinessBonus).toBe(0);
    expect(r.totalRentalIncome).toBe(0);
  });

  it('processWeeklyHousing: 100 ticks keeps condition in [0, 100]', () => {
    let props: RealEstate[] = [{ ...baseProp, condition: 100, currentValue: 200_000 } as any];
    for (let w = 1; w <= 100; w++) {
      const r = processWeeklyHousing(props, w);
      props = r.properties;
      expect(props[0].condition).toBeGreaterThanOrEqual(0);
      expect(props[0].condition).toBeLessThanOrEqual(100);
    }
  });

  it('calculatePropertyHappiness: returns 0 when not current residence', () => {
    const p = { ...baseProp, currentResidence: false } as RealEstate;
    expect(calculatePropertyHappiness(p)).toBe(0);
  });

  it('calculatePropertyHappiness: penalty applies when condition < 50', () => {
    const high = calculatePropertyHappiness({ ...baseProp, currentResidence: true, weeklyHappiness: 10, condition: 100 } as any);
    const low = calculatePropertyHappiness({ ...baseProp, currentResidence: true, weeklyHappiness: 10, condition: 25 } as any);
    expect(low).toBeLessThan(high);
  });

  it('appreciatePropertyValue: poor condition causes depreciation', () => {
    const good = appreciatePropertyValue({ ...baseProp, currentValue: 200_000, condition: 100 } as any);
    const bad = appreciatePropertyValue({ ...baseProp, currentValue: 200_000, condition: 25 } as any);
    expect(good).toBeGreaterThan(200_000);
    expect(bad).toBeLessThan(200_000);
  });

  it('getUpgradeTier: returns undefined for invalid level', () => {
    expect(getUpgradeTier(99)).toBeUndefined();
    expect(getUpgradeTier(-1)).toBeUndefined();
    expect(getUpgradeTier(0)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Spark dating logic — pin invariants
// ---------------------------------------------------------------------------
describe('Spark dating logic', () => {
  const baseProfile = {
    id: 'pf1', name: 'Test', age: 25, photos: ['photo1'],
    bio: 'normal bio', interests: ['movies'],
    job: 'Engineer', income: 50_000, wealth: 'middle' as const,
    personality: 'friendly' as const,
  };

  it('calculateMatchProbability: clamps to [0.05, 0.95]', () => {
    for (let i = 0; i < 100; i++) {
      const state = createTestGameState({
        stats: { ...createTestGameState().stats, reputation: Math.random() * 200, money: Math.random() * 1_000_000 },
      });
      const p = calculateMatchProbability(state, baseProfile);
      expect(p).toBeGreaterThanOrEqual(0.05);
      expect(p).toBeLessThanOrEqual(0.95);
    }
  });

  it('calculateMatchProbability: NaN-safe for undefined fields', () => {
    const broken = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: undefined as any, money: undefined as any },
    });
    const p = calculateMatchProbability(broken, baseProfile);
    expect(Number.isFinite(p)).toBe(true);
  });

  it('calculateCatfishProbability: scam-y bios get higher score', () => {
    const cleanBio = calculateCatfishProbability({ ...baseProfile, bio: 'love hiking' });
    const scamBio = calculateCatfishProbability({ ...baseProfile, bio: 'send me cashapp invest crypto sugar' });
    expect(scamBio).toBeGreaterThan(cleanBio);
  });

  it('swipesRemaining: returns 0 when no sparkApp', () => {
    expect(swipesRemaining(createTestGameState({ sparkApp: undefined as any }))).toBe(0);
  });

  it('swipesRemaining: returns Infinity for unlimited premium', () => {
    const state = createTestGameState({
      sparkApp: {
        swipesUsedThisWeek: 100,
        premium: { active: true, tier: 'plus', perks: perksForTier('plus') } as any,
      } as any,
    });
    expect(swipesRemaining(state)).toBe(Number.POSITIVE_INFINITY);
  });

  it('superLikesRemaining: respects per-tier cap', () => {
    const state = createTestGameState({
      sparkApp: {
        superLikesUsedThisWeek: 5,
        premium: { active: false, tier: 'free', perks: perksForTier('free') } as any,
      } as any,
    });
    expect(superLikesRemaining(state)).toBe(0); // free tier = 1, used 5, max(0, 1-5) = 0
  });

  it('scorePlayerProfile: stays in [0, 100]', () => {
    for (let i = 0; i < 50; i++) {
      const state = createTestGameState({
        sparkApp: {
          profile: {
            bio: 'a'.repeat(Math.floor(Math.random() * 200)),
            photos: Array.from({ length: Math.floor(Math.random() * 10) }, (_, j) => `p${j}`),
            interests: Array.from({ length: Math.floor(Math.random() * 8) }, (_, j) => `i${j}`),
            showAge: true, showJob: true, showWealth: false,
          },
          premium: { active: false, tier: 'free', perks: perksForTier('free') } as any,
        } as any,
        stats: { ...createTestGameState().stats, reputation: Math.random() * 100, money: Math.random() * 10_000_000 },
      });
      const s = scorePlayerProfile(state);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('perksForTier: each tier returns a deep copy (mutation safety)', () => {
    const a = perksForTier('plus');
    const b = perksForTier('plus');
    a.boostMultiplier = 999;
    expect(b.boostMultiplier).not.toBe(999); // independent objects
  });
});
