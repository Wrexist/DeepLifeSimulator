/**
 * Day-summary finance log builder — R7 Phase 2 step 2.4f.
 *
 * Scope: the income-breakdown log line previously inline in
 * `GameActionsContext.tsx:974-986`. Builds the human-readable summary
 * string when ANY of the contributing values is positive; returns null
 * when nothing notable happened (suppress the log entirely).
 *
 * The output format is preserved 1:1 from the legacy code:
 *   `[WEEK PROGRESSION] Weekly economy: <breakdown>. Money: $X -> $Y`
 *
 * Breakdown parts (each conditionally included):
 *   - `Career $N`          — always shown (even when 0; matches legacy)
 *   - `Partner $N`         — only when partnerIncome > 0
 *   - `Passive $N`         — always shown
 *   - `Tax -$N`            — only when incomeTax > 0
 *   - `Rent -$N`           — only when weeklyRent > 0
 *   - `Loans -$N`          — only when totalLoanAutoPaid > 0 (rounded)
 *   - `Loan penalty +$N`   — only when totalLoanPenalty > 0 (rounded)
 *   - `Savings interest +$N` — only when savingsInterest > 0 (rounded)
 *
 * Pure function. No `logger.info` call inside the helper — the caller
 * decides whether to log. This makes the helper trivially snapshot-testable
 * (the legacy code logged unconditionally inside the if-block).
 */

export interface WeeklyFinanceSummaryInput {
  careerSalary: number;
  partnerIncome: number;
  passiveIncome: number;
  totalIncome: number;
  incomeTax: number;
  weeklyRent: number;
  totalLoanAutoPaid: number;
  totalLoanPenalty: number;
  savingsInterest: number;
  /** Money BEFORE the writeback. */
  currentMoney: number;
  /** Money AFTER the writeback (post-clamp). */
  newMoney: number;
}

export interface WeeklyFinanceSummaryResult {
  /**
   * The fully-formatted log message, or `null` when nothing notable
   * happened this tick. Caller does `if (msg) logger.info(msg)`.
   */
  logMessage: string | null;
}

export function summarizeWeeklyFinance(input: WeeklyFinanceSummaryInput): WeeklyFinanceSummaryResult {
  // Same gating as the legacy inline `if (totalIncome > 0 || weeklyRent > 0 || ...)`.
  const anyNotable =
    input.totalIncome > 0
    || input.weeklyRent > 0
    || input.totalLoanAutoPaid > 0
    || input.totalLoanPenalty > 0
    || input.savingsInterest > 0;

  if (!anyNotable) {
    return { logMessage: null };
  }

  const incomeBreakdown = [
    `Career $${input.careerSalary}`,
    input.partnerIncome > 0 ? `Partner $${input.partnerIncome}` : null,
    `Passive $${input.passiveIncome}`,
    input.incomeTax > 0 ? `Tax -$${input.incomeTax}` : null,
    input.weeklyRent > 0 ? `Rent -$${input.weeklyRent}` : null,
    input.totalLoanAutoPaid > 0 ? `Loans -$${Math.round(input.totalLoanAutoPaid)}` : null,
    input.totalLoanPenalty > 0 ? `Loan penalty +$${Math.round(input.totalLoanPenalty)}` : null,
    input.savingsInterest > 0 ? `Savings interest +$${Math.round(input.savingsInterest)}` : null,
  ].filter(Boolean).join(' + ');

  return {
    logMessage: `[WEEK PROGRESSION] Weekly economy: ${incomeBreakdown}. Money: $${input.currentMoney} -> $${input.newMoney}`,
  };
}
