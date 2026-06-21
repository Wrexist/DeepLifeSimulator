/**
 * Pets weekly tick — pure helper for the `nextWeek()` pipeline.
 * R7 Phase 2 step 2.2a.
 *
 * Scope: ONLY the per-pet state update (aging, hunger, happiness/health
 * decay, sickness roll, death check). The side effects that the old inline
 * code performed AFTER the .map() — pet-death player-happiness penalty,
 * pet-death notifications, alive-pet happiness bonus — STAY in
 * `GameActionsContext.tsx` for now because they mutate the running
 * `newStats` accumulator and push to `pendingNotifications`. Both will
 * move out in Phase 2 step 2.3 / 2.6 when the WeekContext shape exists.
 *
 * Pure function. Byte-identical output to the previous inline code
 * (verified by snapshot tests in `__tests__/refactor/`).
 */

import type { Pet } from '@/contexts/game/types';
import { PET_LIFESPANS, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import type { WeekContext } from './weekContext';

/** Weekly food cost per alive pet (USD). Matches the legacy inline constant. */
export const PET_WEEKLY_FOOD_COST = 15;

/**
 * Roll inputs the tick consumes — these come from the `preRolls` object
 * pre-rolled at the top of `nextWeek` so React StrictMode's double-invoke
 * produces identical results.
 */
export interface PetTickRolls {
  /** One roll per pet, up to 20. Compared against 0.06 (low health) / 0.02. */
  petSickness: number[];
  /** One roll per pet, up to 20. Picks the sickness type from a fixed list. */
  petSicknessType: number[];
}

/**
 * Apply the per-week update to every pet in the array. Dead pets are
 * skipped (returned unchanged). Live pets get their stats decayed, may
 * fall sick, and may die. The returned array is a new array with new
 * Pet objects for each tick (immutable update — same shape as the
 * previous inline code).
 *
 * Caller responsibilities (still inline in `nextWeek` for now):
 *   - Detect newly-dead pets vs the previous array and apply player
 *     happiness penalty + notifications.
 *   - Sum alive-pet happiness bonus to player happiness.
 */
export function tickPetsForWeek(prevPets: Pet[] | undefined | null, rolls: PetTickRolls): Pet[] {
  return (prevPets || []).map((pet, petIdx) => {
    if (pet.isDead) return pet; // Skip dead pets

    const newPet = { ...pet };

    // Age: +1 week
    newPet.age = (newPet.age || 0) + 1;

    // Hunger increases (needs feeding) — +8 per week
    newPet.hunger = Math.min(100, (newPet.hunger || 0) + 8);

    // Happiness decays if hungry or neglected — -5 if hunger > 60
    // BUGFIX: use ?? so a happiness of 0 is preserved (not replaced
    // with the 50 fallback). Same fix below for health.
    if (newPet.hunger > 60) {
      newPet.happiness = Math.max(0, (newPet.happiness ?? 50) - 5);
    }

    // Health decays if very hungry — -3 if hunger > 80
    if (newPet.hunger > 80) {
      newPet.health = Math.max(0, (newPet.health ?? 50) - 3);
    }

    // Sickness chance: 2% per week, higher if health < 40
    // BUGFIX: previously `newPet.health || 50` accidentally healed a
    // pet at exactly 0 health to 40 (0 || 50 → 50; then -10 = 40),
    // breaking the death progression and silently rescuing dying pets.
    // Index into the pre-rolled arrays with a wrap so pets BEYOND the
    // pre-roll length still get a valid roll. petIdx runs over the full pets
    // array (alive + dead), so a player who has owned more pets than the
    // pre-roll size would otherwise read `undefined` here — and `undefined <
    // 0.06` is false, silently making those pets immune to sickness. Modulo
    // keeps the draw deterministic (no impure Math.random in the updater).
    const sicknessRoll = rolls.petSickness.length
      ? rolls.petSickness[petIdx % rolls.petSickness.length]
      : 1;
    const sicknessTypeRoll = rolls.petSicknessType.length
      ? rolls.petSicknessType[petIdx % rolls.petSicknessType.length]
      : 0;
    if (!newPet.isSick && sicknessRoll < (newPet.health < 40 ? 0.06 : 0.02)) {
      const sicknesses = ['cold', 'infection', 'parasite', 'injury'];
      newPet.isSick = true;
      newPet.sickness = sicknesses[Math.floor(sicknessTypeRoll * sicknesses.length)];
      newPet.health = Math.max(0, (newPet.health ?? 50) - 10);
    }

    // Sick pets lose health each week
    if (newPet.isSick) {
      newPet.health = Math.max(0, (newPet.health || 0) - 5);
    }

    // Death check: zero health for 3+ weeks, or exceeded lifespan
    const lifespanWeeks = (PET_LIFESPANS[newPet.type] || 10) * WEEKS_PER_YEAR;
    if (newPet.health <= 0) {
      newPet.weeksAtZeroHealth = (newPet.weeksAtZeroHealth || 0) + 1;
      if (newPet.weeksAtZeroHealth >= 3) {
        newPet.isDead = true;
      }
    } else {
      newPet.weeksAtZeroHealth = 0;
    }

    // Natural death from old age
    if (newPet.age >= lifespanWeeks) {
      newPet.isDead = true;
    }

    return newPet;
  });
}

// ============================================================
// Side-effect helpers — R7 Phase 2 step 2.2c.
// ============================================================
//
// These were previously inline in `nextWeek` AROUND the pet map. The death
// block runs BEFORE the vehicle block; the alive-bonus + food-cost run
// AFTER. The order matters because vehicles ALSO mutate money/happiness,
// so we preserve the exact call-site positions in `GameActionsContext.tsx`
// rather than collapsing into one helper.

/**
 * Apply the "newly-dead pet" side effects: -20 happiness per newly-dead
 * pet + a 'Pet Loss' notification per pet. A pet counts as "newly dead"
 * if it's dead in `updatedPets` but was alive in `prevPets`. Already-dead
 * pets are NOT re-mourned.
 *
 * Mutates `ctx.newStats.happiness` and pushes to `ctx.notifications`.
 * Returns void — the caller doesn't need anything back.
 */
export function applyPetDeathSideEffects(
  prevPets: Pet[] | undefined | null,
  updatedPets: Pet[],
  ctx: WeekContext,
): void {
  const newlyDeadPets = updatedPets.filter(
    (p) => p.isDead && !(prevPets || []).find((op) => op.id === p.id)?.isDead,
  );
  if (newlyDeadPets.length > 0) {
    newlyDeadPets.forEach((pet) => {
      ctx.newStats.happiness = Math.max(0, ctx.newStats.happiness - 20);
      ctx.notifications.push({
        id: `pet-death-${pet.id}`,
        message: `Your beloved ${pet.name} the ${pet.type} has passed away. Rest in peace.`,
        title: 'Pet Loss',
      });
    });
  }
}

/**
 * Apply the "living-pet" side effects: +2 happiness per happy & healthy
 * alive pet (capped at 100), and a $15 food-cost deduction per alive pet
 * (capped at 0). Order matches the legacy inline code: happiness bonus
 * first, then food cost.
 *
 * Mutates `ctx.newStats.happiness` and `ctx.newStats.money`. Returns void.
 */
export function applyPetLivingSideEffects(
  updatedPets: Pet[],
  ctx: WeekContext,
): void {
  const alivePets = updatedPets.filter((p) => !p.isDead);

  // Pet bonuses to player: happy, healthy pets boost happiness +2 each.
  const petHappinessBonus = alivePets.reduce(
    (sum, p) => ((p.happiness || 0) > 50 && (p.health || 0) > 30 ? sum + 2 : sum),
    0,
  );
  if (petHappinessBonus > 0) {
    ctx.newStats.happiness = Math.min(100, ctx.newStats.happiness + petHappinessBonus);
  }

  // Pet food costs: deduct basic food per alive pet.
  const petFoodCost = alivePets.length * PET_WEEKLY_FOOD_COST;
  if (petFoodCost > 0) {
    ctx.newStats.money = Math.max(0, ctx.newStats.money - petFoodCost);
  }
}
