/**
 * Weekly diet-plan effects — R7 Phase 2 step 2.5a.
 *
 * Scope: when the player has an active diet plan, apply its weekly stat
 * gains (health, energy, optional happiness) and deduct its weekly cost
 * (dailyCost × 7). Previously inline in `GameActionsContext.tsx:535-556`.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.health`    — +healthGain (clamped 0-100)
 *   - `ctx.newStats.energy`    — +energyGain (clamped 0-100)
 *   - `ctx.newStats.happiness` — +happinessGain (clamped 0-100), only if > 0
 *   - `ctx.newStats.money`     — -weeklyCost (floored at 0)
 *
 * Returns the same log message the legacy code emitted, or `null` when
 * no active diet plan exists. Caller decides whether to log — keeps the
 * helper testable without mocking `logger`.
 *
 * Only the FIRST active diet plan is consumed. The legacy code used
 * `.find()`, so multi-active edge cases (which shouldn't happen — the UI
 * enforces one-at-a-time) preserve "first wins" behavior.
 */

import type { DietPlan } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';

export interface DietPlanTickResult {
  /** Formatted log message, or `null` when no active diet plan. */
  logMessage: string | null;
}

export function applyDietPlanForWeek(
  prevDietPlans: DietPlan[] | undefined | null,
  ctx: WeekContext,
): DietPlanTickResult {
  const activeDietPlan = (prevDietPlans || []).find((plan) => plan && plan.active);
  if (!activeDietPlan) {
    return { logMessage: null };
  }

  // Apply health gain.
  if (activeDietPlan.healthGain > 0) {
    ctx.newStats.health = Math.max(0, Math.min(100, ctx.newStats.health + activeDietPlan.healthGain));
  }
  // Apply energy gain.
  if (activeDietPlan.energyGain > 0) {
    ctx.newStats.energy = Math.max(0, Math.min(100, ctx.newStats.energy + activeDietPlan.energyGain));
  }
  // Apply happiness gain (if applicable).
  if (activeDietPlan.happinessGain && activeDietPlan.happinessGain > 0) {
    ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + activeDietPlan.happinessGain));
  }
  // Deduct weekly cost (dailyCost × 7). Sanitize newStats.money via NaN-guard
  // matching the legacy inline code.
  const weeklyCost = activeDietPlan.dailyCost * 7;
  const currentMoney = typeof ctx.newStats.money === 'number' && !isNaN(ctx.newStats.money)
    ? ctx.newStats.money
    : 0;
  ctx.newStats.money = Math.max(0, currentMoney - weeklyCost);

  return {
    logMessage:
      `[WEEK PROGRESSION] Active diet plan: ${activeDietPlan.name} - ` +
      `Health: +${activeDietPlan.healthGain}, ` +
      `Energy: +${activeDietPlan.energyGain}, ` +
      `Happiness: +${activeDietPlan.happinessGain || 0}, ` +
      `Cost: -$${weeklyCost}`,
  };
}
