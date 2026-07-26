/**
 * Identity & Body weekly tick.
 *
 * Mirrors the luxury/vehicle reducer pattern (`applyLuxuryItems.ts`): takes the
 * mutable `WeekContext`, mutates `ctx.newStats`, pushes notifications, and
 * returns the new identity plus what it cost.
 *
 * ## Adapter, not simulation
 *
 * All the physiology lives in `lib/identity`. This file's ONLY job is
 * translating game state into `BodyWeekInputs` and translating the result back
 * into stat mutations. That split is deliberate: the simulation stays testable
 * without a `GameState`, and this file stays short enough to audit.
 *
 * ## Ordering
 *
 * Called AFTER the money writeback in `nextWeek` (the same slot as the vehicle
 * and luxury ticks), so grocery and wardrobe costs land on real cash and are
 * not overwritten. Before the stat clamp, so the happiness/energy deltas are
 * bounded by the orchestrator exactly like every other subsystem's.
 */

import {
  normalizeIdentity,
  nutritionQuality,
  resolveRegimen,
  simulateBodyWeek,
  decayStyleWeek,
  wardrobeWeeklyUpkeep,
  type Identity,
} from '@/lib/identity';
import type { GameState } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';

export interface IdentityWeekResult {
  /** The new identity. SAME reference when nothing changed. */
  identity: Identity | undefined;
  /** Groceries + wardrobe upkeep actually deducted. */
  spent: number;
  /** Player-facing lines worth surfacing. */
  notes: string[];
}

/** Fields the tick reads. Narrowed so the helper is testable without a full state. */
export interface IdentityWeekState {
  identity?: Identity;
  date?: { age?: number };
  items?: { id: string; owned?: boolean }[];
}

/**
 * Derived stress, [0, 100].
 *
 * `GameStats` has no stress field, so it is inferred from the two stats that
 * stand in for it. Weighted toward unhappiness because that is the stronger
 * signal — a rested but miserable character is stressed; a tired but content one
 * mostly is not.
 */
export function deriveStress(happiness: number, energy: number): number {
  const h = typeof happiness === 'number' && isFinite(happiness) ? Math.max(0, Math.min(100, happiness)) : 50;
  const e = typeof energy === 'number' && isFinite(energy) ? Math.max(0, Math.min(100, energy)) : 50;
  return Math.max(0, Math.min(100, (100 - h) * 0.7 + (100 - e) * 0.3));
}

export function applyIdentityForWeek(
  prevState: IdentityWeekState,
  ctx: WeekContext,
): IdentityWeekResult {
  const prevIdentity = prevState.identity;
  // Absent identity means a save that predates v26 and somehow skipped both the
  // migration and repair. Rather than reconstructing a character here — which
  // would invent a body from nothing on a random week of someone's life — leave
  // it alone. The chapter simply stays inert until a load path repairs it.
  if (!prevIdentity || typeof prevIdentity !== 'object') {
    return { identity: prevIdentity, spent: 0, notes: [] };
  }

  const identity = normalizeIdentity(prevIdentity);
  const age =
    typeof prevState.date?.age === 'number' && isFinite(prevState.date.age) && prevState.date.age >= 0
      ? prevState.date.age
      : 18;

  const money = typeof ctx.newStats.money === 'number' && isFinite(ctx.newStats.money)
    ? Math.max(0, ctx.newStats.money)
    : 0;
  const health = typeof ctx.newStats.health === 'number' && isFinite(ctx.newStats.health)
    ? ctx.newStats.health
    : 100;
  const energy = typeof ctx.newStats.energy === 'number' && isFinite(ctx.newStats.energy)
    ? ctx.newStats.energy
    : 100;
  const happiness = typeof ctx.newStats.happiness === 'number' && isFinite(ctx.newStats.happiness)
    ? ctx.newStats.happiness
    : 100;

  const hasGym = (prevState.items || []).some((i) => i && i.id === 'gym_membership' && i.owned === true);
  const stress = deriveStress(happiness, energy);

  // --- What actually happened this week ----------------------------------
  const resolved = resolveRegimen(identity.regimen, { hasGym, money, energy });
  const notes = [...resolved.downgrades];

  // --- Charge for it ------------------------------------------------------
  // Floored at what the player actually has, exactly like the luxury tick: a
  // broke week charges less than the sticker price rather than going negative.
  const wardrobe = wardrobeWeeklyUpkeep(identity.style);
  const nominal = resolved.nutrition.weeklyCost + wardrobe;
  const spent = Math.min(nominal, money);
  ctx.newStats.money = Math.max(0, money - spent);

  // --- Advance the body ---------------------------------------------------
  const bodyWeek = simulateBodyWeek(identity.body, {
    age,
    dietQuality: nutritionQuality(resolved.nutrition, money),
    energyBalance: resolved.nutrition.energyBalance,
    exercise: resolved.training.intensity,
    stress,
    health,
  });
  notes.push(...bodyWeek.notes);

  // --- Grooming decay -----------------------------------------------------
  // `StyleWeekInputs.smoker` is deliberately not passed: the game has no smoking
  // state today, and inventing one here would mean this tick reads a field no
  // other system writes. The input stays supported in `decayStyleWeek` so a
  // future vices system can wire it up in one line.
  const style = decayStyleWeek(identity.style, { age, stress, health });

  // --- Stat costs of the regimen -----------------------------------------
  // Applied before the orchestrator's clamp, so bounding here is belt-and-braces
  // in the same style as the luxury tick's happiness bonus.
  const happinessDelta = resolved.nutrition.happiness + resolved.training.happiness;
  const energyDelta = resolved.nutrition.energy + resolved.training.energy;
  ctx.newStats.happiness = Math.max(0, Math.min(100, happiness + happinessDelta));
  ctx.newStats.energy = Math.max(0, Math.min(100, energy + energyDelta));

  // Training feeds the legacy `stats.fitness` bar too, so the existing health
  // screen and every achievement reading it keep working. The body sim is the
  // source of truth; this is a mirror, drifted toward rather than overwritten so
  // other systems that nudge fitness are not stomped each week.
  if (typeof ctx.newStats.fitness === 'number' && isFinite(ctx.newStats.fitness)) {
    const target = bodyWeek.body.fitness;
    ctx.newStats.fitness = Math.max(0, Math.min(100, ctx.newStats.fitness + (target - ctx.newStats.fitness) * 0.25));
  }

  return {
    identity: { ...identity, body: bodyWeek.body, style },
    spent,
    notes,
  };
}

/**
 * Convenience wrapper for callers holding a full `GameState`.
 *
 * Exists so `nextWeek` reads `applyIdentityForWeek(prevState, ctx)` like every
 * other reducer, while tests can still call the narrow version with a stub.
 */
export function applyIdentityForWeekFromState(prevState: GameState, ctx: WeekContext): IdentityWeekResult {
  return applyIdentityForWeek(prevState as unknown as IdentityWeekState, ctx);
}
