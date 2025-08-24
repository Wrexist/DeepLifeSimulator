import { loanEligibility } from '../loan';

describe('loanEligibility', () => {
  it('returns zero when too many active loans', () => {
    const result = loanEligibility({
      netWorth: 100000,
      educationTiers: 1,
      credit: 0.8,
      weeklyIncome: 1000,
      existingLoans: [
        { weeklyPayment: 100 },
        { weeklyPayment: 150 },
      ],
    });

    expect(result.canOpenAnotherLoan).toBe(false);
    expect(result.maxNewLoanAmount).toBe(0);
    expect(result.weeklyPaymentAtMax).toBe(0);
    expect(result.reasons).toContain('Too many active loans');
  });
});
