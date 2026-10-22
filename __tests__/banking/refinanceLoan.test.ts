/**
 * ACT-1 (audit 2026-10-21): a refinance is priced like a new loan.
 *
 * It used to skip the live rate environment (a recession loan refinanced
 * straight back to the base rate) and the DTI gate (a shorter term could push
 * the payment past what any new loan would be allowed), and it re-amortized a
 * loan with nothing left on it.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Loan } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { resolveRefinanceLoan, refinanceLoan } from '@/contexts/game/actions/LoanActions';

function withLoan(overrides: Partial<Loan> = {}, loanDelta = 0): GameState {
  const base = createTestGameState();
  const loan: Loan = {
    id: 'loan-1',
    name: 'Personal loan',
    principal: 10_000,
    remaining: 10_000,
    rateAPR: 0.14,
    termWeeks: 104,
    weeklyPayment: 110,
    startWeek: 0,
    autoPay: true,
    type: 'personal',
    weeksRemaining: 104,
    interestRate: 0.14,
    ...overrides,
  };
  return createTestGameState({
    loans: [loan],
    banking: {
      ...base.banking!,
      creditScore: { ...base.banking!.creditScore, score: 720 },
      rateEnvironment: { depositMult: 1, loanDelta },
    },
  });
}

describe('refinanceLoan (ACT-1)', () => {
  it('applies the live rate environment, like a new quote', () => {
    const normal = resolveRefinanceLoan(withLoan({}, 0), 'loan-1', 104, 5_000);
    const recession = resolveRefinanceLoan(withLoan({}, 0.02), 'loan-1', 104, 5_000);
    expect(normal.ok && recession.ok).toBe(true);
    const aprNormal = normal.next.loans![0].rateAPR;
    const aprRecession = recession.next.loans![0].rateAPR;
    expect(aprRecession).toBeCloseTo(aprNormal + 0.02, 6);
  });

  it('refuses a shorter term that would break the DTI cap, but allows one that lowers the payment', () => {
    // $300/wk income: 0.43 x 300 = $129/wk of total debt service allowed.
    const state = withLoan({ remaining: 10_000, weeklyPayment: 110 });
    const shorter = resolveRefinanceLoan(state, 'loan-1', 52, 300);
    expect(shorter.ok).toBe(false);
    expect(shorter.next).toBe(state);
    expect(shorter.message).toMatch(/Debt-to-income/);

    // A borrower already over the line may still stretch the loan out.
    const strained = withLoan({ remaining: 10_000, weeklyPayment: 400, termWeeks: 26, weeksRemaining: 26 });
    const longer = resolveRefinanceLoan(strained, 'loan-1', 104, 300);
    expect(longer.ok).toBe(true);
    expect(longer.next.loans![0].weeklyPayment).toBeLessThan(400);
  });

  it('refuses a loan with nothing left to re-amortize', () => {
    const state = withLoan({ remaining: 0 });
    const r = resolveRefinanceLoan(state, 'loan-1', 104, 5_000);
    expect(r.ok).toBe(false);
    expect(r.next).toBe(state);
  });

  it('the action reports the outcome and commits through the updater', () => {
    let state = withLoan({}, 0);
    const set = (u: GameState | ((s: GameState) => GameState)) => { state = typeof u === 'function' ? u(state) : u; };
    const r = refinanceLoan(set as Dispatch<SetStateAction<GameState>>, state, 'loan-1', 104, 5_000);
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/Refinanced at/);
    expect(state.loans![0].weeksRemaining).toBe(104);
    expect(state.banking!.creditScore.inquiries.length).toBeGreaterThan(0);
  });
});
