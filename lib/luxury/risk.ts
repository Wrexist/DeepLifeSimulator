/**
 * Luxury risk — the last system that treated a collection as inert.
 *
 * THE GAP
 * -------
 * Everything else in the game can go wrong. Vehicles have `condition`,
 * `lib/vehicles/accidents.ts` and full insurance. Businesses fail, health
 * declines, careers fire you, markets crash. A $1.2B luxury collection was
 * perfectly safe forever: nothing could be stolen, burn, sink, or need
 * restoring.
 *
 * That also hollowed out Phase 4's appreciation. Value that only ever drifts
 * the way the catalog says is a schedule, not a market. Risk is what makes
 * owning the thing a position rather than a purchase.
 *
 * THE MODEL
 * ---------
 * Items carry `condition` (0-100) on their holding, exactly as vehicles do.
 * An incident knocks it down; a damaged item is worth less and can be restored
 * for cash. Nothing is ever DESTROYED — losing a $500M asset outright to a
 * dice roll would be the kind of punishment that makes players stop buying the
 * feature altogether.
 *
 * Insurance is the decision. A premium is a real weekly cost on top of upkeep,
 * and skipping it is a genuine gamble rather than a free win: insured, an
 * incident costs you a deductible and the item is made good; uninsured, you eat
 * the whole loss and pay to restore it yourself.
 *
 * Pure module: no React, no state mutation, no RNG of its own — rolls arrive
 * from the weekly tick's `preRolls`, the same way pet sickness and vehicle
 * accidents already work.
 */

import type { LuxuryHolding } from '@/contexts/game/types';
import { LUXURY_CATALOG, LUXURY_RESALE_FRACTION, type LuxuryItem } from './catalog';
import { getHoldingValue } from './operations';

/**
 * Insurer's margin over the expected loss.
 *
 * A premium priced BELOW expected loss makes insuring a no-brainer and removes
 * the decision; priced far above, nobody ever insures. At a modest margin,
 * insuring is slightly negative in pure cash and removes the variance — which
 * is exactly what insurance is, and makes it a genuine call rather than a
 * dominant strategy in either direction.
 */
export const INSURANCE_MARGIN = 1.25;
/** Share of an insured loss the owner still pays. */
export const INSURANCE_DEDUCTIBLE_FRACTION = 0.1;
/**
 * What restoring costs, as a multiple of the NET WORTH it gives back.
 *
 * R4-X4 fixed a 100x under-price here (a `_PCT`-named constant holding a
 * fraction, divided by 100 again at all three call sites) and then over-shot in
 * the other direction. The correction priced restoration off `getHoldingValue`,
 * the RAW item value — but net worth counts `getLuxuryHoldingValue`, which is
 * `getHoldingValue * LUXURY_RESALE_FRACTION * conditionValueMultiplier`. The
 * 0.6 resale fraction was in the value and not in the price, so restoring cost
 * a flat 1.818x the net worth it returned, for every item at every condition:
 * restore a damaged private island for $18,000,000 and gain $9,900,000. Never
 * restoring became the dominant strategy — the same inversion R4-X4 set out to
 * fix, pointing the other way.
 *
 * The fix is to stop expressing this as a fraction of "value" at all, since
 * there are two different values in play and the bug was picking the wrong one.
 * `getRestoreCost` now computes the value actually recovered and charges this
 * multiple of it, so the two can never drift again — including if
 * `LUXURY_RESALE_FRACTION` or the condition curve is ever retuned.
 *
 * At 1.0 an incident costs the owner, in cash, exactly the net worth it
 * destroyed. That is what makes the insurance decision the one the module
 * header describes: insured, you pay `INSURANCE_DEDUCTIBLE_FRACTION` of that
 * and are made good; uninsured, you eat the whole thing; and premiums run
 * `INSURANCE_MARGIN` times the expected loss, so insuring is slightly negative
 * in pure cash and removes the variance.
 */
export const RESTORE_COST_MULTIPLE_OF_VALUE_RECOVERED = 1.0;
/** Below this, an item is visibly in trouble. */
export const CONDITION_POOR = 60;

export interface LuxuryRisk {
  /** Chance per week that something happens. */
  weeklyChance: number;
  /** Condition points lost when it does. */
  severity: number;
  /** What happened, for the notification. */
  label: string;
}

/**
 * Per-item risk. Tuned so the EXPECTED weekly condition loss is small — these
 * are rare events that matter when they land, not a slow tax. Items that sit in
 * a vault are safer than items that move, which is both true and makes the
 * yacht's charter income feel earned.
 */
const RISK_BY_ID: Readonly<Record<string, LuxuryRisk>> = {
  rare_watch_collection: { weeklyChance: 0.004, severity: 30, label: 'a burglary' },
  museum_diamond: { weeklyChance: 0.003, severity: 35, label: 'an attempted theft' },
  fine_art_collection: { weeklyChance: 0.005, severity: 30, label: 'water damage' },
  supercar: { weeklyChance: 0.008, severity: 40, label: 'a garage incident' },
  racehorse: { weeklyChance: 0.010, severity: 45, label: 'a training injury' },
  vineyard_estate: { weeklyChance: 0.007, severity: 25, label: 'a bad frost' },
  luxury_yacht: { weeklyChance: 0.008, severity: 30, label: 'a storm at anchor' },
  private_jet: { weeklyChance: 0.005, severity: 25, label: 'a hangar mishap' },
  private_island: { weeklyChance: 0.006, severity: 25, label: 'a tropical storm' },
  trophy_penthouse: { weeklyChance: 0.003, severity: 20, label: 'a burst riser' },
  mega_yacht: { weeklyChance: 0.007, severity: 30, label: 'a grounding' },
  sports_team_stake: { weeklyChance: 0.004, severity: 20, label: 'a disastrous season' },
};

export function getLuxuryRisk(itemId: string): LuxuryRisk | undefined {
  return RISK_BY_ID[itemId];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Condition of a holding. Absent means pristine — old saves are undamaged. */
export function getCondition(holding: LuxuryHolding | undefined): number {
  const c = holding?.condition;
  return typeof c === 'number' && Number.isFinite(c) ? clamp(c, 0, 100) : 100;
}

/**
 * How much condition is worth.
 *
 * A damaged item loses value but never becomes worthless — even a wrecked
 * hypercar is worth something, and a floor keeps a run of bad luck from
 * zeroing a nine-figure asset.
 */
export function conditionValueMultiplier(condition: number): number {
  return clamp(0.45 + (clamp(condition, 0, 100) / 100) * 0.55, 0.45, 1);
}

/**
 * Weekly premium for one insured item, priced off that item's OWN risk.
 *
 * A racehorse is expensive to insure because it gets hurt; a penthouse is cheap
 * because very little happens to it. A single flat rate across the catalog
 * would have made the safe items subsidise the dangerous ones and flattened the
 * per-item decision into one global yes/no.
 */
export function getItemPremium(item: LuxuryItem, holding: LuxuryHolding | undefined): number {
  if (!holding?.insured) return 0;
  return Math.round(getExpectedWeeklyLoss(item, holding) * INSURANCE_MARGIN);
}

/**
 * What this item is expected to cost its owner per week if left uninsured —
 * the chance of an incident times the value that incident destroys.
 *
 * Exposed because it is what makes the premium legible: the UI can say "costs
 * $X, saves you $Y on average" instead of quoting a rate nobody can evaluate.
 */
export function getExpectedWeeklyLoss(item: LuxuryItem, holding: LuxuryHolding | undefined): number {
  const risk = RISK_BY_ID[item.id];
  if (!risk) return 0;
  const value = getHoldingValue(item, holding);
  // Condition points lost, converted to the value they represent.
  const valueLostPerIncident = value * (1 - conditionValueMultiplier(100 - risk.severity));
  return risk.weeklyChance * valueLostPerIncident;
}

/** Total weekly premiums across an owned collection. */
export function getTotalPremiums(
  ownedIds: readonly string[] | undefined | null,
  holdings: Record<string, LuxuryHolding> | undefined | null,
): number {
  if (!ownedIds) return 0;
  let total = 0;
  for (const item of LUXURY_CATALOG) {
    if (!ownedIds.includes(item.id)) continue;
    total += getItemPremium(item, holdings?.[item.id]);
  }
  return total;
}

/**
 * Net worth a repair from `fromCondition` back to pristine would give back.
 *
 * Deliberately computed the same way `getLuxuryHoldingValue` computes the
 * value itself — raw value, times `LUXURY_RESALE_FRACTION`, times the condition
 * curve — so the price of a repair and the worth of a repair cannot drift.
 * Pricing off the RAW value while net worth counted the resale-adjusted value
 * is what made restoring cost 1.818x what it returned.
 */
export function valueRecoveredByRestoring(
  item: LuxuryItem,
  holding: LuxuryHolding | undefined,
): number {
  const from = getCondition(holding);
  if (from >= 100) return 0;
  const raw = getHoldingValue(item, holding);
  const gain = conditionValueMultiplier(100) - conditionValueMultiplier(from);
  return raw * LUXURY_RESALE_FRACTION * gain;
}

/**
 * Cash needed to restore an item to pristine.
 *
 * Charged as a multiple of the net worth the repair returns, NOT as a fraction
 * of the item's raw value — see `RESTORE_COST_MULTIPLE_OF_VALUE_RECOVERED`.
 */
export function getRestoreCost(item: LuxuryItem, holding: LuxuryHolding | undefined): number {
  const recovered = valueRecoveredByRestoring(item, holding);
  if (recovered <= 0) return 0;
  return Math.round(recovered * RESTORE_COST_MULTIPLE_OF_VALUE_RECOVERED);
}

export interface Incident {
  itemId: string;
  itemName: string;
  label: string;
  /** Condition points actually lost (0 when insurance made it good). */
  conditionLost: number;
  /** Cash the owner paid — the deductible when insured, 0 when not. */
  cost: number;
  insured: boolean;
  message: string;
}

export interface RiskWeekResult {
  /** Holdings after incidents. SAME reference when nothing happened. */
  holdings: Record<string, LuxuryHolding> | undefined;
  /** Total cash owed this week: premiums + any deductibles. */
  cashOwed: number;
  incidents: Incident[];
}

/**
 * Roll one week of risk across an owned collection.
 *
 * `rolls` comes from the tick's pre-rolls, indexed per item, so the outcome is
 * part of the same deterministic draw as every other weekly event.
 *
 * Insured items are made good immediately: the point of insurance is that you
 * do not spend the next ten weeks with a damaged asset, you pay a deductible
 * and it is handled.
 */
export function applyLuxuryRiskForWeek(
  ownedIds: readonly string[] | undefined | null,
  holdings: Record<string, LuxuryHolding> | undefined | null,
  rolls: readonly number[] | undefined,
): RiskWeekResult {
  const current = holdings || {};
  const owned = ownedIds || [];
  let next: Record<string, LuxuryHolding> | null = null;
  const incidents: Incident[] = [];

  let cashOwed = getTotalPremiums(owned, current);

  let rollIndex = 0;
  for (const item of LUXURY_CATALOG) {
    if (!owned.includes(item.id)) continue;
    const risk = RISK_BY_ID[item.id];
    if (!risk) continue;

    // Wrap the roll array so any collection size is covered (same contract as
    // the pet-sickness reducer).
    const rollPool = Array.isArray(rolls) && rolls.length > 0 ? rolls : null;
    const roll = rollPool ? rollPool[rollIndex % rollPool.length] : 1;
    rollIndex += 1;
    if (!(roll < risk.weeklyChance)) continue;

    const holding = current[item.id];
    const insured = !!holding?.insured;
    const before = getCondition(holding);
    const value = getHoldingValue(item, holding);

    if (insured) {
      // Made good. The owner pays a deductible on the repair, not the repair.
      // A share of the REPAIR, priced exactly as an uninsured owner would pay
      // for it — so "insured costs you a tenth of the damage" is literally true.
      const repairCost = getRestoreCost(item, {
        ...(holding ?? { acquiredWeek: 0 }),
        condition: Math.max(0, before - risk.severity),
      });
      const deductible = Math.round(repairCost * INSURANCE_DEDUCTIBLE_FRACTION);
      cashOwed += deductible;
      incidents.push({
        itemId: item.id,
        itemName: item.name,
        label: risk.label,
        conditionLost: 0,
        cost: deductible,
        insured: true,
        message: `${item.name}: ${risk.label}. Insurance covered it — you paid $${deductible.toLocaleString()}.`,
      });
      continue;
    }

    const after = clamp(before - risk.severity, 0, 100);
    if (after === before) continue;
    if (!next) next = { ...current };
    next[item.id] = { ...(holding ?? { acquiredWeek: 0 }), condition: after };
    incidents.push({
      itemId: item.id,
      itemName: item.name,
      label: risk.label,
      conditionLost: before - after,
      cost: 0,
      insured: false,
      message: `${item.name}: ${risk.label}. It was not insured — condition is down to ${after}%.`,
    });
  }

  return { holdings: next ?? (holdings ?? undefined), cashOwed, incidents };
}
