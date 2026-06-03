import { BankingState, Loan } from '@/contexts/game/types';
import { runWeeklyBankingTick } from '../weeklyTick';

function blankBanking(): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Everyday Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      { id: 'savings-default', type: 'savings', name: 'Savings', balance: 0, baseAPR: 0.02, openedWeek: 0 },
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 650,
      band: 'fair',
      componentBreakdown: { paymentHistory: 70, utilization: 60, accountAge: 0, creditMix: 30, inquiries: 100 },
      lastUpdatedWeek: 0,
      history: [],
      inquiries: [],
    },
    savingsGoals: [],
    totalLateFeesPaid: 0,
    totalInterestEarned: 0,
    totalInterestPaid: 0,
    taxDueThisYear: 0,
  };
}

function aLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    name: 'Personal',
    principal: 5000,
    remaining: 5000,
    rateAPR: 0.10,
    termWeeks: 52,
    weeklyPayment: 100,
    startWeek: 0,
    autoPay: true,
    type: 'personal',
    weeksRemaining: 52,
    interestRate: 0.10,
    onTimePayments: 0,
    latePayments: 0,
    ...overrides,
  };
}

describe('runWeeklyBankingTick', () => {
  it('mirrors stats.money into the checking account', () => {
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 1234,
      currentWeek: 5,
    });
    const checking = r.banking.accounts.find((a) => a.id === 'checking-default')!;
    expect(checking.balance).toBe(1234);
  });

  it('mirrors legacy bankSavings into the savings account', () => {
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 7500,
      newMoney: 0,
      currentWeek: 5,
    });
    const savings = r.banking.accounts.find((a) => a.id === 'savings-default')!;
    expect(savings.balance).toBe(7500);
  });

  it('marks loans on-time when their remaining went down', () => {
    const prev = aLoan({ remaining: 5000 });
    const after = aLoan({ remaining: 4900 }); // paid this week
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [prev],
      processedLoans: [after],
      newBankSavings: 0,
      newMoney: 0,
      currentWeek: 10,
    });
    expect(r.loansWithTrackers).toHaveLength(1);
    expect(r.loansWithTrackers[0].onTimePayments).toBe(1);
    expect(r.loansWithTrackers[0].latePayments).toBe(0);
    expect(r.loansWithTrackers[0].lastPaidWeek).toBe(10);
  });

  it('marks loans late when their remaining went up (penalty applied)', () => {
    const prev = aLoan({ remaining: 5000 });
    const after = aLoan({ remaining: 5250 }); // missed → penalty
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [prev],
      processedLoans: [after],
      newBankSavings: 0,
      newMoney: 0,
      currentWeek: 10,
    });
    expect(r.loansWithTrackers[0].onTimePayments).toBe(0);
    expect(r.loansWithTrackers[0].latePayments).toBe(1);
  });

  it('preserves originalAPR on existing loans', () => {
    const prev = aLoan({ remaining: 5000, rateAPR: 0.10 });
    const after = aLoan({ remaining: 4900, rateAPR: 0.10, originalAPR: undefined });
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [prev],
      processedLoans: [after],
      newBankSavings: 0,
      newMoney: 0,
      currentWeek: 1,
    });
    expect(r.loansWithTrackers[0].originalAPR).toBe(0.10);
  });

  it('drops paid-off loans (not present in processedLoans)', () => {
    const prev = aLoan({ remaining: 100 });
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [prev],
      processedLoans: [], // paid off
      newBankSavings: 0,
      newMoney: 0,
      currentWeek: 1,
    });
    expect(r.loansWithTrackers).toHaveLength(0);
  });

  it('recomputes credit score and appends to history', () => {
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 0,
      currentWeek: 5,
    });
    expect(r.banking.creditScore.history).toHaveLength(1);
    expect(r.banking.creditScore.history[0].weeksLived).toBe(5);
    expect(r.banking.creditScore.lastUpdatedWeek).toBe(5);
  });

  it('emits an economy notification when the state changes', () => {
    const r = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 0,
      economyState: 'recession',
      currentWeek: 1,
    });
    expect(r.notifications.find((n) => n.id === 'economy-recession')).toBeDefined();
    expect(r.banking.lastEconomyState).toBe('recession');
  });

  it('does not re-emit the economy notification on a subsequent tick of the same state', () => {
    const first = runWeeklyBankingTick({
      banking: blankBanking(),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 0,
      economyState: 'boom',
      currentWeek: 1,
    });
    const second = runWeeklyBankingTick({
      banking: first.banking,
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 0,
      economyState: 'boom',
      currentWeek: 2,
    });
    expect(second.notifications.find((n) => n.id === 'economy-boom')).toBeUndefined();
  });

  it('processes a due bill-pay rule and deducts late fees on miss', () => {
    const banking: BankingState = {
      ...blankBanking(),
      accounts: [
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: 50, baseAPR: 0, openedWeek: 0 },
        { id: 'savings-default', type: 'savings', name: 'Savings', balance: 0, baseAPR: 0.02, openedWeek: 0 },
      ],
      billPayRules: [
        {
          id: 'bill-rent-x',
          label: 'Rent',
          category: 'housing',
          amount: 200,
          fromAccountId: 'checking-default',
          cadence: 'weekly',
          nextDueWeek: 5,
          source: 'rent',
          enabled: true,
          missedCount: 0,
        },
      ],
    };
    const r = runWeeklyBankingTick({
      banking,
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 50,
      currentWeek: 5,
    });
    expect(r.lateFeesDeducted).toBeGreaterThan(0);
    expect(r.notifications.find((n) => n.id === 'billpay-missed')).toBeDefined();
  });
});
