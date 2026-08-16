/**
 * Pet stat decay + sickness rolls — pure functions called from the weekly tick.
 *
 * Before this lib, pets had `hunger` and `energy` fields that never actually
 * decayed; the player could never neglect a pet, so "care" was decorative.
 * This module wires real decay (modulated by life stage), happiness loss
 * when hungry, and sickness rolls that depend on vaccination status.
 */

import { Pet } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { PET_SICKNESSES, findBreed, PetBreed } from './catalog';
import { bandFor } from './lifecycle';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;
const clamp01 = (n: number): number => Math.max(0, Math.min(100, n));

export interface PetWeeklyTickInput {
  pet: Pet;
  /** Random rolls 0..1. Caller seeds deterministically. */
  rollIllness: number;
  rollSicknessKind: number;
}

export interface PetWeeklyTickOutput {
  pet: Pet;
  /** True if pet died this tick (natural death or zero health). */
  died: boolean;
  /** Cause of death for notification copy. */
  causeOfDeath?: 'starvation' | 'illness' | 'old-age';
}

/**
 * Number of consecutive weeks at zero health after which a pet dies.
 * The live weekly tick reconciles to the legacy 3-week grace period (see
 * `contexts/game/actions/weekly/applyPets.ts`) to keep mortality on its
 * historical baseline; `tickPet`/`tickAllPets` default to 2 so the
 * standalone decay unit tests keep their original contract.
 */
export const DEFAULT_ZERO_HEALTH_DEATH_WEEKS = 2;

/**
 * Apply one week of stat decay + age progression to a single pet. Pure.
 *
 * @param zeroHealthDeathWeeks Consecutive weeks at zero health before death.
 *   Defaults to {@link DEFAULT_ZERO_HEALTH_DEATH_WEEKS}. The wired weekly tick
 *   passes 3 to preserve the legacy grace period.
 */
export function tickPet(
  input: PetWeeklyTickInput,
  zeroHealthDeathWeeks: number = DEFAULT_ZERO_HEALTH_DEATH_WEEKS,
): PetWeeklyTickOutput {
  const { pet, rollIllness, rollSicknessKind } = input;
  if (pet.isDead) return { pet, died: false };

  const breed = findBreed(pet.type);
  if (!breed) return { pet, died: false };

  const lifespanWeeks = breed.lifespan * WEEKS_PER_YEAR;
  const nextAge = safe(pet.age, 0) + 1;
  const band = bandFor(nextAge / lifespanWeeks);

  // 1) Hunger decay.
  const hungerDecay = breed.hungerDecayPerWeek * band.hungerMultiplier;
  const nextHunger = clamp01(safe(pet.hunger, 100) - hungerDecay);

  // 2) Energy slowly recovers but caps at 100.
  const energyGain = breed.energyRecoveryPerWeek * band.energyMultiplier * 0.5; // half-rate baseline when player doesn't actively sleep
  const nextEnergy = clamp01(safe(pet.energy, 100) + energyGain);

  // 3) Happiness slips when hungry or sick.
  let happinessDelta = 0;
  if (nextHunger < 30) happinessDelta -= 5;
  if (nextHunger < 10) happinessDelta -= 10;
  if (pet.isSick) happinessDelta -= 8;
  const nextHappiness = clamp01(safe(pet.happiness, 100) + happinessDelta);

  // 4) Health drains from active sickness and starvation.
  let healthDelta = 0;
  if (pet.isSick && pet.sickness) {
    const def = PET_SICKNESSES.find((s) => s.id === pet.sickness);
    if (def) healthDelta -= def.healthDrain;
  }
  if (nextHunger <= 0) healthDelta -= 8;
  const nextHealth = clamp01(safe(pet.health, 100) + healthDelta);

  // 5) Illness roll.
  let isSick = !!pet.isSick;
  let sickness = pet.sickness;
  if (!isSick) {
    const baseChance = breed.illnessChancePerWeek * band.illnessMultiplier;
    // Vaccinations halve the chance; very low health doubles it.
    const vaxAdj = pet.vaccinated ? 0.5 : 1.0;
    const healthAdj = nextHealth < 40 ? 2.0 : 1.0;
    const finalChance = Math.max(0, Math.min(1, baseChance * vaxAdj * healthAdj));
    if (rollIllness < finalChance) {
      const list = PET_SICKNESSES;
      const idx = Math.floor(rollSicknessKind * list.length);
      sickness = list[Math.max(0, Math.min(list.length - 1, idx))].id;
      isSick = true;
    }
  }

  // 6) Track weeks at zero health → eventual death.
  let weeksAtZeroHealth = safe(pet.weeksAtZeroHealth, 0);
  if (nextHealth <= 0) weeksAtZeroHealth += 1;
  else weeksAtZeroHealth = 0;

  const isOldAge = nextAge >= lifespanWeeks;
  const diedFromHealth = weeksAtZeroHealth >= zeroHealthDeathWeeks;
  const died = isOldAge || diedFromHealth;
  const causeOfDeath: PetWeeklyTickOutput['causeOfDeath'] = died
    ? isOldAge
      ? 'old-age'
      : nextHunger <= 0 && !isSick
        ? 'starvation'
        : 'illness'
    : undefined;

  return {
    pet: {
      ...pet,
      age: nextAge,
      hunger: nextHunger,
      energy: nextEnergy,
      happiness: nextHappiness,
      health: nextHealth,
      isSick,
      sickness,
      weeksAtZeroHealth,
      isDead: died ? true : pet.isDead,
    },
    died,
    causeOfDeath,
  };
}

/**
 * Apply tickPet across every pet in the array. Returns the next list and a
 * list of pets that died this tick.
 */
export function tickAllPets(
  pets: Pet[],
  rollFor: (key: string) => number,
  zeroHealthDeathWeeks: number = DEFAULT_ZERO_HEALTH_DEATH_WEEKS,
): { pets: Pet[]; deaths: { pet: Pet; cause: NonNullable<PetWeeklyTickOutput['causeOfDeath']> }[] } {
  const deaths: { pet: Pet; cause: NonNullable<PetWeeklyTickOutput['causeOfDeath']> }[] = [];
  const next = pets.map((p) => {
    if (p.isDead) return p;
    const res = tickPet({
      pet: p,
      rollIllness: rollFor(`pet.${p.id}.illness`),
      rollSicknessKind: rollFor(`pet.${p.id}.illness.kind`),
    }, zeroHealthDeathWeeks);
    if (res.died && res.causeOfDeath) deaths.push({ pet: res.pet, cause: res.causeOfDeath });
    return res.pet;
  });
  return { pets: next, deaths };
}

/**
 * Helper for breeds.ts consumers — gives the breed's adjusted weekly hunger
 * decay at a given age band, used by the UI to show "this pet eats more
 * when juvenile" hints.
 */
export function effectiveHungerDecay(breed: PetBreed, ageFraction: number): number {
  return breed.hungerDecayPerWeek * bandFor(ageFraction).hungerMultiplier;
}
