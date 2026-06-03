/**
 * Mortgage origination + equity math for RealEstateApp Remake 4.
 *
 * Bridges the new banking system (Loan with type='mortgage') to the property
 * acquisition flow. Pure functions — no React, no setGameState.
 *
 * Down payment ladders, equity calculations, and LTV checks live here. The
 * actual loan quote (APR, weekly payment) is delegated to lib/banking/operations
 * `quoteLoan` since it already handles credit score, DTI, and politics-perk discounts.
 */

import { Loan } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * Conventional down-payment tiers. The player picks one when buying:
 *   - low (10%): highest APR adjustment, PMI applies (we model as +0.5% APR)
 *   - standard (20%): industry-standard, no PMI
 *   - high (40%): cheaper APR (lender discount, smaller loan)
 *   - cash (100%): no mortgage at all
 */
export type DownPaymentTier = 'low' | 'standard' | 'high' | 'cash';

export const DOWN_PAYMENT_FRACTIONS: Record<DownPaymentTier, number> = {
  low:      0.10,
  standard: 0.20,
  high:     0.40,
  cash:     1.00,
};

/** PMI surcharge (private mortgage insurance) on low-down-payment loans. */
export const PMI_APR_SURCHARGE = 0.005; // 0.5%

/** Extra APR discount for high-down-payment buyers (less risk). */
export const HIGH_DOWN_APR_DISCOUNT = 0.0025; // 0.25% off

/** Loan-to-value ceiling that lenders accept. Above this, mortgage is denied. */
export const MAX_LTV = 0.95;

/** Standard mortgage term in weeks (30 years × 52). */
export const STANDARD_MORTGAGE_TERM_WEEKS = 30 * 52;

/** Shorter terms players can pick — saves total interest, higher weekly payment. */
export const TERM_OPTIONS_WEEKS = {
  '15y': 15 * 52,
  '30y': 30 * 52,
} as const;

export type MortgageTerm = keyof typeof TERM_OPTIONS_WEEKS;

export interface MortgageOriginationInputs {
  /** Purchase price of the property. */
  purchasePrice: number;
  /** Player's chosen down-payment tier. */
  tier: DownPaymentTier;
  /** Player's chosen term length. */
  term: MortgageTerm;
  /** Cash on hand — must cover at least the down payment. */
  availableCash: number;
}

export interface MortgageOrigination {
  /** USD the player pays at closing. */
  downPaymentUSD: number;
  /** USD financed via mortgage (0 if cash purchase). */
  loanPrincipal: number;
  /** Term in weeks. */
  termWeeks: number;
  /** APR adjustment to add on top of the base mortgage rate (PMI surcharge or down-payment discount). */
  aprAdjustment: number;
  /** LTV (loan-to-value) ratio. */
  ltv: number;
}

/**
 * Compute the mortgage origination split (down payment + financed amount) for a buy.
 * Pure math; caller does balance checks against actual cash.
 */
export function originateMortgage(input: MortgageOriginationInputs): MortgageOrigination {
  const price = Math.max(0, safe(input.purchasePrice));
  const fraction = DOWN_PAYMENT_FRACTIONS[input.tier];
  const downPaymentUSD = price * fraction;
  const loanPrincipal = Math.max(0, price - downPaymentUSD);
  const termWeeks = TERM_OPTIONS_WEEKS[input.term];
  const ltv = price > 0 ? loanPrincipal / price : 0;

  // APR adjustment by tier:
  //  - low down → +PMI surcharge
  //  - high down → discount
  //  - cash → no loan, no adjustment
  let aprAdjustment = 0;
  if (input.tier === 'low') aprAdjustment += PMI_APR_SURCHARGE;
  else if (input.tier === 'high') aprAdjustment -= HIGH_DOWN_APR_DISCOUNT;

  return { downPaymentUSD, loanPrincipal, termWeeks, aprAdjustment, ltv };
}

/**
 * Pre-flight checks before the bank even quotes a loan. Returns null if OK,
 * or an error string describing the issue.
 */
export function mortgagePreflight(input: MortgageOriginationInputs): string | null {
  const orig = originateMortgage(input);
  if (input.availableCash < orig.downPaymentUSD) {
    return `Need $${Math.ceil(orig.downPaymentUSD - input.availableCash).toLocaleString()} more for down payment`;
  }
  if (orig.ltv > MAX_LTV) {
    return 'Loan-to-value ratio exceeds lender ceiling';
  }
  return null;
}

/**
 * Equity in a property = current market value − outstanding mortgage balance.
 * Used by net-worth aggregation and refinance/HELOC quoting.
 */
export function propertyEquity(currentValue: number, mortgageRemaining: number): number {
  return Math.max(0, safe(currentValue) - safe(mortgageRemaining));
}

/**
 * Quote a refinance: if you've built equity, you can shrink the principal
 * to current value × LTV, lock in a new rate. Returns null if no improvement.
 */
export function refinanceQuote(
  currentValue: number,
  loan: Loan,
  newAPR: number
): { canRefinance: boolean; oldRate: number; newRate: number; estimatedSavings: number } | null {
  const remaining = safe(loan.remaining);
  if (remaining <= 0) return null;
  const oldRate = safe(loan.rateAPR);
  const value = safe(currentValue);
  if (value <= 0 || newAPR >= oldRate) return null;
  // Rough savings estimate: rate delta × remaining principal × half the remaining term
  // (good enough for UI display; the actual schedule is recomputed on accept).
  const halfTerm = Math.max(1, safe(loan.weeksRemaining) / 2);
  const estimatedSavings = (oldRate - newAPR) * remaining * (halfTerm / 52);
  return {
    canRefinance: true,
    oldRate,
    newRate: newAPR,
    estimatedSavings,
  };
}
