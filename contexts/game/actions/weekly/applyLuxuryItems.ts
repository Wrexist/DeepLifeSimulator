/**
 * Luxury & Collectibles weekly tick — upkeep cost + ownership benefit.
 *
 * Mirrors the vehicle reducer's `WeekContext` mutable-accumulator pattern
 * (contexts/game/actions/weekly/applyVehicles.ts). Called AFTER the money
 * writeback (`newStats.money = newMoney`) in `nextWeek`, so deductions land on
 * real cash and survive the tick.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.money`      — total weekly upkeep, mirror-safe (stats.money
 *     only; never a mirrored bank account balance).
 *   - `ctx.newStats.happiness`  — small sustained bonus (clamped 0-100). Sits
 *     before the orchestrator's clamp, so bounding here is belt-and-braces.
 *   - `ctx.newStats.reputation` — drifts toward a prestige SOFT TARGET (never an
 *     unconditional weekly rail). Reputation does not decay, so an unconditional
 *     `+= prestige` would pin it to 100 for free; instead we step up by
 *     LUXURY_REPUTATION_STEP only while below the collection's prestige total.
 *
 * Returns the summed upkeep so the caller can record it in the weekly expense
 * breakdown (the deduction itself already happened here).
 */

import {
  LUXURY_REPUTATION_CAP,
  LUXURY_REPUTATION_STEP,
  getTotalLuxuryHappiness,
  getTotalLuxuryPrestige,
  getTotalLuxuryUpkeep,
} from '@/lib/luxury';
import type { WeekContext } from './weekContext';

export function applyLuxuryItemsForWeek(
  luxuryItemIds: string[] | undefined | null,
  ctx: WeekContext,
): { upkeep: number } {
  const ids = luxuryItemIds || [];
  if (ids.length === 0) return { upkeep: 0 };

  // (a) Upkeep — deduct from REAL cash. Mirror-safe: stats.money only.
  const upkeep = getTotalLuxuryUpkeep(ids);
  if (upkeep > 0) {
    const before = typeof ctx.newStats.money === 'number' && isFinite(ctx.newStats.money) ? ctx.newStats.money : 0;
    ctx.newStats.money = Math.max(0, before - upkeep);
  }

  // (b) Happiness — small sustained weekly bonus, self-clamped to 100.
  const happiness = getTotalLuxuryHappiness(ids);
  if (happiness > 0) {
    const h = typeof ctx.newStats.happiness === 'number' && isFinite(ctx.newStats.happiness) ? ctx.newStats.happiness : 0;
    ctx.newStats.happiness = Math.min(100, h + happiness);
  }

  // (c) Prestige → reputation SOFT TARGET. Only nudge up while below the
  // collection's prestige total (capped), so it can never rail past what the
  // owned collection justifies, and never fights other reputation writers down.
  const prestige = getTotalLuxuryPrestige(ids);
  if (prestige > 0) {
    const target = Math.min(LUXURY_REPUTATION_CAP, prestige);
    const rep = typeof ctx.newStats.reputation === 'number' && isFinite(ctx.newStats.reputation) ? ctx.newStats.reputation : 0;
    if (rep < target) {
      ctx.newStats.reputation = Math.min(target, rep + LUXURY_REPUTATION_STEP);
    }
  }

  return { upkeep };
}
