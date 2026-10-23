/**
 * APP2-2 (audit 2026-10-23): the loan sheet quotes the same cap the loan obeys.
 *
 * `acceptLoan` refuses a seventh open loan (M-3), but `getLoanQuote` never
 * checked the cap. The sheet showed an approved offer, Accept closed it, and
 * the refusal was a log line: no loan and no message.
 */
import type { GameState, Loan } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { applyWithSetState as apply } from '../helpers/setGameStateStub';
import { acceptLoan, getLoanQuote, MAX_ACTIVE_LOANS } from '@/contexts/game/actions/LoanActions';

const loan = (i: number, remaining = 1_000): Loan => ({
  id: `loan-${i}`,
  name: `Loan ${i}`,
  principal: 1_000,
  remaining,
  rateAPR: 0.14,
  termWeeks: 52,
  weeklyPayment: 1,
  startWeek: 0,
  autoPay: true,
  type: 'personal',
  weeksRemaining: 52,
  interestRate: 0.14,
});

function withLoans(loans: Loan[]): GameState {
  const base = createTestGameState();
  return createTestGameState({
    loans,
    banking: { ...base.banking!, creditScore: { ...base.banking!.creditScore, score: 720 } },
  });
}

const request = { principal: 5_000, termWeeks: 52, type: 'personal' as const, weeklyIncome: 100_000 };

describe('APP2-2 - the loan quote applies the active-loan cap', () => {
  it('quotes an offer below the cap', () => {
    const quote = getLoanQuote(withLoans([loan(1)]), request);
    expect(quote.rejected).toBe(false);
  });

  it('refuses at the cap, with a reason the sheet can show', () => {
    const state = withLoans(Array.from({ length: MAX_ACTIVE_LOANS }, (_, i) => loan(i)));
    const quote = getLoanQuote(state, request);
    expect(quote.rejected).toBe(true);
    expect(quote.reason).toMatch(String(MAX_ACTIVE_LOANS));
    // And the action agrees: nothing is borrowed.
    const after = apply(state, (set) => acceptLoan(set, { ...request, name: 'X', depositAccountId: 'checking-default' }));
    expect(after.loans).toHaveLength(MAX_ACTIVE_LOANS);
  });

  it('paid-off loans do not count toward the cap', () => {
    const state = withLoans(Array.from({ length: MAX_ACTIVE_LOANS }, (_, i) => loan(i, i === 0 ? 0 : 1_000)));
    expect(getLoanQuote(state, request).rejected).toBe(false);
  });
});
