/**
 * Food satiety (v48) — the diminishing-returns curve that closed the
 * uncapped ~$1.60/point money->energy conversion. See
 * lib/economy/foodSatiety.ts for the design reasoning.
 */
import {
  foodEffectMultiplier,
  scaledFoodRestore,
  satietyHint,
  FULL_STRENGTH_MEALS_PER_WEEK,
} from '../foodSatiety';
import { resolveFoodPurchase } from '../foodPurchase';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('foodEffectMultiplier', () => {
  it('meals 1-3 are full strength, 4-6 half, 7+ quarter', () => {
    expect(foodEffectMultiplier(0)).toBe(1);
    expect(foodEffectMultiplier(2)).toBe(1);
    expect(foodEffectMultiplier(3)).toBe(0.5);
    expect(foodEffectMultiplier(5)).toBe(0.5);
    expect(foodEffectMultiplier(6)).toBe(0.25);
    expect(foodEffectMultiplier(40)).toBe(0.25);
  });

  it('treats an absent counter (pre-v48 save, fresh week) as full strength', () => {
    expect(foodEffectMultiplier(undefined)).toBe(1);
    expect(foodEffectMultiplier(Number.NaN)).toBe(1);
  });
});

describe('scaledFoodRestore', () => {
  it('scales through the curve and rounds', () => {
    expect(scaledFoodRestore(25, 0)).toBe(25);
    expect(scaledFoodRestore(25, 4)).toBe(13); // half, rounded
    expect(scaledFoodRestore(25, 10)).toBe(6); // quarter, rounded
  });

  it('a positive restore never scales to a pure no-op', () => {
    expect(scaledFoodRestore(2, 10)).toBe(1);
  });

  it('non-positive and malformed restores stay 0', () => {
    expect(scaledFoodRestore(0, 0)).toBe(0);
    expect(scaledFoodRestore(-5, 0)).toBe(0);
    expect(scaledFoodRestore(Number.NaN, 0)).toBe(0);
  });
});

describe('satietyHint', () => {
  it('is silent at full strength (the normal state)', () => {
    expect(satietyHint(0)).toBeNull();
    expect(satietyHint(FULL_STRENGTH_MEALS_PER_WEEK - 1)).toBeNull();
    expect(satietyHint(undefined)).toBeNull();
  });

  it('names the reduced tiers', () => {
    expect(satietyHint(3)).toContain('half');
    expect(satietyHint(8)).toContain('barely');
  });

  it('closes the printer: ten steaks now buy a fraction of the old energy', () => {
    // Old behavior: 10 x +25 = 250 energy for $400. Now: 3 full + 3 half +
    // 4 quarter = 75 + 39 + 24 — and energy clamps at 100 anyway.
    let total = 0;
    for (let eaten = 0; eaten < 10; eaten++) total += scaledFoodRestore(25, eaten);
    expect(total).toBeLessThan(145);
  });
});

describe('resolveFoodPurchase — the C-9 pure resolution', () => {
  const stateWith = (money: number, eaten = 0) =>
    createTestGameState({
      stats: { money, health: 40, energy: 40, happiness: 40, fitness: 30, reputation: 0, gems: 0 },
      weeklyFoodPurchases: eaten,
      foods: [
        { id: 'steak', name: 'Steak Dinner', price: 40, healthRestore: 20, energyRestore: 25 } as never,
      ],
    });

  it('charges, restores and bumps the counter in one resolution', () => {
    const r = resolveFoodPurchase(stateWith(1000), 'steak');
    expect(r.ok).toBe(true);
    expect(r.next.stats.money).toBe(1000 - r.price);
    expect(r.next.stats.energy).toBe(40 + 25);
    expect(r.next.weeklyFoodPurchases).toBe(1);
    expect(r.applied.energy).toBe(25);
  });

  it('refuses the unaffordable and the unknown, returning the SAME state', () => {
    const broke = stateWith(1);
    const refusal = resolveFoodPurchase(broke, 'steak');
    expect(refusal.ok).toBe(false);
    expect(refusal.next).toBe(broke);
    expect(resolveFoodPurchase(stateWith(1000), 'no_such_food').ok).toBe(false);
  });

  it('a chained double purchase scales the SECOND meal by the first meal\'s counter', () => {
    const first = resolveFoodPurchase(stateWith(1000, 2), 'steak'); // 3rd meal: full
    expect(first.applied.energy).toBe(25);
    const second = resolveFoodPurchase(first.next, 'steak'); // 4th meal: half
    expect(second.ok).toBe(true);
    expect(second.applied.energy).toBe(13);
    expect(second.next.weeklyFoodPurchases).toBe(4);
  });
});
