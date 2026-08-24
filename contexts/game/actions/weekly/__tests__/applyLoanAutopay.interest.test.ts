/**
 * applyLoanAutopay now surfaces the weekly interest actually serviced
 * (totalLoanInterest) so banking.totalInterestPaid can stop reading $0. These
 * tests pin that the serviced interest equals the APR compounding on paid loans
 * and is zero on missed-payment weeks.
 */
import { applyLoanAutopay } from '../applyLoanAutopay';
import type { Loan } from '@/contexts/game/types';

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'l1', name: 'Personal', principal: 5000, remaining: 5000,
    rateAPR: 0.52, interestRate: 0.52, termWeeks: 52, weeklyPayment: 100,
    startWeek: 0, autoPay: true, type: 'personal',
    ...over,
  } as Loan;
}

describe('applyLoanAutopay - serviced interest', () => {
  it('reports the interest that compounded on a paid loan this week', () => {
    // 52% APR / 52 weeks = 1% weekly on $5000 = $50 interest serviced.
    const res = applyLoanAutopay({ prevLoans: [loan()], cashAvailable: 100000 });
    expect(res.totalLoanInterest).toBeCloseTo(50, 6);
    expect(res.totalLoanAutoPaid).toBeGreaterThan(0);
  });

  it('records no serviced interest on a missed-payment week', () => {
    // Cash below the bankruptcy floor and under 2x the payment → payment skipped.
    const res = applyLoanAutopay({ prevLoans: [loan({ weeklyPayment: 5000 })], cashAvailable: 10 });
    expect(res.totalLoanAutoPaid).toBe(0);
    expect(res.totalLoanInterest).toBe(0);
    expect(res.totalLoanPenalty).toBeGreaterThan(0);
  });

  it('sums serviced interest across multiple paid loans', () => {
    const res = applyLoanAutopay({
      prevLoans: [loan({ id: 'a' }), loan({ id: 'b', principal: 1000, remaining: 1000 })],
      cashAvailable: 100000,
    });
    // $50 (on 5000) + $10 (on 1000) at 1% weekly.
    expect(res.totalLoanInterest).toBeCloseTo(60, 6);
  });
});
