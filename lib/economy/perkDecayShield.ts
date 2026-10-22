/**
 * Onboarding perks that shield a vital from natural decay - ONB-2.
 *
 * Every life starts at 100 health and 100 happiness, so the old Longevity
 * (+20 health), Iron Will (+20 health, +5 energy), Optimist (+15 happiness)
 * and Inner Peace (+20 happiness, +5 health) were clamped to nothing on every
 * scenario that starts with full bars - a perk card promising a number the
 * game threw away on the first frame. Their boost still applies where a
 * challenge starts a vital lower; what makes them worth picking above a full
 * bar is a DECAY SHIELD: for the first N weeks of the life, natural decay of
 * that vital is cut by a factor.
 *
 * One table, and the card copy is GENERATED from it
 * (`describePerkDecayShield`), so a card cannot promise a number the tick does
 * not apply (the Mindset rule, CLAUDE.md §4.9). Readers: the week tick in
 * `GameActionsContext` and Home's projection in `lib/economy/vitalDrift.ts`.
 *
 * No stored state: the perk flag is already written to `state.perks` by
 * `gameStateBuilder`, and the window is measured on `weeksSinceLifeStart`, so
 * nothing new is saved and no `STATE_VERSION` bump is involved. A save with no
 * `lifeStartWeek` (pre-v43) reads as far into its life, i.e. unshielded.
 */
import { weeksSinceLifeStart } from '@/utils/weekCounters';

export type ShieldedVital = 'health' | 'happiness';

export interface PerkDecayShield {
  vital: ShieldedVital;
  /** Multiplier on natural decay while active: 0 = none, 0.5 = halved. */
  factor: number;
  /** Played weeks of the life the shield covers (weeks 0..weeks-1). */
  weeks: number;
}

export const PERK_DECAY_SHIELDS: Readonly<Record<string, PerkDecayShield>> = {
  longevity: { vital: 'health', factor: 0, weeks: 52 },
  iron_will: { vital: 'health', factor: 0.5, weeks: 26 },
  inner_peace: { vital: 'happiness', factor: 0, weeks: 26 },
  optimist: { vital: 'happiness', factor: 0.5, weeks: 26 },
};

export interface DecayShieldFactors {
  health: number;
  happiness: number;
}

interface ShieldInput {
  perks?: { [perkId: string]: boolean | undefined } | null;
  weeksLived?: unknown;
  lifeStartWeek?: unknown;
}

/**
 * The decay multipliers the active perks apply this week. Total: a missing or
 * malformed state yields 1/1 (no shield). Two perks on the same vital do not
 * stack multiplicatively - the strongest active one wins.
 */
export function perkDecayFactors(state: ShieldInput | null | undefined): DecayShieldFactors {
  const out: DecayShieldFactors = { health: 1, happiness: 1 };
  const perks = state?.perks;
  if (!perks || typeof perks !== 'object') return out;
  const played = weeksSinceLifeStart(state?.weeksLived, state?.lifeStartWeek);
  for (const [id, shield] of Object.entries(PERK_DECAY_SHIELDS)) {
    if (perks[id] !== true) continue;
    if (played >= shield.weeks) continue;
    out[shield.vital] = Math.min(out[shield.vital], shield.factor);
  }
  return out;
}

/** The card sentence for a perk's shield, or '' for a perk without one. */
export function describePerkDecayShield(perkId: string): string {
  const shield = PERK_DECAY_SHIELDS[perkId];
  if (!shield) return '';
  const what = shield.factor === 0 ? 'No natural' : 'Half the natural';
  return `${what} ${shield.vital} decay for your first ${shield.weeks} weeks.`;
}
