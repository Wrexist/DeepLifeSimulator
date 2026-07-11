/**
 * v22 Wave A — live rate environment WIRED into real APRs (not just the table).
 *
 * Covers:
 *   - accrueAccountInterest(depositMult): recession lowers, boom raises deposit
 *     yield, and the boost is clamped at SAVINGS_APR_HARD_CAP (no arbitrage).
 *   - quoteLoan(loanDelta): recession raises the offered loan APR, boom cheapens
 *     it, floored at the 0.025 quote floor.
 *   - runWeeklyBankingTick: derives the environment from economyState, persists
 *     banking.rateEnvironment, and applies depositMult to the weekly accrual.
 */
import { accrueAccountInterest, quoteLoan } from '../operations';
import { runWeeklyBankingTick } from '../weeklyTick';
import { RATE_ENVIRONMENT_TABLE } from '../rateEnvironment';
import { SAVINGS_APR_HARD_CAP } from '@/lib/economy/constants';
import type { BankingState } from '@/contexts/game/types';

function banking(over: Partial<BankingState> = {}): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      { id: 'savings-default', type: 'savings', name: 'Savings', balance: 0, baseAPR: 0.02, openedWeek: 0 },
      { id: 'hysa-1', type: 'highYieldSavings', name: 'High Yield', balance: 100000, baseAPR: 0.045, openedWeek: 0 },
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 720, band: 'good',
      componentBreakdown: { paymentHistory: 90, utilization: 80, accountAge: 40, creditMix: 50, inquiries: 100 },
      lastUpdatedWeek: 0, history: [], inquiries: [],
    },
    savingsGoals: [],
    totalLateFeesPaid: 0,
    totalInterestEarned: 0,
    totalInterestPaid: 0,
    taxDueThisYear: 0,
    ...over,
  };
}

describe('accrueAccountInterest — depositMult', () => {
  it('recession lowers and boom raises accrued interest vs neutral', () => {
    const neutral = accrueAccountInterest(banking(), 1).totalInterest;
    const recession = accrueAccountInterest(banking(), RATE_ENVIRONMENT_TABLE.recession.depositMult).totalInterest;
    const boom = accrueAccountInterest(banking(), RATE_ENVIRONMENT_TABLE.boom.depositMult).totalInterest;
    expect(recession).toBeLessThan(neutral);
    expect(boom).toBeGreaterThan(neutral);
  });

  it('boost is clamped so effective APY never exceeds the hard cap', () => {
    // A CD at the hard cap boosted in a boom must not accrue above the cap rate.
    const cd = banking({
      accounts: [{ id: 'cd-1', type: 'cd', name: 'CD', balance: 100000, baseAPR: SAVINGS_APR_HARD_CAP, openedWeek: 0 }],
    });
    const boomInterest = accrueAccountInterest(cd, RATE_ENVIRONMENT_TABLE.boom.depositMult).totalInterest;
    const capInterest = accrueAccountInterest(cd, 1).totalInterest; // already at cap
    expect(boomInterest).toBeCloseTo(capInterest, 6);
  });

  it('defaults to neutral (depositMult=1) when omitted', () => {
    const a = accrueAccountInterest(banking()).totalInterest;
    const b = accrueAccountInterest(banking(), 1).totalInterest;
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('quoteLoan — loanDelta', () => {
  const req = { principal: 10000, termWeeks: 104, type: 'personal' as const, weeklyIncome: 2000 };

  it('recession raises and boom cheapens the offered APR', () => {
    const neutral = quoteLoan(banking(), [], req);
    const recession = quoteLoan(banking(), [], { ...req, loanDelta: RATE_ENVIRONMENT_TABLE.recession.loanDelta });
    const boom = quoteLoan(banking(), [], { ...req, loanDelta: RATE_ENVIRONMENT_TABLE.boom.loanDelta });
    if (neutral.rejected || recession.rejected || boom.rejected) throw new Error('quote rejected');
    expect(recession.offeredAPR).toBeGreaterThan(neutral.offeredAPR);
    expect(boom.offeredAPR).toBeLessThan(neutral.offeredAPR);
  });

  it('never drops below the 0.025 floor even with a large negative delta', () => {
    const q = quoteLoan(banking(), [], { ...req, loanDelta: -10 });
    if (q.rejected) throw new Error('quote rejected');
    expect(q.offeredAPR).toBeGreaterThanOrEqual(0.025);
  });
});

describe('runWeeklyBankingTick — rate environment', () => {
  it('persists banking.rateEnvironment from economyState', () => {
    const res = runWeeklyBankingTick({
      banking: banking(), prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0, economyState: 'crash', currentWeek: 10,
    });
    expect(res.banking.rateEnvironment).toEqual(RATE_ENVIRONMENT_TABLE.crash);
  });

  it('applies the depositMult to the weekly accrual (recession earns less)', () => {
    const normal = runWeeklyBankingTick({
      banking: banking(), prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0, economyState: 'normal', currentWeek: 10,
    });
    const recession = runWeeklyBankingTick({
      banking: banking(), prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0, economyState: 'recession', currentWeek: 10,
    });
    expect(recession.banking.totalInterestEarned).toBeLessThan(normal.banking.totalInterestEarned);
    expect(recession.banking.totalInterestEarned).toBeGreaterThan(0);
  });
});
