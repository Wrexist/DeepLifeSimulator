/**
 * Pet competition logic — pure win-probability + payout math.
 *
 * Before this lib, competitions were pure RNG with a flat ~50% chance and an
 * ad-hoc bonus per win. This module computes a probability the player can
 * read and react to, derived from the pet's relevant stat vs. the
 * competition's minValue.
 */

import { Pet } from '@/contexts/game/types';
import { findCompetition, PetCompetition } from './catalog';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface CompetitionEligibility {
  competition: PetCompetition;
  meetsRequirement: boolean;
  /** 0..1 — odds of placing first. */
  winProbability: number;
  /** What stat was used as the gating metric. */
  gatingStat: 'happiness' | 'health' | 'energy' | 'aggregate';
  gatingValue: number;
}

export function evaluatePetForCompetition(
  pet: Pet,
  competitionId: string
): CompetitionEligibility | null {
  const comp = findCompetition(competitionId);
  if (!comp) return null;

  let gatingStat: CompetitionEligibility['gatingStat'];
  let value: number;
  switch (comp.requirement) {
    case 'happiness':
      gatingStat = 'happiness';
      value = safe(pet.happiness, 0);
      break;
    case 'health':
      gatingStat = 'health';
      value = safe(pet.health, 0);
      break;
    case 'energy':
      gatingStat = 'energy';
      value = safe(pet.energy, 0);
      break;
    case 'all':
      gatingStat = 'aggregate';
      value = Math.round(
        (safe(pet.happiness, 0) + safe(pet.health, 0) + safe(pet.energy, 0)) / 3
      );
      break;
  }

  const meets = value >= comp.minValue;
  // Past the minimum threshold, every 10 points of margin adds ~10% to win
  // odds, capped at 90%. Pets with prior wins get a small reputation bump.
  const margin = Math.max(0, value - comp.minValue);
  const winBonus = Math.min(0.5, margin / 50);
  const reputationBonus = Math.min(0.1, safe(pet.competitionWins, 0) * 0.02);
  const baseWin = meets ? 0.4 : 0.05;
  const winProbability = Math.max(0, Math.min(0.9, baseWin + winBonus + reputationBonus));

  return {
    competition: comp,
    meetsRequirement: meets,
    winProbability,
    gatingStat,
    gatingValue: value,
  };
}

/**
 * Resolve a competition entry using a seeded roll. Returns the outcome and
 * updated pet (only `competitionWins` field changes here).
 */
export function resolveCompetition(
  pet: Pet,
  competitionId: string,
  roll: number
): {
  pet: Pet;
  competition: PetCompetition | null;
  won: boolean;
  winProbability: number;
  payoutDelta: number;
} | null {
  const evalRes = evaluatePetForCompetition(pet, competitionId);
  if (!evalRes) return null;
  const won = roll < evalRes.winProbability;
  return {
    pet: won
      ? { ...pet, competitionWins: safe(pet.competitionWins, 0) + 1 }
      : pet,
    competition: evalRes.competition,
    won,
    winProbability: evalRes.winProbability,
    payoutDelta: won ? evalRes.competition.prize : -evalRes.competition.entryFee,
  };
}
