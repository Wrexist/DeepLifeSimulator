import { BankAccount } from '@/contexts/game/types';
import { computeStatementNetWorth, nonMirrorDeposits } from '../operations';

function acct(id: string, balance: number): BankAccount {
  return { id, type: 'checking', name: id, balance, baseAPR: 0, openedWeek: 0 } as BankAccount;
}

describe('computeStatementNetWorth (mirror double-count regression)', () => {
  it('counts cash once — the checking mirror is not added on top of stats.money', () => {
    // checking-default mirrors cash (2000); savings-default mirrors bankSavings (500).
    const accounts = [
      acct('checking-default', 2000),
      acct('savings-default', 500),
    ];
    const nw = computeStatementNetWorth({
      cash: 2000,
      bankSavings: 500,
      accounts,
      stocks: 0,
      crypto: 0,
      realEstate: 0,
      cardDebt: 0,
      loanDebt: 0,
    });
    // Correct net worth = 2000 (cash) + 500 (savings) = 2500 — NOT 5000 (the
    // old cash + totalBank double-count).
    expect(nw.assets).toBe(2500);
    expect(nw.net).toBe(2500);
    expect(nw.bankDeposits).toBe(500);
  });

  it('includes self-opened (non-mirror) accounts exactly once', () => {
    const accounts = [
      acct('checking-default', 2000),
      acct('savings-default', 500),
      acct('hy-savings-1', 3000), // self-opened
    ];
    const nw = computeStatementNetWorth({
      cash: 2000,
      bankSavings: 500,
      accounts,
      stocks: 100,
      crypto: 50,
      realEstate: 400,
      cardDebt: 200,
      loanDebt: 300,
    });
    // assets = 2000 + (500 + 3000) + 100 + 50 + 400 = 6050
    expect(nw.bankDeposits).toBe(3500);
    expect(nw.assets).toBe(6050);
    expect(nw.liabilities).toBe(500);
    expect(nw.net).toBe(5550);
  });

  it('nonMirrorDeposits excludes both mirror accounts', () => {
    const accounts = [
      acct('checking-default', 2000),
      acct('savings-default', 500),
      acct('cd-1', 1000),
    ];
    expect(nonMirrorDeposits(accounts)).toBe(1000);
  });
});
