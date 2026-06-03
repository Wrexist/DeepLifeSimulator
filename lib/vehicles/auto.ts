/**
 * Auto-loan financing for vehicle purchases.
 *
 * Mirrors `lib/realEstate/mortgage.ts` but tuned for cars:
 *   - Shorter terms (3 / 5 / 7 years)
 *   - Down payment tiers (10 / 20 / 50 / cash)
 *   - Standard auto APR 8% baseline (matches banking `baseByType.auto`)
 *
 * Pure math. No state, no React.
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type AutoDownTier = 'low' | 'standard' | 'high' | 'cash';

export const AUTO_DOWN_FRACTIONS: Record<AutoDownTier, number> = {
  low:      0.10,
  standard: 0.20,
  high:     0.50,
  cash:     1.00,
};

/** Term options in weeks (3-7 years). */
export const AUTO_TERM_WEEKS = {
  '3y': 3 * 52,
  '5y': 5 * 52,
  '7y': 7 * 52,
} as const;

export type AutoTerm = keyof typeof AUTO_TERM_WEEKS;

/** APR adjustments: low-down → bump up; high-down → modest discount. */
export const AUTO_PMI_SURCHARGE = 0.005;        // +0.5%
export const AUTO_HIGH_DOWN_DISCOUNT = 0.002;   // -0.2%

/** Maximum loan-to-value for an auto loan. Newer vehicles ≤ 95%; older ≤ 80%. */
export function maxLTVFor(year: number, currentYear: number): number {
  const age = Math.max(0, currentYear - year);
  if (age <= 2) return 0.95;
  if (age <= 5) return 0.90;
  if (age <= 10) return 0.80;
  return 0.65;
}

export interface AutoQuoteInputs {
  /** Sticker price of the vehicle. */
  price: number;
  tier: AutoDownTier;
  term: AutoTerm;
  availableCash: number;
  /** Year of the vehicle (used for LTV ceiling). */
  vehicleYear: number;
  /** Current game year. */
  currentYear: number;
}

export interface AutoOrigination {
  downPaymentUSD: number;
  loanPrincipal: number;
  termWeeks: number;
  aprAdjustment: number;
  ltv: number;
}

export function originateAuto(input: AutoQuoteInputs): AutoOrigination {
  const price = Math.max(0, safe(input.price));
  const fraction = AUTO_DOWN_FRACTIONS[input.tier];
  const downPaymentUSD = price * fraction;
  const loanPrincipal = Math.max(0, price - downPaymentUSD);
  const termWeeks = AUTO_TERM_WEEKS[input.term];
  const ltv = price > 0 ? loanPrincipal / price : 0;
  let aprAdjustment = 0;
  if (input.tier === 'low') aprAdjustment += AUTO_PMI_SURCHARGE;
  else if (input.tier === 'high') aprAdjustment -= AUTO_HIGH_DOWN_DISCOUNT;
  return { downPaymentUSD, loanPrincipal, termWeeks, aprAdjustment, ltv };
}

/**
 * Pre-flight check. Returns null on OK, or a human-readable rejection reason.
 */
export function autoPreflight(input: AutoQuoteInputs): string | null {
  const orig = originateAuto(input);
  if (input.availableCash < orig.downPaymentUSD) {
    return `Need $${Math.ceil(orig.downPaymentUSD - input.availableCash).toLocaleString()} more for down payment`;
  }
  const maxLtv = maxLTVFor(input.vehicleYear, input.currentYear);
  if (orig.ltv > maxLtv) {
    return `Loan-to-value exceeds ${Math.round(maxLtv * 100)}% ceiling for ${input.currentYear - input.vehicleYear}-year-old vehicle`;
  }
  return null;
}
