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
import { tickAllPets } from '@/lib/pets/decay';
import { bondingSummary } from '@/lib/pets/bonding';
import type { WeekContext } from './weekContext';
import { chargeOrDefer } from './chargeOrDefer';

/** Weekly food cost per alive pet (USD). Matches the legacy inline constant. */
// Re-exported from `@/lib/pets/lifecycle`, which now owns it: the Weekly
// Expenses panel needs the same number and `lib/` cannot import from here.
export { PET_WEEKLY_FOOD_COST } from '@/lib/pets/lifecycle';
import { PET_WEEKLY_FOOD_COST } from '@/lib/pets/lifecycle';

/**
 * Consecutive weeks at zero health before a pet dies. The real decay engine
 * (`lib/pets/decay.ts`) defaults to 2, but the wired weekly tick keeps the
 * legacy 3-week grace period so wiring the richer engine does NOT raise pet
 * mortality above its historical baseline (breed lifespans are already
 * identical between the two engines — see PET_LIFESPANS vs PET_BREEDS.lifespan).
 */
export const PET_ZERO_HEALTH_DEATH_WEEKS = 3;

/**
 * Per-week caps on the player-facing bonding deltas (economy guardrail): a
 * roster of well-cared pets can add at most +5 happiness / +3 health per week,
 * and a roster of neglected pets can sap at most -5 happiness. Health is never
 * drained by pets (floor 0).
 */
export const PET_BONDING_HAPPINESS_CAP = 5;
export const PET_BONDING_HEALTH_CAP = 3;

/**
 * Roll inputs the tick consumes — these come from the `preRolls` object
 * pre-rolled at the top of `nextWeek` so React StrictMode's double-invoke
 * produces identical results.
 */
export interface PetTickRolls {
  /**
   * One illness roll per pet slot (up to 20). Fed to the decay engine as each
   * pet's `rollIllness`, compared against its breed × life-stage × vaccination ×
   * low-health-adjusted illness chance.
   */
  petSickness: number[];
  /** One roll per pet slot (up to 20). Picks the sickness from PET_SICKNESSES. */
  petSicknessType: number[];
}

/**
 * Apply the per-week update to every pet in the array by delegating to the
 * real, unit-tested care engine (`lib/pets/decay.ts` → `tickAllPets`). Dead
 * pets are skipped (returned unchanged). Live pets get their stats decayed, may
 * fall sick, and may die. The returned array is a new array with new Pet
 * objects for each ticked pet (immutable update).
 *
 * Caller responsibilities (still inline in `nextWeek` for now):
 *   - Detect newly-dead pets vs the previous array and apply player
 *     happiness penalty + notifications (`applyPetDeathSideEffects`).
 *   - Apply the bonding companionship deltas + food cost
 *     (`applyPetLivingSideEffects`).
 */
export function tickPetsForWeek(prevPets: Pet[] | undefined | null, rolls: PetTickRolls): Pet[] {
  const list = prevPets || [];
  if (list.length === 0) return [];

  // Route the weekly per-pet update through the real, unit-tested care engine
  // (`lib/pets/decay.ts` → `tickAllPets`) instead of the old flat approximation.
  // This makes every number the UI already renders honest at once: vaccination
  // halves the illness roll, breed-specific hunger/illness rates + life-stage
  // bands apply, per-sickness `healthDrain` matters, and passive energy recovery
  // finally happens.
  //
  // Determinism: the engine wants a keyed `rollFor(key)`; we adapt the existing
  // pre-rolled arrays (StrictMode-safe, seeded at the top of `nextWeek`) into
  // that shape. Each pet's illness / sickness-kind draws map to its slot in the
  // pre-roll, wrapped modulo the array length so pets BEYOND the pre-roll length
  // still get a valid, deterministic roll (the historical wrap contract — a
  // player who has owned more pets than the buffer size must not become immune).
  const indexById = new Map<string, number>();
  list.forEach((p, i) => indexById.set(p.id, i));

  const rollFor = (key: string): number => {
    const isKind = key.endsWith('.kind');
    const suffixLen = isKind ? '.illness.kind'.length : '.illness'.length;
    // Keys are `pet.<id>.illness` / `pet.<id>.illness.kind`; strip the `pet.`
    // prefix and the illness suffix to recover the pet id.
    const id = key.slice('pet.'.length, key.length - suffixLen);
    const idx = indexById.get(id);
    if (idx === undefined) return isKind ? 0 : 1;
    const arr = isKind ? rolls.petSicknessType : rolls.petSickness;
    if (arr.length === 0) return isKind ? 0 : 1;
    return arr[idx % arr.length];
  };

  const { pets } = tickAllPets(list, rollFor, PET_ZERO_HEALTH_DEATH_WEEKS);
  return pets;
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
 * Apply the "living-pet" side effects: the emotional-companionship bonus/penalty
 * computed by `bondingSummary` (the SAME numbers the "Companion bonus" card and
 * per-pet "Bond with you" figures already display), plus a $15 food-cost
 * deduction per alive pet. Order matches the legacy inline code: companionship
 * first, then food cost.
 *
 * Previously this applied a cruder flat +2 happiness per happy&healthy pet, no
 * player-health effect, and no downside for neglected pets — so the advertised
 * "pets keep you healthy" and "a miserable pet drags you down" were never real.
 * Now the tick honors `bondingSummary`: well-cared pets grant happiness AND a
 * small health boost; neglected pets sap happiness.
 *
 * Economy guardrail: the total pet-derived deltas are hard-capped per week to
 * [-PET_BONDING_HAPPINESS_CAP, +PET_BONDING_HAPPINESS_CAP] happiness and
 * [0, +PET_BONDING_HEALTH_CAP] health so a large roster cannot inflate stats.
 *
 * Mutates `ctx.newStats.happiness`, `ctx.newStats.health`, and
 * `ctx.newStats.money`. Returns void.
 */
export function applyPetLivingSideEffects(
  updatedPets: Pet[],
  ctx: WeekContext,
): void {
  const alivePets = updatedPets.filter((p) => !p.isDead);

  const bonding = bondingSummary(alivePets);

  // Happiness: bonding delta can be positive (well-cared roster) or negative
  // (neglected roster), clamped to the weekly cap, then clamped to 0..100.
  const happinessDelta = Math.max(
    -PET_BONDING_HAPPINESS_CAP,
    Math.min(PET_BONDING_HAPPINESS_CAP, bonding.playerHappinessDelta),
  );
  if (happinessDelta !== 0) {
    ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + happinessDelta));
  }

  // Health: companionship only ever helps (floor 0), clamped to the weekly cap
  // and to 0..100.
  const healthDelta = Math.max(0, Math.min(PET_BONDING_HEALTH_CAP, bonding.playerHealthDelta));
  if (healthDelta > 0) {
    ctx.newStats.health = Math.max(0, Math.min(100, ctx.newStats.health + healthDelta));
  }

  // Pet food costs: deduct basic food per alive pet.
  const petFoodCost = alivePets.length * PET_WEEKLY_FOOD_COST;
  if (petFoodCost > 0) {
    // Feeding the animals is not optional.
    chargeOrDefer(ctx, petFoodCost);
  }
}
