/**
 * Live rate environment (STATE_VERSION 22, shared banking core).
 *
 * Maps the current macro `economyState` onto a pair of bounded modifiers:
 *   - `depositMult`: multiplier applied to a deposit account's base APY.
 *   - `loanDelta`:   additive delta (decimal APR) applied to a new-loan quote.
 *
 * This finally gives the long-standing "Loan rates rising; savings yields
 * falling" / "Cheaper borrowing; better deposit yields" notifications real
 * teeth, on BOTH the phone (BankApp) and computer (AdvancedBankApp) apps.
 *
 * ── Anti-arbitrage contract (enforced by the invariant test) ──────────────
 * A live rate environment can create a borrow-low / save-high money printer if
 * a boosted deposit APY ever meets or exceeds the cheapest available loan APR.
 * Two guardrails prevent that, by construction:
 *   1. `effectiveDepositAPR` clamps the boosted rate to `SAVINGS_APR_HARD_CAP`
 *      (the regulatory ceiling), so no economy boost can push a deposit above it.
 *   2. The table's most-favorable `loanDelta` (boom) keeps the cheapest loan
 *      (mortgage base 6.5%) strictly above that hard cap.
 * The unit test asserts `max effective deposit APY < min effective loan APR`
 * across every economy state and every standard product.
 *
 * Pure data + pure functions. No React, no state, no wall-clock.
 */
import { SAVINGS_APR_HARD_CAP } from '@/lib/economy/constants';

export type EconomyStateName = 'normal' | 'recession' | 'boom' | 'crash';

export interface RateEnvironment {
  /** Multiplier on deposit APY (1 = neutral). */
  depositMult: number;
  /** Additive delta on new-loan APR, decimal (0 = neutral; negative = cheaper). */
  loanDelta: number;
}

/** Loan APR floor — mirrors the 0.025 floor in operations.ts quoteLoan. */
export const LOAN_APR_FLOOR = 0.025;

/**
 * economyState → { depositMult, loanDelta } table.
 *
 * Direction matches the existing weekly-tick notifications:
 *   - recession/crash: deposit yields FALL (mult < 1), loan rates RISE (delta > 0).
 *   - boom:            deposit yields RISE (mult > 1), loan rates FALL (delta < 0).
 *
 * Magnitudes are deliberately small and bounded. The boom `loanDelta` (-0.005)
 * is capped so the cheapest loan (mortgage 6.5% → 6.0%) stays above the deposit
 * hard cap (5.5%), preserving the anti-arbitrage invariant.
 */
export const RATE_ENVIRONMENT_TABLE: Record<EconomyStateName, RateEnvironment> = {
  normal:    { depositMult: 1.00, loanDelta:  0.000 },
  boom:      { depositMult: 1.15, loanDelta: -0.005 },
  recession: { depositMult: 0.80, loanDelta:  0.020 },
  crash:     { depositMult: 0.65, loanDelta:  0.035 },
};

/**
 * Resolve the rate environment for a given economy state. Unknown / undefined
 * states fall back to the neutral `normal` environment.
 */
export function getRateEnvironment(economyState?: string | null): RateEnvironment {
  if (economyState && economyState in RATE_ENVIRONMENT_TABLE) {
    return RATE_ENVIRONMENT_TABLE[economyState as EconomyStateName];
  }
  return RATE_ENVIRONMENT_TABLE.normal;
}

const safe = (n: number | undefined, fb: number): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * Apply the deposit multiplier to a base APY, then clamp to the regulatory hard
 * cap so no boost can exceed `SAVINGS_APR_HARD_CAP`. Result is always ≥ 0.
 */
export function effectiveDepositAPR(baseAPR: number, env: RateEnvironment): number {
  const base = Math.max(0, safe(baseAPR, 0));
  const mult = Math.max(0, safe(env?.depositMult, 1));
  return Math.min(base * mult, SAVINGS_APR_HARD_CAP);
}

/**
 * Apply the loan delta to a base APR, floored at `LOAN_APR_FLOOR` (matching the
 * operations.ts quote floor).
 */
export function effectiveLoanAPR(baseAPR: number, env: RateEnvironment): number {
  const base = safe(baseAPR, 0);
  const delta = safe(env?.loanDelta, 0);
  return Math.max(LOAN_APR_FLOOR, base + delta);
}
