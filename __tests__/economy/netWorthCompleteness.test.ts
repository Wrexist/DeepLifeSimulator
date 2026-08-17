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
import { makeBankAccount, makeCrypto, makeLoan } from '../helpers/makeFinance';
import type { GameState , BankAccount } from '@/contexts/game/types';

/**
 * R4 correction to R3-M4 — the two things the R3 fix got wrong.
 *
 * 1. **Mirror double-count.** `banking.accounts` always contains
 *    `checking-default` and `savings-default`, which the weekly tick's
 *    `mirrorAccountsFromLegacy` overwrites with `stats.money` and `bankSavings`
 *    on step 1 of every week. R3-M4 added a raw sum of ALL account balances on
 *    top of `money + bankSavings`, so both legacy pools were counted twice —
 *    roughly DOUBLING reported net worth for any cash-holding player. That
 *    figure gates prestige availability and the prestige points award, the
 *    $10M achievement, ambition goals, life chapters, the leaderboard, the
 *    >$10M passive-income soft cap, bail cost and ad-reward scaling.
 *
 *    The repo already shipped the guard: `nonMirrorDeposits`, whose doc comment
 *    says verbatim that anything also counting the legacy fields must exclude
 *    the mirrors. The suite above missed it because its fixtures used ids like
 *    `chk`/`hysa` and left both mirrors at 0 — the fixtures avoided the inputs
 *    that break.
 *
 * 2. **Credit-card debt.** R3-M4's own finding text said `netWorth` "ignores
 *    credit-card debt", and it shipped without the term. R3-M8 then made card
 *    balances compound weekly with no minimum payment, so an unpaid card grows
 *    without bound while staying invisible on the balance sheet.
 *
 * The identical mirror bug was in `prestigeExecution`'s scenario projection,
 * where the evaluator computes `stats.money + bankSavings + …` — covered by
 * `prestigeScenarioNetWorth.test.ts`. 2026-07-31 audit round 4.
 */
import { MIRRORED_ACCOUNT_IDS } from '@/lib/banking/operations';
import { BASE_PRESTIGE_THRESHOLD, defaultPrestigeData, isPrestigeAvailable } from '@/lib/prestige/prestigeTypes';

/**
 * Each case gets a distinct money value so the memo cache — keyed on `money`
 * plus object identity — cannot serve a stale figure between assertions.
 */
let uniqueMoney = 1_000;
function stateWith(over: Partial<GameState>): GameState {
  uniqueMoney += 1;
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, money: uniqueMoney },
    ...over,
  };
}

/**
 * The same thing, for the three cases that deliberately feed MALFORMED rows.
 *
 * Kept separate on purpose. `stateWith` used to take `Record<string, unknown>`
 * and cast its result `as GameState`, which meant nothing any caller passed was
 * checked — the well-formed fixtures were getting exactly as much verification
 * as the corrupt ones, i.e. none. That is how `cryptos` rows missing `name` /
 * `change` / `changePercent` and accounts missing `openedWeek` survived.
 *
 * Splitting them makes the corruption a deliberate, visible act: everything
 * else must now be a real `Partial<GameState>`, and the cast that permits
 * garbage lives here with a reason attached rather than on every fixture.
 *
 * DELIBERATE-CORRUPTION — read by `scripts/audit/audit-save.cjs`, so Hard Rule
 * #3 counts real drift rather than the one cast this file exists to contain.
 */
function corruptStateWith(over: Record<string, unknown>): GameState {
  uniqueMoney += 1;
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, money: uniqueMoney },
    ...over,
    // DELIBERATE-CORRUPTION — see the docblock above.
  } as unknown as GameState;
}

describe('crypto counts toward net worth', () => {
  it('adds owned coins at their current price', () => {
    const withCoins = stateWith({
      cryptos: [makeCrypto({ owned: 2, price: 50_000 })],
    });

    expect(netWorth(withCoins)).toBe(withCoins.stats.money + 100_000);
  });

  it('converting cash to crypto does not reduce net worth', () => {
    // The headline symptom, stated directly.
    const cash = stateWith({ cryptos: [] });
    const converted = {
      ...cash,
      stats: { ...cash.stats, money: 0 },
      cryptos: [makeCrypto({ owned: 1, price: cash.stats.money })],
    };

    expect(netWorth(converted)).toBe(netWorth(cash));
  });

  it('ignores unowned coins rather than counting the whole market', () => {
    const noPosition = stateWith({
      cryptos: [makeCrypto({ owned: 0, price: 50_000 })],
    });

    expect(netWorth(noPosition)).toBe(noPosition.stats.money);
  });

  it('survives corrupt coin rows without producing NaN', () => {
    const corrupt = corruptStateWith({
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
        ...base.banking!,
        accounts: [
          makeBankAccount({ id: 'chk', type: 'checking', name: 'Checking', balance: 5_000 }),
          makeBankAccount({ id: 'hysa', name: 'HYSA', balance: 500_000, baseAPR: 0.045 }),
        ],
      },
    });

    expect(netWorth(withAccounts)).toBe(withAccounts.stats.money + 505_000);
  });

  it('depositing cash does not reduce net worth', () => {
    const base = createTestGameState();
    const held = stateWith({ banking: { ...base.banking!, accounts: [] } });
    const deposited = {
      ...held,
      stats: { ...held.stats, money: 0 },
      banking: {
        ...base.banking!,
        accounts: [
          makeBankAccount({ id: 'hysa', name: 'HYSA', balance: held.stats.money, baseAPR: 0.045 }),
        ],
      },
    };

    expect(netWorth(deposited)).toBe(netWorth(held));
  });

  it('survives corrupt account rows', () => {
    const base = createTestGameState();
    const corrupt = corruptStateWith({
      banking: {
        ...base.banking!,
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
      loans: [makeLoan({ id: 'l1', principal: 500 })],
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
    const before = { ...base, stats: { ...base.stats, money }, cryptos: [] };
    const after = {
      ...base,
      stats: { ...base.stats, money },
      cryptos: [makeCrypto({ owned: 1, price: 30_000 })],
    };

    expect(netWorth(before)).toBe(money);
    expect(netWorth(after)).toBe(money + 30_000);
  });

  it('recomputes when only the banking slice changes', () => {
    const money = 8_888;
    const base = createTestGameState();
    const before = {
      ...base,
      stats: { ...base.stats, money },
      banking: { ...base.banking!, accounts: [] },
    };
    const after = {
      ...base,
      stats: { ...base.stats, money },
      banking: {
        ...base.banking!,
        accounts: [makeBankAccount({ id: 'a', name: 'S', balance: 1_000 })],
      },
    };

    expect(netWorth(before)).toBe(money);
    expect(netWorth(after)).toBe(money + 1_000);
  });
});

/**
 * A save as the weekly tick leaves it: both mirror accounts present and
 * reflecting the legacy `stats.money` / `bankSavings` fields exactly, which is
 * the state the double-count needed and the fixtures above never built.
 */
function mirroredState(spec: {
  money: number;
  savings: number;
  extra?: Partial<BankAccount>[];
}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money: spec.money },
    bankSavings: spec.savings,
    banking: {
      ...base.banking!,
      accounts: [
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: spec.money, baseAPR: 0 },
        { id: 'savings-default', type: 'savings', name: 'Savings', balance: spec.savings, baseAPR: 0 },
        ...(spec.extra ?? []),
      ] as BankAccount[],
    },
  });
}

describe('R4 — the mirror accounts are not counted twice', () => {
  it('a real save really does ship both mirror accounts (the premise)', () => {
    // If the mirrors were ever removed, the double-count could not happen and
    // this whole block would be testing nothing.
    const ids = (createTestGameState().banking?.accounts ?? []).map((a) => a.id);

    for (const mirrored of MIRRORED_ACCOUNT_IDS) expect(ids).toContain(mirrored);
  });

  it('cash mirrored into checking-default is counted once', () => {
    const money = 250_000;
    const mirrored = mirroredState({ money, savings: 0 });

    expect(netWorth(mirrored)).toBe(money);
  });

  it('bankSavings mirrored into savings-default is counted once', () => {
    const savings = 90_000;
    const mirrored = mirroredState({ money: 1, savings });

    expect(netWorth(mirrored)).toBe(1 + savings);
  });

  it('a self-opened account alongside the mirrors still counts in full', () => {
    // The control: excluding the mirrors must not throw away real deposits.
    const money = 10_000;
    const state = mirroredState({
      money,
      savings: 0,
      extra: [makeBankAccount({ id: 'hysa', name: 'HYSA', balance: 400_000, baseAPR: 0.045 })],
    });

    expect(netWorth(state)).toBe(money + 400_000);
  });
});

/** A save whose only wealth is cash, carrying the given cards. */
function cardState(money: number, creditCards: unknown[]): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    bankSavings: 0,
    banking: { ...base.banking!, accounts: [], creditCards: creditCards as never },
  });
}

describe('R4 — credit-card debt is on the balance sheet', () => {
  it('subtracts an outstanding card balance', () => {
    const state = cardState(20_000, [{ id: 'c1', name: 'Card', balance: 5_000, limit: 10_000, apr: 0.24 }]);

    expect(netWorth(state)).toBe(15_000);
  });

  it('a card carrying no balance changes nothing', () => {
    const state = cardState(20_001, [{ id: 'c1', name: 'Card', balance: 0, limit: 10_000, apr: 0.24 }]);

    expect(netWorth(state)).toBe(20_001);
  });

  it('does not throw on a partial save whose banking slice has no creditCards', () => {
    // `totalCreditCardDebt` dereferences `.creditCards` directly, and netWorth
    // is called from the leaderboard and the HUD — a throw here is a blank
    // screen, not a wrong number.
    const partial = createTestGameState({
      stats: { ...createTestGameState().stats, money: 20_002 },
      bankSavings: 0,
      banking: { accounts: [] } as never,
    });

    expect(netWorth(partial)).toBe(20_002);
  });

  it('a corrupt card balance does not produce NaN', () => {
    const corrupt = cardState(20_003, [{ id: 'a', balance: NaN }, { id: 'b', balance: Infinity }, { id: 'c' }]);

    expect(netWorth(corrupt)).toBe(20_003);
  });
});

/**
 * `overdueBalance` (v31) is the arrears bucket for weekly bills the player
 * could not pay — the debt the week loop itself creates when the cash line goes
 * short. It was the ONE liability `netWorth` did not subtract: loan balances
 * and card balances both came off the total, arrears did not, and a comment at
 * the sum recorded the omission as an open GAME-BALANCE question (counting them
 * pushes a struggling player further from the prestige that clears their
 * debts).
 *
 * Owner decision, 2026-08-16: arrears ARE subtracted, at full amount, with no
 * floor — the honest balance sheet wins, and the gates that read this figure
 * (prestige availability and the points award, the $10M achievement, ambitions,
 * bail cost, ad-reward scaling, the passive-income soft cap) should all see a
 * player who is genuinely poorer. These tests pin that decision, plus the
 * corrupt-value guards that keep a liability term from becoming a credit.
 */
describe('v31 arrears are on the balance sheet', () => {
  it('subtracts the arrears bucket from net worth', () => {
    const behind = stateWith({ overdueBalance: 4_000 });

    expect(netWorth(behind)).toBe(behind.stats.money - 4_000);
  });

  it('subtracts the FULL amount — no discount, no partial weighting', () => {
    const small = stateWith({ overdueBalance: 1_000 });
    const large = stateWith({ overdueBalance: 9_000 });

    expect(small.stats.money - netWorth(small)).toBe(1_000);
    expect(large.stats.money - netWorth(large)).toBe(9_000);
  });

  it('allows the result to go NEGATIVE — there is no floor at zero', () => {
    // Deliberate: this sum has always permitted negative net worth (debt >
    // assets), and flooring arrears at the player's assets would hide exactly
    // the situation the arrears bucket exists to represent.
    const drowning = stateWith({ overdueBalance: 1_000_000 });

    expect(netWorth(drowning)).toBe(drowning.stats.money - 1_000_000);
    expect(netWorth(drowning)).toBeLessThan(0);
  });

  it('is a no-op at zero', () => {
    const clear = stateWith({ overdueBalance: 0 });
    expect(netWorth(clear)).toBe(clear.stats.money);
  });

  it('is a no-op when the field is absent (every pre-v31 save)', () => {
    const legacy = stateWith({ overdueBalance: undefined });
    expect(netWorth(legacy)).toBe(legacy.stats.money);
  });

  it('a corrupt or negative arrears value cannot CREDIT the player', () => {
    // Same guard shape as `safeCreditCardDebt`: non-finite → 0, and a negative
    // stored value clamps to 0 rather than being subtracted as a bonus.
    for (const bad of [NaN, Infinity, -Infinity, -5_000, '900']) {
      const corrupt = corruptStateWith({ overdueBalance: bad });
      expect(netWorth(corrupt)).toBe(corrupt.stats.money);
    }
  });

  it('the memo cache recomputes when only the arrears change', () => {
    const base = createTestGameState();
    const before = { ...base, stats: { ...base.stats, money: 50_000 }, overdueBalance: 0 };
    const after = { ...before, overdueBalance: 12_000 };

    expect(netWorth(before)).toBe(50_000);
    expect(netWorth(after)).toBe(38_000);
  });

  it('stacks with the other liabilities rather than replacing them', () => {
    const stacked = stateWith({
      loans: [makeLoan({ id: 'l1', principal: 500 })],
      overdueBalance: 2_000,
    });

    expect(netWorth(stacked)).toBe(stacked.stats.money - 500 - 2_000);
  });
});

describe('arrears move the gates that read net worth', () => {
  /** Prestige level 0 threshold is `BASE_PRESTIGE_THRESHOLD` = $10M. */
  const prestigeFixture = (money: number, overdueBalance: number): GameState => {
    const base = createTestGameState();
    return {
      ...base,
      stats: { ...base.stats, money },
      overdueBalance,
      prestigeAvailable: false,
      // Merged, not replaced: `prestige` is OPTIONAL on GameState, so spreading
      // it alone widens every required field of PrestigeData to `| undefined`.
      prestige: { ...defaultPrestigeData, ...base.prestige, prestigeLevel: 0 },
    };
  };

  it('gross assets over the $10M threshold still gate OPEN with no arrears (the control)', () => {
    const solvent = prestigeFixture(10_500_000, 0);

    expect(netWorth(solvent)).toBeGreaterThanOrEqual(BASE_PRESTIGE_THRESHOLD);
    expect(isPrestigeAvailable(solvent)).toBe(true);
  });

  it('the same assets do NOT pass once arrears drag the player under it', () => {
    const behind = prestigeFixture(10_500_000, 800_000);

    expect(netWorth(behind)).toBe(9_700_000);
    expect(netWorth(behind)).toBeLessThan(BASE_PRESTIGE_THRESHOLD);
    expect(isPrestigeAvailable(behind)).toBe(false);
  });

  it('arrears too small to cross the threshold leave the gate open', () => {
    const barely = prestigeFixture(10_500_000, 100_000);

    expect(isPrestigeAvailable(barely)).toBe(true);
  });
});
