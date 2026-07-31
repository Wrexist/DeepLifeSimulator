/**
 * Buying Bitcoin used to make the player poorer on the scoreboard.
 *
 * `netWorth()` is the canonical wealth figure: it gates prestige
 * (`PrestigeButton`), the ultra-rich passive-income soft cap, bail cost,
 * ad-reward scaling, the identity card and the statistics history. It summed
 * money, `bankSavings`, stocks, real estate, companies, vehicles and luxury,
 * minus loans — and nothing else.
 *
 * Missing entirely: every crypto holding (`grep crypto` over the module
 * returned nothing) and every `banking.accounts[]` balance. `bank` was only the
 * legacy `bankSavings` pool, deprecated since STATE_VERSION 14 in favour of the
 * accounts array. So converting $1M of cash to BTC dropped reported net worth
 * by exactly $1M, every coin the mining warehouse produced was worth $0, and
 * depositing $500k into a high-yield savings account did the same. A
 * crypto-heavy or deposit-heavy player could be locked out of prestige
 * indefinitely — while also dodging the >$10M passive-income soft cap.
 * 2026-07-31 audit round 3, R3-M4.
 */
import { netWorth } from '@/lib/progress/achievements';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * Each case gets a distinct money value so the memo cache — keyed on `money`
 * plus object identity — cannot serve a stale figure between assertions.
 */
let uniqueMoney = 1_000;
function stateWith(over: Record<string, unknown>): GameState {
  uniqueMoney += 1;
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, money: uniqueMoney },
    ...over,
  } as GameState;
}

describe('crypto counts toward net worth', () => {
  it('adds owned coins at their current price', () => {
    const withCoins = stateWith({
      cryptos: [{ id: 'btc', symbol: 'BTC', owned: 2, price: 50_000 }],
    });

    expect(netWorth(withCoins)).toBe(withCoins.stats.money + 100_000);
  });

  it('converting cash to crypto does not reduce net worth', () => {
    // The headline symptom, stated directly.
    const cash = stateWith({ cryptos: [] });
    const converted = {
      ...cash,
      stats: { ...cash.stats, money: 0 },
      cryptos: [{ id: 'btc', symbol: 'BTC', owned: 1, price: cash.stats.money }],
    } as GameState;

    expect(netWorth(converted)).toBe(netWorth(cash));
  });

  it('ignores unowned coins rather than counting the whole market', () => {
    const noPosition = stateWith({
      cryptos: [{ id: 'btc', symbol: 'BTC', owned: 0, price: 50_000 }],
    });

    expect(netWorth(noPosition)).toBe(noPosition.stats.money);
  });

  it('survives corrupt coin rows without producing NaN', () => {
    const corrupt = stateWith({
      cryptos: [
        { id: 'a', owned: NaN, price: 100 },
        { id: 'b', owned: 1, price: Infinity },
        { id: 'c', owned: -5, price: 100 },
        { id: 'd' },
        null,
      ],
    });

    const value = netWorth(corrupt);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBe(corrupt.stats.money);
  });
});

describe('modern bank accounts count toward net worth', () => {
  it('sums every account balance', () => {
    const base = createTestGameState();
    const withAccounts = stateWith({
      banking: {
        ...base.banking,
        accounts: [
          { id: 'chk', type: 'checking', name: 'Checking', balance: 5_000, baseAPR: 0 },
          { id: 'hysa', type: 'savings', name: 'HYSA', balance: 500_000, baseAPR: 0.045 },
        ],
      },
    });

    expect(netWorth(withAccounts)).toBe(withAccounts.stats.money + 505_000);
  });

  it('depositing cash does not reduce net worth', () => {
    const base = createTestGameState();
    const held = stateWith({ banking: { ...base.banking, accounts: [] } });
    const deposited = {
      ...held,
      stats: { ...held.stats, money: 0 },
      banking: {
        ...base.banking,
        accounts: [
          { id: 'hysa', type: 'savings', name: 'HYSA', balance: held.stats.money, baseAPR: 0.045 },
        ],
      },
    } as GameState;

    expect(netWorth(deposited)).toBe(netWorth(held));
  });

  it('survives corrupt account rows', () => {
    const base = createTestGameState();
    const corrupt = stateWith({
      banking: {
        ...base.banking,
        accounts: [
          { id: 'a', balance: NaN },
          { id: 'b', balance: Infinity },
          { id: 'c' },
          null,
        ],
      },
    });

    expect(Number.isFinite(netWorth(corrupt))).toBe(true);
  });
});

describe('nothing that already counted stopped counting', () => {
  it('still counts plain cash', () => {
    const plain = stateWith({});
    expect(netWorth(plain)).toBe(plain.stats.money);
  });

  it('still subtracts loans', () => {
    const withLoan = stateWith({
      loans: [{ id: 'l1', name: 'Loan', remaining: 500, principal: 500, rateAPR: 0.1 }],
    });

    expect(netWorth(withLoan)).toBe(withLoan.stats.money - 500);
  });

  it('still counts the legacy bankSavings pool', () => {
    const legacy = stateWith({ bankSavings: 2_500 });
    expect(netWorth(legacy)).toBe(legacy.stats.money + 2_500);
  });
});

describe('the memo cache sees the new asset classes', () => {
  it('recomputes when only the crypto slice changes', () => {
    // The cache is keyed on object identity. Without `cryptos` and `banking` in
    // the key, a coin purchase would return a stale figure — which would look
    // exactly like the bug this fixes.
    const money = 7_777;
    const base = createTestGameState();
    const before = { ...base, stats: { ...base.stats, money }, cryptos: [] } as GameState;
    const after = {
      ...base,
      stats: { ...base.stats, money },
      cryptos: [{ id: 'btc', symbol: 'BTC', owned: 1, price: 30_000 }],
    } as GameState;

    expect(netWorth(before)).toBe(money);
    expect(netWorth(after)).toBe(money + 30_000);
  });

  it('recomputes when only the banking slice changes', () => {
    const money = 8_888;
    const base = createTestGameState();
    const before = {
      ...base,
      stats: { ...base.stats, money },
      banking: { ...base.banking, accounts: [] },
    } as GameState;
    const after = {
      ...base,
      stats: { ...base.stats, money },
      banking: {
        ...base.banking,
        accounts: [{ id: 'a', type: 'savings', name: 'S', balance: 1_000, baseAPR: 0 }],
      },
    } as GameState;

    expect(netWorth(before)).toBe(money);
    expect(netWorth(after)).toBe(money + 1_000);
  });
});
