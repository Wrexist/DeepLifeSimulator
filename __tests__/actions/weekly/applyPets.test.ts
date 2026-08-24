/**
 * Unit tests for the WIRED pet weekly tick (Wave A — PetApp depth).
 *
 * `tickPetsForWeek` now routes through the real, unit-tested care engine
 * (`lib/pets/decay.ts` → `tickAllPets`) instead of the old flat approximation.
 * These tests assert the four UI-vs-mechanics lies the swap fixes:
 *   1. vaccination halves the illness roll (the paid $200 service now bites),
 *   2. breed-specific hunger decay applies (a turtle ≠ a dog),
 *   3. per-sickness `healthDrain` matters (a Cold ≠ an Infection),
 *   4. passive energy recovery finally happens,
 * plus the reconciled 3-week zero-health death threshold (mortality baseline).
 *
 * `applyPetLivingSideEffects` now applies the `bondingSummary` deltas the
 * "Companion bonus" card already displays — capped per the economy guardrail.
 */
import {
  tickPetsForWeek,
  applyPetLivingSideEffects,
  applyPetDeathSideEffects,
  PET_WEEKLY_FOOD_COST,
  PET_BONDING_HAPPINESS_CAP,
  PET_BONDING_HEALTH_CAP,
  PET_ZERO_HEALTH_DEATH_WEEKS,
} from '@/contexts/game/actions/weekly/applyPets';
import { bondingSummary } from '@/lib/pets/bonding';
import type { Pet, GameStats } from '@/contexts/game/types';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'p1',
    name: 'Rex',
    type: 'dog',
    age: 5 * 52,
    hunger: 100,
    happiness: 100,
    health: 100,
    energy: 100,
    ...over,
  } as Pet;
}

const noSick = { petSickness: [0.99], petSicknessType: [0] };
const alwaysSick = { petSickness: [0], petSicknessType: [0] };

function stubStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 100,
    money: 10000,
    reputation: 50,
    gems: 0,
    ...overrides,
  } as GameStats;
}

function stubCtx(stats: GameStats): WeekContext {
  return {
    newStats: stats,
    notifications: [] as WeekNotification[],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 100,
  };
}

describe('tickPetsForWeek - routed through the real decay engine', () => {
  it('returns [] for empty / undefined / null input', () => {
    expect(tickPetsForWeek([], noSick)).toEqual([]);
    expect(tickPetsForWeek(undefined, noSick)).toEqual([]);
    expect(tickPetsForWeek(null, noSick)).toEqual([]);
  });

  it('applies breed-specific hunger decay (dog eats more than turtle)', () => {
    const dog = tickPetsForWeek([pet({ id: 'd', type: 'dog', hunger: 100 })], noSick)[0];
    const turtle = tickPetsForWeek([pet({ id: 't', type: 'turtle', hunger: 100 })], noSick)[0];
    // adult dog base 12/wk vs turtle base 3/wk → dog drops more.
    expect(100 - (dog.hunger ?? 0)).toBeGreaterThan(100 - (turtle.hunger ?? 0));
  });

  it('recovers passive energy for a rested pet (old tick never did)', () => {
    const [p] = tickPetsForWeek([pet({ energy: 40 })], noSick);
    expect(p.energy ?? 0).toBeGreaterThan(40);
  });

  it('a vaccinated pet resists the illness roll a bare pet would catch', () => {
    // Roll 0.02: unvaccinated adult dog (0.025) falls sick; vaccinated (0.0125) does not.
    const roll = { petSickness: [0.02], petSicknessType: [0.5] };
    const bare = tickPetsForWeek([pet({ id: 'b', vaccinated: false, health: 100 })], roll)[0];
    const vaxxed = tickPetsForWeek([pet({ id: 'v', vaccinated: true, health: 100 })], roll)[0];
    expect(bare.isSick).toBe(true);
    expect(vaxxed.isSick).toBeFalsy();
  });

  it('drains health per the sickness catalog (infection worse than cold)', () => {
    const infection = tickPetsForWeek([pet({ isSick: true, sickness: 'infection', health: 100 })], noSick)[0];
    const cold = tickPetsForWeek([pet({ isSick: true, sickness: 'cold', health: 100 })], noSick)[0];
    expect(100 - (infection.health ?? 0)).toBeGreaterThan(100 - (cold.health ?? 0));
  });

  it('preserves the 3-week zero-health death grace (mortality baseline)', () => {
    expect(PET_ZERO_HEALTH_DEATH_WEEKS).toBe(3);
    // At 2 weeks of zero health, this tick reaches 3 → death.
    const dying = pet({ hunger: 0, health: 0, weeksAtZeroHealth: 2 });
    const [dead] = tickPetsForWeek([dying], noSick);
    expect(dead.isDead).toBe(true);
    // At 1 week, this tick reaches 2 → survives (would die under the engine's default of 2).
    const surviving = pet({ id: 'p2', hunger: 0, health: 0, weeksAtZeroHealth: 1 });
    const [alive] = tickPetsForWeek([surviving], noSick);
    expect(alive.isDead).toBeFalsy();
  });

  it('leaves dead pets untouched', () => {
    const ghost = pet({ isDead: true, age: 200, health: 0 });
    const [out] = tickPetsForWeek([ghost], alwaysSick);
    expect(out.isDead).toBe(true);
    expect(out.age).toBe(200);
  });

  it('a pet beyond the pre-roll length still gets a valid (wrapped) roll', () => {
    // 12 pets, roll buffer length 10, all guaranteed-sick draws.
    const pets = Array.from({ length: 12 }, (_, i) => pet({ id: `p${i}`, health: 100 }));
    const rolls = {
      petSickness: Array.from({ length: 10 }, () => 0),
      petSicknessType: Array.from({ length: 10 }, () => 0.1),
    };
    const out = tickPetsForWeek(pets, rolls);
    expect(out[11].isSick).toBe(true);
    expect(out[11].sickness).toBeDefined();
  });

  it('an empty roll buffer keeps pets healthy (no crash, no NaN)', () => {
    const out = tickPetsForWeek([pet({ id: 'a' }), pet({ id: 'b' })], { petSickness: [], petSicknessType: [] });
    expect(out.every((p) => !p.isSick)).toBe(true);
  });
});

describe('applyPetLivingSideEffects - capped bonding + food cost', () => {
  it('applies bondingSummary happiness + health deltas for a well-cared roster', () => {
    const pets = [
      pet({ id: 'p1', happiness: 90, health: 90 }),
      pet({ id: 'p2', happiness: 88, health: 85 }),
    ];
    const summary = bondingSummary(pets);
    expect(summary.playerHappinessDelta).toBeGreaterThan(0);
    expect(summary.playerHealthDelta).toBeGreaterThan(0);

    const ctx = stubCtx(stubStats({ happiness: 50, health: 50, money: 1000 }));
    applyPetLivingSideEffects(pets, ctx);
    expect(ctx.newStats.happiness).toBe(50 + Math.min(PET_BONDING_HAPPINESS_CAP, summary.playerHappinessDelta));
    expect(ctx.newStats.health).toBe(50 + Math.min(PET_BONDING_HEALTH_CAP, summary.playerHealthDelta));
    // Food cost still deducts per alive pet.
    expect(ctx.newStats.money).toBe(1000 - pets.length * PET_WEEKLY_FOOD_COST);
  });

  it('a neglected roster saps player happiness (never possible under the old flat rule)', () => {
    const pets = [
      pet({ id: 'p1', happiness: 10, health: 15 }),
      pet({ id: 'p2', happiness: 5, health: 20 }),
    ];
    const ctx = stubCtx(stubStats({ happiness: 60, money: 1000 }));
    applyPetLivingSideEffects(pets, ctx);
    expect(ctx.newStats.happiness).toBeLessThan(60);
    // But never below the negative cap.
    expect(ctx.newStats.happiness).toBeGreaterThanOrEqual(60 - PET_BONDING_HAPPINESS_CAP);
  });

  it('caps the weekly happiness delta even with a huge happy roster', () => {
    const pets = Array.from({ length: 40 }, (_, i) => pet({ id: `p${i}`, happiness: 90, health: 90 }));
    const ctx = stubCtx(stubStats({ happiness: 50, health: 50, money: 100000 }));
    applyPetLivingSideEffects(pets, ctx);
    expect(ctx.newStats.happiness).toBe(50 + PET_BONDING_HAPPINESS_CAP);
    expect(ctx.newStats.health).toBe(50 + PET_BONDING_HEALTH_CAP);
  });

  it('health is only ever boosted by pets, never drained (floor 0 on the delta)', () => {
    const pets = [pet({ id: 'p1', happiness: 10, health: 10 })]; // neglected → negative happiness
    const ctx = stubCtx(stubStats({ happiness: 60, health: 40, money: 1000 }));
    applyPetLivingSideEffects(pets, ctx);
    expect(ctx.newStats.health).toBe(40); // unchanged - no negative health from pets
  });

  it('dead pets contribute no bonus and no food cost', () => {
    const pets = [pet({ id: 'p1', isDead: true, health: 0, happiness: 0 })];
    const ctx = stubCtx(stubStats({ happiness: 50, health: 50, money: 1000 }));
    applyPetLivingSideEffects(pets, ctx);
    expect(ctx.newStats.happiness).toBe(50);
    expect(ctx.newStats.health).toBe(50);
    expect(ctx.newStats.money).toBe(1000);
  });
});

describe('applyPetDeathSideEffects - unchanged mourning behavior', () => {
  it('mourns a newly-dead pet with -20 happiness + a notification', () => {
    const prev = [pet({ id: 'p1', health: 0, weeksAtZeroHealth: 2 })];
    const updated = [{ ...prev[0], isDead: true }];
    const ctx = stubCtx(stubStats({ happiness: 80 }));
    applyPetDeathSideEffects(prev, updated, ctx);
    expect(ctx.newStats.happiness).toBe(60);
    expect(ctx.notifications).toHaveLength(1);
  });
});
