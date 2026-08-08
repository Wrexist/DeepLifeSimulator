/**
 * Charge a mandatory cost, deferring what the player cannot cover.
 *
 * ## Why this exists
 *
 * `applyArrears` (v31) gave the money axis a failure state — but only for the
 * six bill lines computed BEFORE the weekly money writeback. Every recurring
 * cost charged after it used the same shape:
 *
 *     ctx.newStats.money = Math.max(0, ctx.newStats.money - cost);
 *
 * which silently forgives whatever the player could not afford. That covers
 * luxury upkeep and insurance, crime fines and student-loan payments — roughly
 * half of all mandatory outgoings, and specifically the single largest one. A
 * player owning the full luxury collection owes $556,820/wk; when broke they
 * kept the collection, kept its $301,200/wk of yields, and booked nothing.
 *
 * So the game had two different answers to "you cannot pay" depending on which
 * side of the writeback the cost happened to sit on. This makes them one.
 *
 * ## The contract
 *
 * Pays as much as the player has, floors cash at 0 exactly as before (the
 * non-negative invariant ~40 call sites depend on is untouched), and records the
 * remainder on `ctx.deferredCharges` for the caller to fold into
 * `overdueBalance`.
 *
 * Deliberately NOT compounding: the shortfall is carried at face value. The
 * arrears post-mortem in `tasks/lessons.md` records a version that compounded a
 * surcharge on the standing debt and turned $1,000 into $144,755 over ten years
 * — a locked save, not pressure. Late fees belong in one place, and that place
 * is `applyArrears`.
 */

import type { WeekContext } from './weekContext';

export interface ChargeResult {
  /** Dollars actually taken from cash. */
  paid: number;
  /** Dollars the player could not cover, added to ctx.deferredCharges. */
  deferred: number;
}

const finite = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

export function chargeOrDefer(ctx: WeekContext, cost: number): ChargeResult {
  const owed = finite(cost);
  if (owed <= 0) return { paid: 0, deferred: 0 };

  const before = Math.max(0, finite(ctx.newStats.money));
  const paid = Math.min(before, owed);
  const deferred = owed - paid;

  ctx.newStats.money = before - paid;
  if (deferred > 0) {
    ctx.deferredCharges = finite(ctx.deferredCharges) + deferred;
  }
  return { paid, deferred };
}
