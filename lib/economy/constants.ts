import { RENT_INCOME_RATE } from '@/lib/config/gameConstants';

/**
 * Canonical miner prices — single source of truth.
 * Must match the miner definitions in BitcoinMiningApp.tsx.
 */
export const MINER_PRICES: Record<string, number> = {
  basic: 2500,
  advanced: 10000,
  pro: 40000,
  industrial: 125000,
  quantum: 500000,
  mega: 2500000,
  giga: 10000000,
  tera: 50000000,
} as const;

/** Weekly rent rate as a fraction of property value.
 *  Derived from the canonical RENT_INCOME_RATE in gameConstants.ts. */
export const PLAYER_RENT_RATE_WEEKLY = RENT_INCOME_RATE;
// ANTI-EXPLOIT: Savings APR must be LOWER than loan base APR (8%) to prevent loan-to-savings arbitrage
export const SAVINGS_APR_BASE = 0.03; // 3% base (was 15% - created free money via loan arbitrage)
export const SAVINGS_APR_FINANCIAL_PLANNING = 0.05; // 5% with financial planning (was 30%)
/**
 * ANTI-ARBITRAGE hard ceiling on the EFFECTIVE savings APR after the Good-Credit
 * perk stack (up to 5% × 1.5 × 1.5 = 11.25%). Kept strictly below the cheapest
 * borrow rate (private-banking loan floor = PRIVATE_BANKING_APR_CAP = 6%) so that
 * "borrow cheap → park in savings" can never turn a profit. 5.5% leaves margin.
 */
export const SAVINGS_APR_HARD_CAP = 0.055;
export const LOAN_MISSED_PAYMENT_PENALTY = 0.01;
// ANTI-EXPLOIT: Savings balance cap - diminishing returns above this threshold
export const SAVINGS_BALANCE_SOFT_CAP = 500_000; // Interest efficiency drops above $500K
export const SAVINGS_CAP_EFFICIENCY = 0.25; // 25% efficiency on balance above soft cap

// ---------------------------------------------------------------------------
// Progressive Income Tax — weekly brackets
// Applied to totalIncome (career + passive + partner) each week.
// Rates are marginal: only income ABOVE each threshold is taxed at that rate.
// ---------------------------------------------------------------------------
export const INCOME_TAX_BRACKETS = [
  { threshold: 0,      rate: 0.00 },  // First $200/week tax-free (poverty floor)
  { threshold: 200,    rate: 0.10 },  // 10% on $200-$1K
  { threshold: 1_000,  rate: 0.20 },  // 20% on $1K-$5K
  { threshold: 5_000,  rate: 0.30 },  // 30% on $5K-$25K
  { threshold: 25_000, rate: 0.40 },  // 40% on $25K+
] as const;

/**
 * Calculate progressive income tax for a given weekly income.
 * Returns the tax amount (not rate).
 */
export function calculateIncomeTax(weeklyIncome: number): number {
  if (weeklyIncome <= 0) return 0;

  let tax = 0;
  const brackets = INCOME_TAX_BRACKETS;

  for (let i = brackets.length - 1; i >= 0; i--) {
    if (weeklyIncome > brackets[i].threshold) {
      const taxableAtThisRate = weeklyIncome - brackets[i].threshold;
      tax += taxableAtThisRate * brackets[i].rate;
      weeklyIncome = brackets[i].threshold; // move down to next bracket
    }
  }

  return Math.round(tax);
}

// ---------------------------------------------------------------------------
// Mining income cap
// ---------------------------------------------------------------------------

/**
 * How long a mining rig takes to pay for itself, in weeks.
 *
 * The PRICE ladder above and the weekly-earnings ladder in `applyMiningCryptos`
 * were authored consistently: every tier from basic to tera costs almost
 * exactly 71 weeks of its own gross output. What broke the top of the ladder
 * was the CAP, not the prices.
 */
export const MINING_PAYBACK_WEEKS = 71;

/** The floor the cap never drops below - the historic flat cap. */
export const MINING_INCOME_CAP_BASE = 100_000;

/**
 * Weekly ceiling on mining income for a given fleet.
 *
 * The cap used to be a flat $100,000/week, which made the two most expensive
 * rigs unbuyable-by-arithmetic (2026-08-25 economy audit): a giga grosses
 * $140k/wk and a tera $700k/wk, so the flat cap clipped them to $100k and
 * turned their paybacks into 100 and 500 weeks against the 71 every other tier
 * pays - and a second big rig added literally nothing. $50,000,000 of hardware
 * you could buy and never recover. Two dead SKUs on the shop shelf.
 *
 * Scaling the cap with the capital actually deployed - the `companyIncomeCap`
 * idiom of a base plus a per-unit allowance - restores one honest payback for
 * the whole ladder without turning mining into free money: the ceiling is
 * exactly `capital / MINING_PAYBACK_WEEKS`, so mining can never return faster
 * than that no matter how much hardware is bought, and every dollar of that
 * return had to be a dollar put at risk first. Fleets under ~$7.1M are
 * unaffected - the $100k base still binds, exactly as before.
 */
export function miningIncomeCap(miners: Record<string, number> | undefined | null): number {
  let capital = 0;
  for (const [id, count] of Object.entries(miners ?? {})) {
    const price = MINER_PRICES[id] ?? 0;
    const safeCount =
      typeof count === 'number' && isFinite(count) && count > 0 ? Math.floor(count) : 0;
    capital += price * safeCount;
  }
  const earned = capital / MINING_PAYBACK_WEEKS;
  if (!isFinite(earned) || earned <= 0) return MINING_INCOME_CAP_BASE;
  return Math.max(MINING_INCOME_CAP_BASE, Math.round(earned));
}
