/**
 * Pet competition logic — pure win-probability, payout math and the weekly
 * entry rules.
 *
 * Before this lib, competitions were pure RNG with a flat ~50% chance and an
 * ad-hoc bonus per win. This module computes a probability the player can
 * read and react to, derived from the pet's relevant stat vs. the
 * competition's minValue and the strength of the field.
 *
 * `planCompetitionEntry` is the ONE place that decides whether an entry is
 * allowed and how it turns out. `enterCompetition` runs it twice - on the
 * render-time snapshot for the message, and on `prev` inside the updater for the
 * state - so the two cannot disagree about a rule (the `vetVisitWouldHelp`
 * pattern in PetActions).
 */

import type { GameState, Pet } from '@/contexts/game/types';
import { makeLifeRoll } from '@/utils/seededRoll';
import { findCompetition, PetCompetition } from './catalog';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Odds of a pet that just meets the requirement, before the field is subtracted. */
export const QUALIFIED_BASE_WIN = 0.35;
/** Every point of margin over `minValue` adds 0.02, up to this much. */
export const MARGIN_BONUS_CAP = 0.3;
/** Each previous win adds 0.02, up to this much (five wins). */
export const REPUTATION_BONUS_CAP = 0.1;
/** No show is ever a sure thing, and none is ever hopeless for a qualified pet. */
export const MAX_WIN_PROBABILITY = 0.75;
export const MIN_WIN_PROBABILITY = 0.02;

/**
 * The key of the seeded roll that decides a show. Deliberately NOT keyed on the
 * pet or the show: the player gets one entry a week, so the life + the week
 * already identify the attempt, and leaving the show out means reloading a save
 * and picking a different show replays the SAME draw instead of handing out a
 * fresh one per show.
 */
export const PET_SHOW_ROLL_KEY = 'pet-show-entry';

export interface CompetitionEligibility {
  competition: PetCompetition;
  meetsRequirement: boolean;
  /** 0..1 — odds of placing first. 0 when the pet does not qualify (entry is refused). */
  winProbability: number;
  /** What stat was used as the gating metric. */
  gatingStat: 'happiness' | 'health' | 'energy' | 'aggregate';
  gatingValue: number;
  /** Mean money per entry: winProbability x prize - entryFee. */
  expectedValue: number;
}

/** Human wording for a show's requirement - 'all' is the AVERAGE of three stats. */
export function requirementLabel(comp: PetCompetition): string {
  return comp.requirement === 'all' ? 'average of happiness, health and energy' : comp.requirement;
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
  let winProbability = 0;
  if (meets) {
    const margin = value - comp.minValue;
    const marginBonus = Math.min(MARGIN_BONUS_CAP, margin / 50);
    const reputationBonus = Math.min(REPUTATION_BONUS_CAP, safe(pet.competitionWins, 0) * 0.02);
    const raw = QUALIFIED_BASE_WIN + marginBonus + reputationBonus - safe(comp.fieldStrength, 0);
    winProbability = Math.max(MIN_WIN_PROBABILITY, Math.min(MAX_WIN_PROBABILITY, raw));
  }

  return {
    competition: comp,
    meetsRequirement: meets,
    winProbability,
    gatingStat,
    gatingValue: value,
    expectedValue: meets ? winProbability * comp.prize - comp.entryFee : -comp.entryFee,
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

/**
 * The pet that has already used this week's entry, if any.
 *
 * Shows are limited to ONE entry per game week across ALL pets, derived from the
 * per-pet `lastCompetitionWeek` marker each entry already writes: any pet stamped
 * with this `weeksLived` blocks every other. Dead pets count too - an entry made
 * before a pet died this week was still this week's entry.
 */
export function petThatCompetedThisWeek(
  pets: Pet[] | undefined | null,
  weeksLived: number
): Pet | undefined {
  return (pets ?? []).find((p) => p?.lastCompetitionWeek === weeksLived);
}

/** This life's draw for this week's show, in [0, 1). Same life + same week = same number. */
export function petShowRoll(
  state: Pick<GameState, 'lineageId' | 'generationNumber' | 'weeksLived'>
): number {
  const weeksLived = safe(state.weeksLived, 0);
  return makeLifeRoll(state, weeksLived)(PET_SHOW_ROLL_KEY);
}

export type CompetitionEntryPlan =
  | { ok: false; message: string }
  | {
      ok: true;
      pet: Pet;
      competition: PetCompetition;
      won: boolean;
      winProbability: number;
      /** The pet as it should be stored: wins bumped on a win, week stamped. */
      updatedPet: Pet;
      /** What the entry does to cash: prize - fee on a win, -fee on a loss. */
      netMoney: number;
      weeksLived: number;
    };

/**
 * Decide an entry against `state`, with no side effects. Every rule lives here:
 * the pet must exist and be alive, nobody may have competed this week, the pet
 * must meet the show's requirement, and the fee must be affordable. The outcome
 * is the seeded `petShowRoll`, so it is the same however often it is asked.
 */
export function planCompetitionEntry(
  state: GameState,
  petId: string,
  competitionId: string
): CompetitionEntryPlan {
  const pet = (state.pets ?? []).find((p) => p?.id === petId);
  if (!pet) return { ok: false, message: 'Pet not found' };
  if (pet.isDead) return { ok: false, message: `${pet.name} has passed on.` };

  const evalRes = evaluatePetForCompetition(pet, competitionId);
  if (!evalRes) return { ok: false, message: 'Unknown competition' };
  const comp = evalRes.competition;

  const weeksLived = safe(state.weeksLived, 0);
  const entered = petThatCompetedThisWeek(state.pets, weeksLived);
  if (entered) {
    return {
      ok: false,
      message:
        entered.id === pet.id
          ? `${pet.name} already competed this week. Your pets get one show entry a week between them - come back next week.`
          : `${entered.name} already competed this week. Your pets get one show entry a week between them - come back next week.`,
    };
  }

  if (!evalRes.meetsRequirement) {
    return {
      ok: false,
      message: `${comp.name} needs ${requirementLabel(comp)} of ${comp.minValue}+. ${pet.name} has ${evalRes.gatingValue}.`,
    };
  }

  if (safe(state.stats?.money, 0) < comp.entryFee) {
    return { ok: false, message: `The ${comp.name} entry fee is $${comp.entryFee.toLocaleString('en-US')}.` };
  }

  const result = resolveCompetition(pet, competitionId, petShowRoll(state));
  if (!result) return { ok: false, message: 'Unknown competition' };

  return {
    ok: true,
    pet,
    competition: comp,
    won: result.won,
    winProbability: result.winProbability,
    updatedPet: { ...result.pet, lastCompetitionWeek: weeksLived },
    netMoney: result.won ? comp.prize - comp.entryFee : -comp.entryFee,
    weeksLived,
  };
}
