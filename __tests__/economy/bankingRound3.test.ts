/**
 * Three money leaks in the banking and trading layers.
 *
 * R3-M6 the $500k savings soft cap was applied PER ACCOUNT inside
 * `accrueAccountInterest`'s map, while `openNewAccount` deliberately exempts
 * CDs from the one-per-type rule (laddering CDs is a real strategy). So the
 * anti-exploit diminishing-returns curve was bypassed by clicking "open
 * account" more times: $10M across 20 x $500k CDs earned full 5.5% on every
 * dollar (~$550k/yr) instead of the intended ~$194k.
 *
 * R3-M7 capital-gains tax was withheld only on fills produced by
 * `processOpenOrders`. The default market-sell path credited full proceeds and
 * merely accumulated `stocks.realizedGains`, which nothing taxed — so a $1M
 * gain kept or lost $250k purely by which button the player used, and the tax
 * was avoidable in full.
 *
 * R3-M8 `CreditCard.baseAPR` was inert. A maxed $25,000 card at a stated 17%
 * cost exactly $0 forever, while the UI told the player a charge "grows the
 * (interest-bearing) balance now". 2026-07-31 audit round 3.
 */
import {
  accrueAccountInterest,
  accrueCreditCardInterest,
} from '@/lib/banking/operations';
import { SAVINGS_BALANCE_SOFT_CAP } from '@/lib/economy/constants';
import { STOCK_CAPITAL_GAINS_TAX_RATE } from '@/lib/stocks/weeklyTick';
import { initialGameState } from '@/contexts/game/initialState';
import type { BankingState } from '@/contexts/game/types';
import fs from 'fs';
import path from 'path';

const CD_APR = 0.055;

function withAccounts(balances: number[]): BankingState {
  return {
    ...initialGameState.banking!,
    accounts: balances.map((balance, i) => ({
      id: `cd-${i}`,
      type: 'cd',
      name: `CD ${i}`,
      balance,
      baseAPR: CD_APR,
    })) as never,
  };
}

describe('R3-M6 — the savings soft cap is a portfolio allowance', () => {
  it('pays the same on one big account as on many small ones', () => {
    // The exploit in one assertion: splitting must not increase yield.
    const total = SAVINGS_BALANCE_SOFT_CAP * 20;
    const single = accrueAccountInterest(withAccounts([total])).totalInterest;
    const split = accrueAccountInterest(
      withAccounts(Array.from({ length: 20 }, () => SAVINGS_BALANCE_SOFT_CAP)),
    ).totalInterest;

    expect(split).toBeCloseTo(single, 6);
  });

  it('still pays the full rate on a portfolio under the cap', () => {
    // The control: capping everything would satisfy the case above while
    // quietly deleting the yield an ordinary saver is meant to get.
    const under = SAVINGS_BALANCE_SOFT_CAP / 2;
    const { totalInterest } = accrueAccountInterest(withAccounts([under]));

    expect(totalInterest).toBeCloseTo((under * CD_APR) / 52, 4);
  });

  it('is order-independent — allocation is proportional, not first-come', () => {
    const a = accrueAccountInterest(withAccounts([900_000, 100_000])).totalInterest;
    const b = accrueAccountInterest(withAccounts([100_000, 900_000])).totalInterest;

    expect(a).toBeCloseTo(b, 6);
  });

  it('pays something for a large portfolio rather than zero', () => {
    const { totalInterest } = accrueAccountInterest(withAccounts([10_000_000]));

    expect(totalInterest).toBeGreaterThan(0);
    expect(Number.isFinite(totalInterest)).toBe(true);
  });
});

describe('R3-M7 — the market-sell path is taxed like every other', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'contexts/game/actions/StockActions.ts'),
    'utf8',
  );

  it('shares the tickrate rather than redefining it', () => {
    expect(STOCK_CAPITAL_GAINS_TAX_RATE).toBe(0.25);
    expect(source).toMatch(/import \{ STOCK_CAPITAL_GAINS_TAX_RATE \} from '@\/lib\/stocks\/weeklyTick'/);
  });

  it('withholds on the realized gain', () => {
    expect(source).toMatch(/const taxableGain = Math\.max\(0, realizedGain\)/);
    expect(source).toMatch(/taxableGain \* STOCK_CAPITAL_GAINS_TAX_RATE/);
  });

  it('never refunds on a loss', () => {
    // `Math.max(0, …)` is what makes a losing sale untaxed rather than
    // credited — the same rule the tick uses.
    expect(source).toMatch(/Math\.max\(0, realizedGain\)/);
  });

  it('nets the tax out of proceeds so a sale cannot leave the player poorer', () => {
    expect(source).toMatch(/const proceeds = grossProceeds - capitalGainsTax/);
    expect(source).toMatch(/Math\.min\(\s*grossProceeds,/);
  });
});

describe('R3-M8 — credit-card balances accrue their advertised APR', () => {
  function withCard(balance: number, baseAPR: number): BankingState {
    return {
      ...initialGameState.banking!,
      creditCards: [
        { id: 'c1', name: 'Platinum', tier: 'platinum', creditLimit: 25_000, balance, baseAPR,
          rewardsRate: 0.01, rewardsType: 'cashback', pendingRewards: 0, openedWeek: 1 },
      ] as never,
    };
  }

  it('grows a carried balance', () => {
    const { banking, totalInterest } = accrueCreditCardInterest(withCard(25_000, 0.17));

    expect(totalInterest).toBeCloseTo((25_000 * 0.17) / 52, 6);
    expect(banking.creditCards[0].balance).toBeGreaterThan(25_000);
  });

  it('leaves a paid-off card alone', () => {
    // The control: charging interest on a zero balance would be a pure penalty.
    const { banking, totalInterest } = accrueCreditCardInterest(withCard(0, 0.17));

    expect(totalInterest).toBe(0);
    expect(banking.creditCards[0].balance).toBe(0);
  });

  it('survives a corrupt balance or APR without producing NaN', () => {
    // The credit score's utilization ratio divides by this.
    for (const bad of [NaN, Infinity, -100]) {
      const byBalance = accrueCreditCardInterest(withCard(bad, 0.17));
      const byApr = accrueCreditCardInterest(withCard(1_000, bad));

      expect(Number.isFinite(byBalance.totalInterest)).toBe(true);
      expect(Number.isFinite(byApr.totalInterest)).toBe(true);
      expect(byBalance.totalInterest).toBeGreaterThanOrEqual(0);
      expect(byApr.totalInterest).toBeGreaterThanOrEqual(0);
    }
  });

  it('is wired into the weekly banking tick and shows the player', () => {
    const tick = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib/banking/weeklyTick.ts'),
      'utf8',
    );

    expect(tick).toMatch(/const cardAccrual = accrueCreditCardInterest\(banking\)/);
    expect(tick).toMatch(/Card Interest Charged/);
    // Counted as interest PAID, not earned.
    expect(tick).toMatch(/safe\(input\.loanInterestPaid\) \+ safe\(cardAccrual\.totalInterest\)/);
  });
});
