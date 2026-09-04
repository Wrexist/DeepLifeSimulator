/**
 * The food purchase, as a pure resolution — the C-9 sound shape.
 *
 * One function decides everything about buying a meal: the inflated price,
 * the affordability gate, the satiety-scaled restores (v48) and the counter
 * bump. The action calls it TWICE — once on the snapshot for the preview the
 * toast reports, once inside the updater for the state that commits — so no
 * cross-updater variable exists to go stale, and a same-batch double tap
 * simply resolves the second meal against the first meal's committed state
 * (correct price gate, correct satiety tier). CLAUDE.md §4.1/§4.4; the
 * worked exemplar is `purchaseLifeSkill` (C-10).
 */
import type { GameState } from '@/contexts/game/types';
import { scaledHappinessGain } from '@/lib/economy/happinessGain';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { scaledFoodRestore } from '@/lib/economy/foodSatiety';

export interface FoodPurchaseResolution {
  ok: boolean;
  /** Why a refusal refused — for logging; the UI gates on `ok`. */
  reason?: 'not_found' | 'unaffordable';
  /** The state to commit. IS the input state (same reference) on refusal. */
  next: GameState;
  /** What this meal restores, after the satiety curve. */
  applied: { health: number; energy: number; happiness: number };
  /** The inflated price the meal costs. */
  price: number;
  /** Meals bought this week INCLUDING this one (feeds the satiety hint). */
  purchasesAfter: number;
}

export function resolveFoodPurchase(state: GameState, foodId: string): FoodPurchaseResolution {
  const refuse = (reason: FoodPurchaseResolution['reason']): FoodPurchaseResolution => ({
    ok: false,
    reason,
    next: state,
    applied: { health: 0, energy: 0, happiness: 0 },
    price: 0,
    purchasesAfter: state.weeklyFoodPurchases || 0,
  });

  const food = state.foods?.find((f) => f.id === foodId);
  if (!food) return refuse('not_found');

  // F5: food is charged at the same inflated price the label shows and the
  // affordability gate checks — see the note in ItemActionsContext.
  const price = getInflatedPrice(food.price, state.economy?.priceIndex ?? 1);
  if ((state.stats.money ?? 0) < price) return refuse('unaffordable');

  const eatenBefore = state.weeklyFoodPurchases || 0;
  const applied = {
    health: scaledFoodRestore(food.healthRestore, eatenBefore),
    energy: scaledFoodRestore(food.energyRestore, eatenBefore),
    happiness: scaledFoodRestore(Math.max(1, Math.round(food.healthRestore / 2)), eatenBefore),
  };

  return {
    ok: true,
    next: {
      ...state,
      stats: {
        ...state.stats,
        money: (state.stats.money ?? 0) - price,
        health: Math.min(100, (state.stats.health ?? 0) + applied.health),
        energy: Math.min(100, (state.stats.energy ?? 0) + applied.energy),
        happiness: Math.min(100, (state.stats.happiness ?? 0)
      + scaledHappinessGain(state.stats.happiness ?? 0, applied.happiness)),
      },
      weeklyFoodPurchases: eatenBefore + 1,
    },
    applied,
    price,
    purchasesAfter: eatenBefore + 1,
  };
}
