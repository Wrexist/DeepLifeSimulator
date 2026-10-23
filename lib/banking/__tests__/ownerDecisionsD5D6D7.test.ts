/**
 * Owner decisions D5 / D6 / D7 (2026-10-23).
 *
 * D5: the legacy savings pool and the self-opened accounts share ONE $500k
 *     full-rate band.
 * D6: a CD re-prices to the savings rate when its term ends, and takes no
 *     deposits while locked.
 * D7: mortgage / auto rates are only sold with the asset they secure - the
 *     Bank app's free-standing loan refuses those types.
 */
import type React from 'react';
import { BankingState, GameState } from '@/contexts/game/types';
import {
  accrueAccountInterest,
  depositToAccount,
  matureCertificates,
  MATURED_CD_APR,
  remainingSavingsAllowance,
  transferBetweenAccounts,
} from '../operations';
import { runWeeklyBankingTick } from '../weeklyTick';
import { SAVINGS_BALANCE_SOFT_CAP, SAVINGS_CAP_EFFICIENCY } from '@/lib/economy/constants';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { acceptLoan, getLoanQuote, STANDALONE_LOAN_TYPES } from '@/contexts/game/actions/LoanActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function banking(accounts: BankingState['accounts']): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      { id: 'savings-default', type: 'savings', name: 'Savings', balance: 0, baseAPR: 0.02, openedWeek: 0 },
      ...accounts,
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 760,
      band: 'veryGood',
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

const hysa = (balance: number) => ({
  id: 'hy-1', type: 'highYieldSavings' as const, name: 'HY', balance, baseAPR: 0.045, openedWeek: 0,
});

describe('D5 - one full-rate savings band across both pools', () => {
  it('remainingSavingsAllowance is what the legacy pool leaves of the band', () => {
    expect(remainingSavingsAllowance(0)).toBe(SAVINGS_BALANCE_SOFT_CAP);
    expect(remainingSavingsAllowance(200_000)).toBe(SAVINGS_BALANCE_SOFT_CAP - 200_000);
    expect(remainingSavingsAllowance(2_000_000)).toBe(0);
    expect(remainingSavingsAllowance(-5)).toBe(SAVINGS_BALANCE_SOFT_CAP);
    expect(remainingSavingsAllowance(NaN)).toBe(SAVINGS_BALANCE_SOFT_CAP);
  });

  it('a $500k legacy pool leaves the accounts only the reduced rate', () => {
    const b = banking([hysa(500_000)]);
    const { totalInterest } = accrueAccountInterest(b, 1, 500_000);
    expect(totalInterest).toBeCloseTo((500_000 * 0.045 * SAVINGS_CAP_EFFICIENCY) / WEEKS_PER_YEAR, 6);
  });

  it('without a legacy balance the accounts keep the whole band (unchanged behaviour)', () => {
    const b = banking([hysa(500_000)]);
    expect(accrueAccountInterest(b, 1, 0).totalInterest).toBeCloseTo((500_000 * 0.045) / WEEKS_PER_YEAR, 6);
    expect(accrueAccountInterest(b).totalInterest).toBeCloseTo((500_000 * 0.045) / WEEKS_PER_YEAR, 6);
  });

  it('the banking tick charges the legacy pool\'s pre-interest balance against the band', () => {
    const legacyBefore = 300_000;
    const legacyInterest = (legacyBefore * 0.045) / WEEKS_PER_YEAR;
    const tick = runWeeklyBankingTick({
      banking: banking([hysa(400_000)]),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: legacyBefore + legacyInterest,
      savingsInterest: legacyInterest,
      newMoney: 0,
      currentWeek: 10,
    });
    const acct = tick.banking.accounts.find((a) => a.id === 'hy-1')!;
    // $200k of band left: full rate on $200k, reduced on the other $200k.
    const expected =
      (200_000 * 0.045) / WEEKS_PER_YEAR + (200_000 * 0.045 * SAVINGS_CAP_EFFICIENCY) / WEEKS_PER_YEAR;
    expect(acct.balance - 400_000).toBeCloseTo(expected, 6);
  });
});

describe('D6 - CDs mature to the savings rate and take no deposits while locked', () => {
  const cd = (lockUntilWeek: number | undefined, baseAPR = 0.055) => ({
    id: 'cd-1', type: 'cd' as const, name: '52-Week CD', balance: 10_000, baseAPR, openedWeek: 0, lockUntilWeek,
  });

  it('a locked CD keeps its rate; a matured one drops to MATURED_CD_APR and unlocks', () => {
    expect(matureCertificates(banking([cd(52)]), 51).accounts[2]).toMatchObject({ baseAPR: 0.055, lockUntilWeek: 52 });
    const matured = matureCertificates(banking([cd(52)]), 52).accounts[2];
    expect(matured.baseAPR).toBe(MATURED_CD_APR);
    expect(matured.lockUntilWeek).toBeUndefined();
    expect(matured.balance).toBe(10_000);
  });

  it('is idempotent and treats an unlocked legacy CD as matured', () => {
    const once = matureCertificates(banking([cd(undefined)]), 5);
    expect(once.accounts[2].baseAPR).toBe(MATURED_CD_APR);
    expect(matureCertificates(once, 6)).toBe(once);
  });

  it('a matured CD can never pay more than liquid high-yield savings', () => {
    expect(MATURED_CD_APR).toBeLessThanOrEqual(0.045);
  });

  it('the week that completes the term is paid at the CD rate, then the account re-prices', () => {
    const tick = runWeeklyBankingTick({
      banking: banking([cd(52)]),
      prevLoans: [],
      processedLoans: [],
      newBankSavings: 0,
      newMoney: 0,
      currentWeek: 52,
    });
    const acct = tick.banking.accounts.find((a) => a.id === 'cd-1')!;
    expect(acct.balance - 10_000).toBeCloseTo((10_000 * 0.055) / WEEKS_PER_YEAR, 6);
    expect(acct.baseAPR).toBe(MATURED_CD_APR);
  });

  it('refuses a deposit into a locked CD, and accepts one after maturity', () => {
    const b = banking([cd(52)]);
    const locked = depositToAccount(b, 'cd-1', 1_000, 20);
    expect(locked.ok).toBe(false);
    expect(locked.banking).toBe(b);
    expect(depositToAccount(b, 'cd-1', 1_000, 52).ok).toBe(true);
  });

  it('refuses a transfer into a locked CD without moving money out of the source', () => {
    const b = banking([cd(52), hysa(5_000)]);
    const r = transferBetweenAccounts(b, 'hy-1', 'cd-1', 1_000, 20);
    expect(r.ok).toBe(false);
    expect(r.banking).toBe(b);
  });
});

describe('D7 - secured rates only with the asset', () => {
  it('the Bank app offers only personal and business loans', () => {
    expect([...STANDALONE_LOAN_TYPES].sort()).toEqual(['business', 'personal']);
  });

  it('getLoanQuote refuses mortgage and auto', () => {
    const state = createTestGameState();
    for (const type of ['mortgage', 'auto'] as const) {
      const q = getLoanQuote(state, { principal: 10_000, termWeeks: 52, type, weeklyIncome: 5_000 });
      expect(q.rejected).toBe(true);
    }
  });

  it('acceptLoan originates no mortgage or auto loan and pays no principal', () => {
    let state: GameState = createTestGameState();
    const setGameState = (u: GameState | ((p: GameState) => GameState)) => {
      state = typeof u === 'function' ? u(state) : u;
    };
    const before = state;
    for (const type of ['mortgage', 'auto'] as const) {
      acceptLoan(setGameState as React.Dispatch<React.SetStateAction<GameState>>, {
        principal: 10_000, termWeeks: 52, type, name: 'cheap cash', weeklyIncome: 5_000,
        depositAccountId: 'checking-default',
      });
    }
    expect(state).toBe(before);
  });
});
