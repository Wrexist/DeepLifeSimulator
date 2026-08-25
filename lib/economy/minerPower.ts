/**
 * Miner electricity — the ONE power-cost source of truth (2026-08-25 economy audit).
 *
 * Until this file existed there were THREE disagreeing copies of "what a miner
 * costs to run" and NONE of them was charged for company rigs:
 *
 *   - `expenses.ts` displayed company power at $0.20/unit/DAY (≈ $1.50/unit/wk)
 *     and warehouse power at $0.60/unit/wk — display only, one caller
 *     (IdentityCard), nothing in the tick.
 *   - `IdentityCard.tsx` carried a literal copy of the company table + formula.
 *   - `lib/crypto/miningEarnings.ts` CHARGES warehouse rigs $0.40/unit/wk
 *     (deducted in-crypto by `applyMiningCryptos`, reduced by power upgrades).
 *
 * So company miners were pure profit (income paid via `calcWeeklyPassiveIncome`,
 * power never charged — the same defect the warehouse fix H-2 closed), while the
 * expense panel overstated the player's real bills. The canonical rate is the
 * one that was actually being charged: **$0.40 per power unit per week**, at
 * warehouse parity ("balanced to match warehouse efficiency" is the design note
 * on the company earnings table). Company rigs have no power upgrades, so their
 * cost is the flat rate.
 *
 * Consumers: `calcWeeklyPassiveIncome` (nets it against company mining income —
 * what the tick pays), `expenses.ts` and `IdentityCard` (what the UI shows).
 * One number, both places.
 */

/** Power draw units per miner, shared by company and warehouse rigs. */
export const MINER_POWER_UNITS: Record<string, number> = {
  basic: 10,
  advanced: 35,
  pro: 100,
  industrial: 250,
  quantum: 500,
  mega: 2000,
  giga: 5000,
  tera: 15000,
} as const;

/**
 * Weekly electricity cost per power unit, in dollars. Matches the rate
 * `lib/crypto/miningEarnings.ts` charges warehouse rigs (before its
 * power-upgrade reductions, which company rigs cannot buy).
 */
export const POWER_COST_PER_UNIT_WEEKLY = 0.4;

/**
 * Weekly electricity bill for a fleet of miners (`{ minerId: count }`).
 * Defensive against missing/garbage counts; returns a rounded, non-negative
 * dollar amount.
 */
export function minerFleetWeeklyPowerCost(
  miners: Record<string, number> | undefined | null,
): number {
  if (!miners) return 0;
  let totalPower = 0;
  for (const [id, count] of Object.entries(miners)) {
    const units = MINER_POWER_UNITS[id] || 0;
    const safeCount =
      typeof count === 'number' && isFinite(count) && count > 0 ? Math.floor(count) : 0;
    totalPower += units * safeCount;
  }
  const cost = totalPower * POWER_COST_PER_UNIT_WEEKLY;
  return isFinite(cost) && cost > 0 ? Math.round(cost) : 0;
}
