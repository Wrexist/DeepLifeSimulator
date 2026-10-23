/**
 * The week's energy regen, and how a mid-tick energy change is bounded.
 *
 * ── Why this exists (TICK2-1 / TICK2-2, 2026-10-23) ─────────────────────────
 *
 * The regen used to be composed inline in the week loop from five factors (the
 * base 40, the prestige multiplier, the Energy Boost gold upgrade, the Stamina
 * life skill and the Vigorous Start window), while the two screens that preview
 * it each restated a subset: `vitalDrift` applied the prestige multiplier only,
 * and the Energy breakdown modal used a base of 30. A player who had bought
 * Energy Boost saw "+40" and received +60. One function, read by all three.
 *
 * `energyAfterDrain` records the rule the week loop has always claimed for
 * energy ("apply full regen, then penalties, then cap to 100") and that the
 * reducers broke: each of them capped at 100 as it went, so the regen surplus
 * was thrown away at the first one and every later drain was charged from 100.
 * A working student resting at full energy lost the job's and the course's
 * energy every week while the HUD projection - a plain sum - said they kept
 * it. Reducers floor at 0 and leave the 0-100 cap to the updater.
 */
import type { GameState } from '@/contexts/game/types';
import { getEnergyRegenMultiplier, getStartingEnergyRegenMultiplier } from '@/lib/prestige/applyBonuses';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

/** Energy a week of rest restores before any multiplier. */
export const BASE_WEEKLY_ENERGY_REGEN = 40;

/** The Energy Boost gold upgrade: +50% regen (the 0-100 ceiling is unchanged). */
export const ENERGY_BOOST_REGEN_MULT = 1.5;

const positiveOr1 = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1;

/**
 * Energy the coming Next Week restores, from the state BEFORE that tick - the
 * same `prevState` the week loop reads. Rounded, as the tick applies it.
 */
export function weeklyEnergyRegen(state: GameState | null | undefined): number {
  if (!state) return BASE_WEEKLY_ENERGY_REGEN;
  const unlockedBonuses = state.prestige?.unlockedBonuses || [];
  const prestigeMult = positiveOr1(getEnergyRegenMultiplier(unlockedBonuses));
  const energyBoostMult = state.goldUpgrades?.energy_boost ? ENERGY_BOOST_REGEN_MULT : 1;
  // Stamina life skill (bounded by the accessor).
  const staminaMult = positiveOr1(getLifeSkillModifiers(state).energyRegenMult);
  // Vigorous Start: windowed on weeks into THIS life (CLAUDE.md §4.2).
  const vigorousStartMult = positiveOr1(
    getStartingEnergyRegenMultiplier(
      unlockedBonuses,
      weeksSinceLifeStart(state.weeksLived || 0, state.lifeStartWeek),
    ),
  );
  return Math.round(
    BASE_WEEKLY_ENERGY_REGEN * prestigeMult * energyBoostMult * staminaMult * vigorousStartMult,
  );
}

/**
 * Apply a mid-tick energy change: floored at 0, deliberately NOT capped at 100.
 * The week loop caps energy once, after every reducer has run.
 */
export function energyAfterDrain(current: number, delta: number): number {
  const base = typeof current === 'number' && Number.isFinite(current) ? current : 0;
  const change = typeof delta === 'number' && Number.isFinite(delta) ? delta : 0;
  return Math.max(0, base + change);
}
