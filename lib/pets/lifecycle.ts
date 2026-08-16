/**
 * Pet lifecycle — life stage classification, age progression, natural death.
 *
 * Pure functions. Age units: weeks (WEEKS_PER_YEAR = 52). A pet's `age` field
 * is stored in weeks (matches existing PetApp.tsx behavior).
 */

import { Pet } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { findBreed, PetBreed } from './catalog';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type LifeStage = 'juvenile' | 'young' | 'adult' | 'senior' | 'elderly';

export interface LifeStageBand {
  stage: LifeStage;
  /** Multiplier applied to base hunger decay. */
  hungerMultiplier: number;
  /** Multiplier applied to base energy recovery. */
  energyMultiplier: number;
  /** Multiplier applied to base illness chance. */
  illnessMultiplier: number;
}

/**
 * Map an age fraction (0..1 of lifespan) to a life stage band.
 */
export function bandFor(ageFraction: number): LifeStageBand {
  if (ageFraction < 0.1) return { stage: 'juvenile', hungerMultiplier: 1.3, energyMultiplier: 0.9, illnessMultiplier: 1.2 };
  if (ageFraction < 0.3) return { stage: 'young',    hungerMultiplier: 1.1, energyMultiplier: 1.1, illnessMultiplier: 0.8 };
  if (ageFraction < 0.7) return { stage: 'adult',    hungerMultiplier: 1.0, energyMultiplier: 1.0, illnessMultiplier: 1.0 };
  if (ageFraction < 0.9) return { stage: 'senior',   hungerMultiplier: 0.9, energyMultiplier: 0.8, illnessMultiplier: 1.5 };
  return                  { stage: 'elderly',  hungerMultiplier: 0.7, energyMultiplier: 0.6, illnessMultiplier: 2.5 };
}

/**
 * Classify a pet's current life stage.
 */
export function lifeStage(pet: Pet, breed?: PetBreed): LifeStage {
  const b = breed ?? findBreed(pet.type);
  if (!b) return 'adult';
  const ageWeeks = safe(pet.age, 0);
  const lifespanWeeks = b.lifespan * WEEKS_PER_YEAR;
  return bandFor(ageWeeks / lifespanWeeks).stage;
}

/**
 * Has the pet lived past its breed's natural lifespan?
 */
export function isPastLifespan(pet: Pet, breed?: PetBreed): boolean {
  const b = breed ?? findBreed(pet.type);
  if (!b) return false;
  return safe(pet.age, 0) >= b.lifespan * WEEKS_PER_YEAR;
}

/**
 * Age in years (rounded down) — for UI display.
 */
export function ageInYears(pet: Pet): number {
  return Math.floor(safe(pet.age, 0) / WEEKS_PER_YEAR);
}
