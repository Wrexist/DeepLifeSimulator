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
