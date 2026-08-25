/**
 * The tax ledger — one place that can answer "what am I paying, and why?".
 *
 * ## The problem this exists to fix
 *
 * The game taxes the player in five uncoordinated places and tells them almost
 * nothing about any of it:
 *
 * | Stream                    | Rate                | Cadence               |
 * |---------------------------|---------------------|-----------------------|
 * | Income (salary/passive/…) | 0/10/20/30/40% prog | weekly, withheld      |
 * | Stock gains + dividends   | 25% flat            | weekly, at realization|
 * | Crypto gains              | 25% flat            | yearly (week % 52)    |
 * | Property gains            | 15% flat            | on sale               |
 * | Property tax              | ~1.2%/yr            | weekly carrying cost  |
 *
 * The only surface for any of it was a single `Tax -$N` line in the weekly
 * summary, plus two bank-app rows reading `banking.taxDueThisYear` — a field
 * **nothing in the repo has ever written**, so both rows are gated behind a
 * `> 0` check that can never be true. (`docs/app-depth-audit.json` flagged that
 * and it was never actioned.) The player has no way to learn the brackets exist,
 * no year-to-date total, and no reason to believe the Tax Strategy life skill
 * does anything.
 *
 * This module supplies the arithmetic for that missing surface. It is PURE — no
 * state, no side effects — so the Bank app and the week loop share one
 * implementation and cannot drift the way the passive-income readout and its
 * charge once did.
 *
 * ## `taxDueThisYear`, repurposed
 *
 * The field's original comment promised "capital-gains/tax accrual — debited
 * yearly", which never happened. Rather than adding a new field (a migration and
 * a `repairGameState` mirror for what is really a rename), it becomes the
 * **year-to-date tax PAID** accumulator, which is the honest reading for a
 * withholding design. No migration is needed: the stored value is 0 on every
 * save in existence, and 0 is also the correct value for "nothing paid yet this
 * year". The v22 migration already backfills it.
 */

import { INCOME_TAX_BRACKETS, calculateIncomeTax } from './constants';

/** A game year. The crypto tick's year boundary uses the same number. */
export const TAX_YEAR_WEEKS = 52;

// ---------------------------------------------------------------------------
// Capital gains - THE single source, and why the regimes differ
// ---------------------------------------------------------------------------
//
// Three asset classes realize gains under three deliberately different
// treatments (2026-08-25 economy audit: the asymmetry is intentional, and it
// was undocumented, which made it read as drift - so the reasoning lives here,
// next to the numbers):
//
//   - STOCKS: 25%, withheld at the moment of sale. Fully liquid, 2% commission
//     each way, no other friction - the tax IS the friction.
//   - CRYPTO: the same 25%, but settled once per game year at the 52-week
//     boundary (`lib/crypto/weeklyTick.ts`). A timing difference, not a rate
//     difference - it models annual filing, and the deferral is the asset's
//     one small structural perk against its far higher variance.
//   - PROPERTY: 15% on the realized gain - LOWER on purpose, because a sale
//     already pays 6% closing costs (`lib/realEstate/operations.ts`) and the
//     asset is illiquid for weeks of game time. Equalizing the rate on top of
//     that friction would make property strictly tax-worse than paper assets.
//
// Anyone changing one of these should re-check the other two and the audit's
// investment-balance table; a copy of either number anywhere else is a bug
// (lib/stocks/weeklyTick re-exports the stock rate from here for exactly that
// reason - it used to carry its own 0.25 literal).

/** Realized gains + dividends on stocks and crypto. */
export const CAPITAL_GAINS_TAX_RATE = 0.25;

/** Realized gains on a property sale (`lib/realEstate/operations.ts`). */
export const PROPERTY_GAINS_TAX_RATE = 0.15;

const finite = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb;

export interface TaxBracketRow {
  /** Weekly income at which this bracket starts. */
  from: number;
  /** Weekly income at which it ends, or null for the top bracket. */
  to: number | null;
  rate: number;
  /** How much of THIS player's income falls in this bracket. */
  taxedAmount: number;
  /** Tax owed from this bracket alone (before any multiplier). */
  tax: number;
  /** True for the bracket the player's last dollar lands in. */
  isCurrent: boolean;
}

/**
 * Break a weekly income down bracket by bracket.
 *
 * Returned in ascending order so it reads top-to-bottom like a real tax table.
 * `tax` is pre-multiplier: the Tax Strategy discount applies to the total, not
 * to any one band, so mixing it in here would misreport the marginal rates.
 */
export function bracketBreakdown(weeklyIncome: number): TaxBracketRow[] {
  const income = Math.max(0, finite(weeklyIncome));
  const brackets = INCOME_TAX_BRACKETS;

  return brackets.map((b, i) => {
    const next = brackets[i + 1];
    const to = next ? next.threshold : null;
    const upper = to == null ? income : Math.min(income, to);
    const taxedAmount = Math.max(0, upper - b.threshold);
    return {
      from: b.threshold,
      to,
      rate: b.rate,
      taxedAmount,
      tax: Math.round(taxedAmount * b.rate),
      isCurrent: income > b.threshold && (to == null || income <= to),
    };
  });
}

/** The rate the player's NEXT dollar is taxed at. */
export function marginalRate(weeklyIncome: number): number {
  const income = Math.max(0, finite(weeklyIncome));
  let rate = 0;
  for (const b of INCOME_TAX_BRACKETS) {
    if (income > b.threshold) rate = b.rate;
  }
  return rate;
}

/**
 * Tax as a share of gross — always well below the marginal rate, which is the
 * whole point of showing it. A player at the 40% band whose effective rate is
 * 31% is looking at progressivity working, not at a bug.
 */
export function effectiveTaxRate(weeklyIncome: number, taxMult = 1): number {
  const income = Math.max(0, finite(weeklyIncome));
  if (income <= 0) return 0;
  return (calculateIncomeTax(income) * clampTaxMult(taxMult)) / income;
}

/**
 * Clamp a tax multiplier to the same band `lifeSkillEffects` enforces, so a
 * corrupt save or a future skill cannot produce a negative or amplified bill.
 */
export function clampTaxMult(mult: unknown): number {
  const m = finite(mult, 1);
  return Math.max(0.5, Math.min(1.5, m));
}

/** 1-based week within the current tax year (1…52). */
export function weekOfTaxYear(weeksLived: number): number {
  const w = Math.max(0, Math.floor(finite(weeksLived)));
  if (w <= 0) return 0;
  return ((w - 1) % TAX_YEAR_WEEKS) + 1;
}

/** 1-based tax year (weeks 1–52 are year 1). */
export function taxYearOf(weeksLived: number): number {
  const w = Math.max(0, Math.floor(finite(weeksLived)));
  if (w <= 0) return 1;
  return Math.floor((w - 1) / TAX_YEAR_WEEKS) + 1;
}

/**
 * Does this week open a new tax year?
 *
 * Deliberately week 53, not week 52. The crypto tick levies its yearly capital
 * gains ON the boundary week (`currentWeek % 52 === 0`, i.e. week 52), so
 * resetting at week 52 would push that bill into the following year's total and
 * leave year one permanently understating what was actually paid.
 */
export function startsNewTaxYear(weeksLived: number): boolean {
  const w = Math.max(0, Math.floor(finite(weeksLived)));
  return w > 0 && w % TAX_YEAR_WEEKS === 1;
}

/**
 * Fold this week's tax into the year-to-date total, resetting on the boundary.
 *
 * Negative inputs are floored at 0 rather than refunded: a loss does not
 * generate a rebate anywhere else in the tax code either.
 */
export function accrueYearlyTax(
  previousYearToDate: unknown,
  taxThisWeek: number,
  weeksLived: number
): number {
  const base = startsNewTaxYear(weeksLived) ? 0 : Math.max(0, finite(previousYearToDate));
  return Math.round(base + Math.max(0, finite(taxThisWeek)));
}
