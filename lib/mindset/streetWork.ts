/**
 * How a Mindset changes a street job - the street half of the Mindset table.
 *
 * Every Mindset's numbers live in `MINDSET_EFFECTS` (./effects.ts). Most act on
 * the rest of a life (career, health, relationships, travel, money); the risk
 * Mindsets - Gambler, Risk Averse, Hustler, and the Optimist's blind spot - act
 * here, on street work. This module folds that half into one set of terms read
 * by the street-job payout and by the Work-tab card, so the number on the card
 * is the number paid.
 *
 * The effects are applied inside `performStreetJob`'s single updater through
 * `getStreetJobTerms` (contexts/game/actions/JobActions.ts), never as a second
 * write. The old path credited a separate adjustment from the screen after the
 * action returned, so a tap the updater refused (energy, weekly cap) still
 * collected its Mindset bonus, and Gambler's swing was a raw `Math.random()`
 * that a reload re-rolled.
 *
 * Nothing here is random and nothing here writes state: it is a pure function
 * of the active Mindset(s) and whether the job is illegal.
 */
import { MINDSET_TRAITS, type MindsetId } from './config';
import {
  DEFAULT_RUNS_PER_RANK,
  MINDSET_STREET_EFFECTS,
  activeMindsetIds,
  type MindsetStreetEffect,
} from './effects';

// The table, the types and the active-Mindset reader live in ./effects.ts
// with the rest of a Mindset's effects; re-exported so street-work callers
// keep one import.
export { DEFAULT_RUNS_PER_RANK, MINDSET_STREET_EFFECTS, activeMindsetIds };
export type { MindsetStreetEffect };

/** The folded effect of every active Mindset on ONE street job. */
export interface MindsetStreetTerms {
  /** Multiplies the job's pay. 1 when no Mindset touches it. */
  payMultiplier: number;
  /** Percentage points added to the success chance. */
  successBonus: number;
  /** Percentage points added to the arrest chance (illegal jobs only). */
  arrestBonus: number;
  /** Multiplies the (capped) arrest chance (illegal jobs only). */
  arrestMultiplier: number;
  /** Halve the happiness cost before the deltas below are added. */
  halveHappinessCost: boolean;
  /** Added to the happiness cost (negative = costs more). */
  happinessDelta: number;
  /** Added to the health cost (negative = costs more). */
  healthDelta: number;
  /** Successful runs per rank-up. */
  runsPerRank: number;
  /**
   * A short note naming the Mindset(s) that changed the pay, e.g.
   * "Frugal +10%" - null when the pay is unchanged. Quoted in the toast so
   * the player can see the Mindset at work.
   */
  payNote: string | null;
}

export const NEUTRAL_MINDSET_STREET_TERMS: Readonly<MindsetStreetTerms> = {
  payMultiplier: 1,
  successBonus: 0,
  arrestBonus: 0,
  arrestMultiplier: 1,
  halveHappinessCost: false,
  happinessDelta: 0,
  healthDelta: 0,
  runsPerRank: DEFAULT_RUNS_PER_RANK,
  payNote: null,
};

const clamp = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

const finite = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

function mindsetName(id: MindsetId): string {
  return MINDSET_TRAITS.find((t) => t.id === id)?.name ?? id;
}

/**
 * Fold the active Mindsets into one set of street-job terms.
 *
 * One Mindset is the norm; the fold exists because `mindset.traits` is a list
 * and a corrupt or hand-edited save could hold several. Every output is
 * clamped so no stack can mint pay, push a chance outside 0-100, or turn a
 * cost into a gain.
 */
export function mindsetStreetTerms(
  ids: readonly MindsetId[],
  illegal: boolean,
): MindsetStreetTerms {
  if (ids.length === 0) return { ...NEUTRAL_MINDSET_STREET_TERMS };

  let payMultiplier = 1;
  let successBonus = 0;
  let arrestBonus = 0;
  let arrestMultiplier = 1;
  let halveHappinessCost = false;
  let happinessDelta = 0;
  let healthDelta = 0;
  let runsPerRank = DEFAULT_RUNS_PER_RANK;
  const notes: string[] = [];

  for (const id of ids) {
    const effect = MINDSET_STREET_EFFECTS[id];
    if (!effect) continue;
    const pay =
      finite(effect.pay, 1) * finite(illegal ? effect.illegalPay : effect.legalPay, 1);
    if (pay !== 1) {
      payMultiplier *= pay;
      const pct = Math.round((pay - 1) * 100);
      notes.push(`${mindsetName(id)} ${pct > 0 ? '+' : ''}${pct}%`);
    }
    successBonus += finite(effect.success, 0);
    if (illegal) {
      arrestBonus += finite(effect.arrestPoints, 0);
      arrestMultiplier *= finite(effect.arrestMultiplier, 1);
    }
    if (effect.halveHappinessCost) halveHappinessCost = true;
    happinessDelta += finite(effect.happiness, 0) + (illegal ? 0 : finite(effect.legalHappiness, 0));
    healthDelta += finite(effect.health, 0);
    if (typeof effect.runsPerRank === 'number') {
      runsPerRank = Math.min(runsPerRank, effect.runsPerRank);
    }
  }

  return {
    payMultiplier: clamp(payMultiplier, 0.5, 1.5),
    successBonus: clamp(successBonus, -25, 25),
    arrestBonus: clamp(arrestBonus, -25, 25),
    arrestMultiplier: clamp(arrestMultiplier, 0.5, 1),
    halveHappinessCost,
    happinessDelta: clamp(happinessDelta, -5, 5),
    healthDelta: clamp(healthDelta, -5, 5),
    runsPerRank: Math.round(clamp(runsPerRank, 2, DEFAULT_RUNS_PER_RANK)),
    payNote: notes.length > 0 ? notes.join(', ') : null,
  };
}
