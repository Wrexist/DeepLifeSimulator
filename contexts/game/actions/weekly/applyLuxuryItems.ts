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
  appreciateLuxuryHoldings,
  getTotalLuxuryHappiness,
  getTotalLuxuryPrestige,
  getCollectionReputationBonus,
  getTotalLuxuryUpkeep,
  getTotalLuxuryYield,
  getLoanIncome,
  applyLuxuryRiskForWeek,
} from '@/lib/luxury';
import type { LuxuryHolding } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';
import { chargeOrDefer } from './chargeOrDefer';

export interface LuxuryWeekResult {
  /** Total upkeep deducted (the deduction already happened). */
  upkeep: number;
  /** Total yield credited (the credit already happened). */
  yield: number;
  /** Holdings after appreciation. SAME reference when nothing drifted. */
  holdings: Record<string, LuxuryHolding> | undefined;
  /** Net market-value change this week — net worth, not cash. */
  valueDelta: number;
  /** Premiums + deductibles charged this week. */
  riskCost: number;
  /** Player-facing lines for anything that went wrong. */
  incidents: string[];
}

export function applyLuxuryItemsForWeek(
  luxuryItemIds: string[] | undefined | null,
  ctx: WeekContext,
  holdings?: Record<string, LuxuryHolding> | null,
): LuxuryWeekResult {
  const ids = luxuryItemIds || [];
  if (ids.length === 0) {
    return { upkeep: 0, yield: 0, holdings: holdings ?? undefined, valueDelta: 0, riskCost: 0, incidents: [] };
  }

  // (a) Yield THEN upkeep, in that order and for a reason.
  //
  // Yield is charter fees, vintage sales, a season dividend — real cash the
  // collection produces. It is credited FIRST so the upkeep is charged against
  // it. Deducting first would floor a broke player at $0 and then hand them the
  // yield on top, which makes going broke *profitable*: a player with nothing
  // owning the mega-yacht would collect $85,000/wk and never pay its $150,000
  // upkeep. Crediting first means an insolvent week nets zero, never a gain.
  //
  // Both are mirror-safe: stats.money only, never a mirrored bank balance.
  // A museum loan pays a weekly fee for as long as the piece is on display, on
  // top of the catalog yields. It ends by itself when the loan expires.
  const yieldTotal = getTotalLuxuryYield(ids) + getLoanIncome(ids, holdings, ctx.nextWeeksLived);
  if (yieldTotal > 0) {
    const beforeYield = typeof ctx.newStats.money === 'number' && isFinite(ctx.newStats.money) ? ctx.newStats.money : 0;
    ctx.newStats.money = beforeYield + yieldTotal;
  }

  const upkeep = getTotalLuxuryUpkeep(ids);
  if (upkeep > 0) {
    // Upkeep is MANDATORY, so an unaffordable week must book arrears rather
    // than vanish. This was the single largest forgiven cost in the game: a
    // full collection owes $556,820/wk, and a broke owner kept the collection
    // AND its $301,200/wk of yields while booking nothing.
    chargeOrDefer(ctx, upkeep);
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
  // Completed COLLECTIONS lift the same soft target rather than granting
  // reputation outright — finishing a set changes the ceiling you drift toward,
  // one LUXURY_REPUTATION_STEP a week, exactly like the per-item path. Both are
  // clamped by LUXURY_REPUTATION_CAP, so no combination of sets can rail past
  // the ceiling that already existed.
  const prestige = getTotalLuxuryPrestige(ids) + getCollectionReputationBonus(ids);
  if (prestige > 0) {
    const target = Math.min(LUXURY_REPUTATION_CAP, prestige);
    const rep = typeof ctx.newStats.reputation === 'number' && isFinite(ctx.newStats.reputation) ? ctx.newStats.reputation : 0;
    if (rep < target) {
      ctx.newStats.reputation = Math.min(target, rep + LUXURY_REPUTATION_STEP);
    }
  }

  // (e) Appreciation — value drift on the holdings. This moves NET WORTH, not
  // cash; the player only realises it when they sell. Returns the same holdings
  // reference when nothing drifted, so a collection of pure trophies causes no
  // state churn.
  const { holdings: appreciated, valueDelta } = appreciateLuxuryHoldings(ids, holdings);

  // (f) Risk — insurance premiums, and the occasional theft, storm or injury.
  // Rolls come from the tick's pre-rolls, the same draw pet sickness and
  // vehicle accidents use, so an incident is part of the deterministic week.
  const risk = applyLuxuryRiskForWeek(ids, appreciated, ctx.preRolls?.luxuryIncident);
  if (risk.cashOwed > 0) {
    // Premiums and deductibles are mandatory too — defer, don't forgive.
    chargeOrDefer(ctx, risk.cashOwed);
  }
  for (const incident of risk.incidents) {
    ctx.notifications.push({
      id: `luxury-incident-${incident.itemId}-${ctx.nextWeeksLived}`,
      title: incident.insured ? 'Insurance claim' : 'Incident',
      message: incident.message,
    });
  }

  return {
    upkeep,
    yield: yieldTotal,
    holdings: risk.holdings,
    valueDelta,
    riskCost: risk.cashOwed,
    incidents: risk.incidents.map((i) => i.message),
  };
}
