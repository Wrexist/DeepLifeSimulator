import { BankingState, Loan } from '@/contexts/game/types';
import {
  addBillPayRule,
  addSavingsGoal,
  applyForCreditCard,
  applyLoanPayment,
  chargeCreditCard,
  contributeToGoal,
  depositToAccount,
  openAccount,
  payCreditCard,
  quoteLoan,
  recomputeCreditScore,
  removeBillPayRule,
  tickBillPay,
  totalBankBalance,
  totalCreditCardDebt,
  trackBudgetSpend,
  transferBetweenAccounts,
  withdrawFromAccount,
} from '../operations';

function emptyBanking(): BankingState {
  return {
    accounts: [
      { id: 'chk', type: 'checking', name: 'Checking', balance: 1000, baseAPR: 0, openedWeek: 0 },
      { id: 'sav', type: 'savings', name: 'Savings', balance: 500, baseAPR: 0.02, openedWeek: 0 },
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 720,
      band: 'good',
      componentBreakdown: { paymentHistory: 90, utilization: 80, accountAge: 40, creditMix: 50, inquiries: 100 },
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

describe('account operations', () => {
  it('deposits to an existing account', () => {
    const b = emptyBanking();
    const r = depositToAccount(b, 'chk', 200);
    expect(r.ok).toBe(true);
    expect(r.banking.accounts.find((a) => a.id === 'chk')!.balance).toBe(1200);
  });

  it('rejects deposit to unknown account', () => {
    const r = depositToAccount(emptyBanking(), 'nope', 100);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not found/);
  });

  it('does not mutate the input banking state', () => {
    const b = emptyBanking();
    depositToAccount(b, 'chk', 200);
    expect(b.accounts.find((a) => a.id === 'chk')!.balance).toBe(1000);
  });

  it('rejects withdrawal that exceeds balance', () => {
    const r = withdrawFromAccount(emptyBanking(), 'chk', 5000, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Insufficient/);
  });

  it('rejects withdrawal from a locked CD', () => {
    const b: BankingState = {
      ...emptyBanking(),
      accounts: [
        { id: 'cd', type: 'cd', name: 'CD', balance: 5000, baseAPR: 0.04, openedWeek: 0, lockUntilWeek: 52 },
      ],
    };
    const r = withdrawFromAccount(b, 'cd', 100, 4);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Locked/);
  });

  it('respects minimum balance', () => {
    const b: BankingState = {
      ...emptyBanking(),
      accounts: [{ id: 'mm', type: 'moneyMarket', name: 'MM', balance: 1500, baseAPR: 0.03, openedWeek: 0, minBalance: 1000 }],
    };
    const r = withdrawFromAccount(b, 'mm', 600, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/minimum balance/);
  });

  it('transfers between accounts atomically', () => {
    const r = transferBetweenAccounts(emptyBanking(), 'chk', 'sav', 300, 0);
    expect(r.ok).toBe(true);
    expect(r.banking.accounts.find((a) => a.id === 'chk')!.balance).toBe(700);
    expect(r.banking.accounts.find((a) => a.id === 'sav')!.balance).toBe(800);
  });

  it('refuses self-transfer', () => {
    const r = transferBetweenAccounts(emptyBanking(), 'chk', 'chk', 50, 0);
    expect(r.ok).toBe(false);
  });

  it('opens a new account with a unique id', () => {
    const b = emptyBanking();
    const { banking, account } = openAccount(b, {
      type: 'highYieldSavings',
      name: 'High Yield',
      initialDeposit: 2000,
      baseAPR: 0.045,
      openedWeek: 10,
    });
    expect(banking.accounts).toHaveLength(3);
    expect(account.balance).toBe(2000);
    expect(account.type).toBe('highYieldSavings');
    expect(account.openedWeek).toBe(10);
  });

  it('aggregates total bank balance', () => {
    expect(totalBankBalance(emptyBanking())).toBe(1500);
  });
});

describe('credit cards', () => {
  it('rejects card applications below the tier minimum', () => {
    const b: BankingState = { ...emptyBanking(), creditScore: { ...emptyBanking().creditScore, score: 600 } };
    const r = applyForCreditCard(b, 'gold', 0.20, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Need credit score/);
  });

  it('approves a card and logs an inquiry', () => {
    const r = applyForCreditCard(emptyBanking(), 'standard', 0.20, 5);
    expect(r.ok).toBe(true);
    expect(r.banking.creditCards).toHaveLength(1);
    expect(r.banking.creditScore.inquiries).toHaveLength(1);
    expect(r.banking.creditScore.inquiries[0].type).toBe('card');
  });

  it('accrues rewards on spend', () => {
    const issued = applyForCreditCard(emptyBanking(), 'standard', 0.20, 0).banking;
    const card = issued.creditCards[0];
    const r = chargeCreditCard(issued, card.id, 500);
    expect(r.ok).toBe(true);
    expect(r.banking.creditCards[0].balance).toBe(500);
    expect(r.banking.creditCards[0].pendingRewards).toBeCloseTo(5, 2); // 1%
  });

  it('rejects charges over the credit limit', () => {
    const issued = applyForCreditCard(emptyBanking(), 'starter', 0.25, 0).banking;
    const card = issued.creditCards[0];
    const r = chargeCreditCard(issued, card.id, 10_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Over credit limit/);
  });

  it('pays down a card from an account', () => {
    let b = applyForCreditCard(emptyBanking(), 'standard', 0.20, 0).banking;
    b = chargeCreditCard(b, b.creditCards[0].id, 400).banking;
    const r = payCreditCard(b, b.creditCards[0].id, 'chk', 400, 0);
    expect(r.ok).toBe(true);
    expect(r.banking.creditCards[0].balance).toBe(0);
    expect(r.banking.accounts.find((a) => a.id === 'chk')!.balance).toBe(600);
  });

  it('aggregates total credit-card debt', () => {
    let b = applyForCreditCard(emptyBanking(), 'standard', 0.20, 0).banking;
    b = chargeCreditCard(b, b.creditCards[0].id, 250).banking;
    expect(totalCreditCardDebt(b)).toBe(250);
  });
});

describe('bill pay', () => {
  it('debits a due rule and advances nextDueWeek', () => {
    let b = addBillPayRule(emptyBanking(), {
      label: 'Rent',
      category: 'housing',
      amount: 400,
      fromAccountId: 'chk',
      cadence: 'weekly',
      nextDueWeek: 5,
      source: 'rent',
      enabled: true,
    }).banking;

    const r = tickBillPay(b, 5);
    expect(r.paid).toHaveLength(1);
    expect(r.missed).toHaveLength(0);
    expect(r.banking.accounts.find((a) => a.id === 'chk')!.balance).toBe(600);
    expect(r.banking.billPayRules[0].nextDueWeek).toBe(6);
    expect(r.banking.billPayRules[0].lastPaidWeek).toBe(5);
  });

  it('records a missed payment when funds are short', () => {
    let b = emptyBanking();
    b = withdrawFromAccount(b, 'chk', 950, 0).banking; // leave $50
    b = addBillPayRule(b, {
      label: 'Rent',
      category: 'housing',
      amount: 400,
      fromAccountId: 'chk',
      cadence: 'weekly',
      nextDueWeek: 5,
      source: 'rent',
      enabled: true,
    }).banking;

    const r = tickBillPay(b, 5, 25);
    expect(r.paid).toHaveLength(0);
    expect(r.missed).toHaveLength(1);
    expect(r.banking.billPayRules[0].missedCount).toBe(1);
    expect(r.banking.totalLateFeesPaid).toBe(25);
  });

  it('skips rules that are not yet due', () => {
    const b = addBillPayRule(emptyBanking(), {
      label: 'Future',
      category: 'lifestyle',
      amount: 100,
      fromAccountId: 'chk',
      cadence: 'weekly',
      nextDueWeek: 10,
      source: 'manual',
      enabled: true,
    }).banking;
    const r = tickBillPay(b, 5);
    expect(r.paid).toHaveLength(0);
    expect(r.banking.accounts.find((a) => a.id === 'chk')!.balance).toBe(1000);
  });

  it('removes a bill rule', () => {
    const { banking, rule } = addBillPayRule(emptyBanking(), {
      label: 'Drop me',
      category: 'lifestyle',
      amount: 10,
      fromAccountId: 'chk',
      cadence: 'weekly',
      nextDueWeek: 1,
      source: 'manual',
      enabled: true,
    });
    expect(removeBillPayRule(banking, rule.id).billPayRules).toHaveLength(0);
  });
});

describe('budget tracking', () => {
  it('accumulates by category within the same week', () => {
    let b = trackBudgetSpend(emptyBanking(), 5, 'food', 30);
    b = trackBudgetSpend(b, 5, 'food', 20);
    b = trackBudgetSpend(b, 5, 'housing', 400);
    const week = b.budgetSpend.find((x) => x.weeksLived === 5)!;
    expect(week.byCategory.food).toBe(50);
    expect(week.byCategory.housing).toBe(400);
  });

  it('caps the buffer to the last 12 weeks', () => {
    let b = emptyBanking();
    for (let w = 0; w < 20; w++) {
      b = trackBudgetSpend(b, w, 'lifestyle', 1);
    }
    expect(b.budgetSpend).toHaveLength(12);
    expect(b.budgetSpend[0].weeksLived).toBe(8);
    expect(b.budgetSpend[11].weeksLived).toBe(19);
  });
});

describe('savings goals', () => {
  it('creates and contributes to a goal', () => {
    const { banking, goal } = addSavingsGoal(emptyBanking(), {
      name: 'Vacation',
      targetAmount: 5000,
      category: 'vacation',
      createdWeek: 0,
    });
    const r = contributeToGoal(banking, goal.id, 250);
    expect(r.ok).toBe(true);
    expect(r.banking.savingsGoals[0].currentAmount).toBe(250);
  });
});

describe('loans', () => {
  function aLoan(): Loan {
    return {
      id: 'l1',
      name: 'Personal',
      principal: 5000,
      remaining: 5000,
      rateAPR: 0.10,
      termWeeks: 52,
      weeklyPayment: 102,
      startWeek: 0,
      autoPay: true,
      type: 'personal',
      weeksRemaining: 52,
      interestRate: 0.10,
      onTimePayments: 0,
      latePayments: 0,
    };
  }

  it('quotes a loan a borrower can afford', () => {
    const q = quoteLoan(emptyBanking(), [], {
      principal: 5000,
      termWeeks: 52,
      type: 'personal',
      weeklyIncome: 1000,
    });
    expect(q.rejected).toBe(false);
    if (!q.rejected) {
      expect(q.weeklyPayment).toBeGreaterThan(0);
      expect(q.offeredAPR).toBeGreaterThan(0);
    }
  });

  it('Private Banking aprCap caps the offered APR at the VIP 3% rate (never below the 2.5% floor)', () => {
    const req = { principal: 5000, termWeeks: 52, type: 'personal' as const, weeklyIncome: 2000 };
    const base = quoteLoan(emptyBanking(), [], req);
    const capped = quoteLoan(emptyBanking(), [], { ...req, aprCap: 0.03 });
    expect(base.rejected).toBe(false);
    expect(capped.rejected).toBe(false);
    if (!base.rejected && !capped.rejected) {
      // A normal personal loan prices well above 3%; the cap brings it down.
      expect(base.offeredAPR).toBeGreaterThan(0.03);
      expect(capped.offeredAPR).toBeLessThanOrEqual(0.03);
      expect(capped.offeredAPR).toBeGreaterThanOrEqual(0.025);
      expect(capped.weeklyPayment).toBeLessThan(base.weeklyPayment);
    }
  });

  it('rejects a loan when DTI is breached', () => {
    const q = quoteLoan(emptyBanking(), [], {
      principal: 100_000,
      termWeeks: 52,
      type: 'personal',
      weeklyIncome: 100,
    });
    expect(q.rejected).toBe(true);
    if (q.rejected) expect(q.reason).toMatch(/Debt-to-income/);
  });

  it('rejects a loan when credit score is below minimum', () => {
    const b: BankingState = { ...emptyBanking(), creditScore: { ...emptyBanking().creditScore, score: 540 } };
    const q = quoteLoan(b, [], {
      principal: 5000,
      termWeeks: 52,
      type: 'personal',
      weeklyIncome: 1000,
    });
    expect(q.rejected).toBe(true);
  });

  it('applies a weekly payment that splits into interest + principal', () => {
    const loan = aLoan();
    const r = applyLoanPayment(emptyBanking(), loan, 'chk', 5);
    expect(r.paid).toBe(true);
    expect(r.interest).toBeGreaterThan(0);
    expect(r.principal).toBeGreaterThan(0);
    expect(r.loan.remaining).toBeLessThan(loan.remaining);
    expect(r.loan.onTimePayments).toBe(1);
  });

  it('records a late payment when funds are insufficient', () => {
    let b = emptyBanking();
    b = withdrawFromAccount(b, 'chk', 1000, 0).banking; // empty checking
    const r = applyLoanPayment(b, aLoan(), 'chk', 5);
    expect(r.paid).toBe(false);
    expect(r.loan.latePayments).toBe(1);
  });
});

describe('recomputeCreditScore', () => {
  it('reflects payment history into the score', () => {
    const b = emptyBanking();
    const cleanLoan: Loan = {
      id: 'l1',
      name: 'L',
      principal: 1000,
      remaining: 500,
      rateAPR: 0.08,
      termWeeks: 52,
      weeklyPayment: 25,
      startWeek: 0,
      autoPay: true,
      type: 'personal',
      weeksRemaining: 26,
      interestRate: 0.08,
      onTimePayments: 26,
      latePayments: 0,
    };
    const lateLoan: Loan = { ...cleanLoan, onTimePayments: 10, latePayments: 16 };

    const clean = recomputeCreditScore(b, [cleanLoan], 52);
    const late = recomputeCreditScore(b, [lateLoan], 52);
    expect(clean.creditScore.score).toBeGreaterThan(late.creditScore.score);
  });

  it('appends to score history (capped)', () => {
    let b = emptyBanking();
    for (let w = 0; w < 110; w++) {
      b = recomputeCreditScore(b, [], w);
    }
    expect(b.creditScore.history.length).toBeLessThanOrEqual(100);
  });

  it('expires inquiries older than 2 years', () => {
    const b: BankingState = {
      ...emptyBanking(),
      creditScore: {
        ...emptyBanking().creditScore,
        inquiries: [
          { weeksLived: 0, type: 'card' },
          { weeksLived: 100, type: 'loan' },
        ],
      },
    };
    // current week 200, 2-year lookback is 104 weeks → only "100" survives.
    const r = recomputeCreditScore(b, [], 200);
    expect(r.creditScore.inquiries).toHaveLength(1);
    expect(r.creditScore.inquiries[0].weeksLived).toBe(100);
  });
});
