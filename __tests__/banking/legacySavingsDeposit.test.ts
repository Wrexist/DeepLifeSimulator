/**
 * The gold piggy can finally be funded.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "The default savings account that links to
 * the gold piggy still does not work."
 *
 * The HUD's amber chip renders `bankSavings`, and `bankSavings` had exactly
 * three non-test writers — the weekly interest tick, the divorce split, and the
 * estate reader. Nothing anywhere deposited into it, so interest on a balance of
 * 0 kept it at 0 for the entire life. The earlier fix (letting the player open a
 * SECOND savings account) works, but that money lands in `banking.accounts` and
 * never reaches the field the chip reads.
 *
 * `savings-default` is now a real deposit target routed through `bankSavings`.
 * `checking-default` is NOT — it mirrors `stats.money`, and the exploit guards
 * in `mirrorAccountExploit.test.ts` still pin that.
 *
 * The property that matters most here is the one that made the mirrors read-only
 * in the first place: the weekly re-mirror must not undo the deposit. These
 * tests run the real `runWeeklyBankingTick` over the post-deposit state rather
 * than trusting the action in isolation.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { applyWithSetState as apply } from '../helpers/setGameStateStub';
import { GameState } from '@/contexts/game/types';
import {
  depositCashToAccount,
  withdrawCashFromAccount,
} from '@/contexts/game/actions/BankingActions';
import { runWeeklyBankingTick } from '@/lib/banking/weeklyTick';
import { nonMirrorDeposits, LEGACY_SAVINGS_ACCOUNT_ID } from '@/lib/banking/operations';
import { MONEY_CEILING } from '@/contexts/game/actions/MoneyActions';

const savingsRow = (s: GameState) =>
  s.banking!.accounts.find((a) => a.id === LEGACY_SAVINGS_ACCOUNT_ID)!;

/** Run the real weekly banking tick, which is what used to erase mirror writes. */
function reMirror(s: GameState): GameState {
  // Typed with the function's OWN parameter type, not `as never`. This helper
  // carries the file's central guarantee — the weekly re-mirror must not undo a
  // deposit — and `as never` disabled type checking of the very argument that
  // guarantee depends on. A renamed or added field would still compile, and the
  // guarantee would quietly become vacuous.
  const args: Parameters<typeof runWeeklyBankingTick>[0] = {
    banking: s.banking!,
    currentWeek: (s.weeksLived ?? 0) + 1,
    newBankSavings: s.bankSavings ?? 0,
    newMoney: s.stats.money,
    economyState: undefined,
    // Required, and the cast was hiding both: no loans in this fixture, so the
    // before/after lists are the save's own (empty) list on both sides.
    prevLoans: s.loans ?? [],
    processedLoans: s.loans ?? [],
  };
  const result = runWeeklyBankingTick(args);
  return { ...s, banking: result.banking };
}

describe('depositing into the default savings account', () => {
  it('moves cash into bankSavings - the field the gold chip reads', () => {
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 5_000;

    const after = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 2_000));

    expect(after.stats.money).toBe(3_000);
    expect(after.bankSavings).toBe(2_000);
  });

  it('updates the visible account row in the same commit, not next week', () => {
    // Writing only `bankSavings` would leave the Bank screen showing a stale $0
    // until the next tick re-mirrored it — which reads as "the deposit didn't
    // work", i.e. the exact complaint being fixed.
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 5_000;

    const after = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 2_000));

    expect(savingsRow(after).balance).toBe(2_000);
  });

  it('SURVIVES the weekly re-mirror - the reason mirrors were read-only', () => {
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 5_000;

    const deposited = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 2_000));
    const ticked = reMirror(deposited);

    expect(ticked.bankSavings).toBe(2_000);
    expect(savingsRow(ticked).balance).toBe(2_000);
  });

  it('rejects more than the player holds', () => {
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 100;

    const after = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 500));

    expect(after.stats.money).toBe(100);
    expect(after.bankSavings).toBe(0);
  });

  it('rejects a negative or non-finite amount rather than crediting it', () => {
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 1_000;

    for (const bad of [-500, NaN, Infinity]) {
      const after = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, bad));
      expect(after.stats.money).toBe(1_000);
      expect(after.bankSavings).toBe(0);
    }
  });
});

describe('withdrawing from the default savings account', () => {
  it('returns the money to cash', () => {
    const base = { ...createTestGameState(), bankSavings: 3_000 };
    base.stats.money = 100;

    const after = apply(base, (set) => withdrawCashFromAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 1_000));

    expect(after.bankSavings).toBe(2_000);
    expect(after.stats.money).toBe(1_100);
    expect(savingsRow(after).balance).toBe(2_000);
  });

  it('refuses to overdraw the savings pool', () => {
    const base = { ...createTestGameState(), bankSavings: 500 };
    base.stats.money = 0;

    const after = apply(base, (set) => withdrawCashFromAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 5_000));

    expect(after.bankSavings).toBe(500);
    expect(after.stats.money).toBe(0);
  });

  it('does not destroy savings when the cash credit is clamped at the ceiling', () => {
    // `applyMoneyDelta` does NOT refuse an over-ceiling credit — it clamps to
    // MONEY_CEILING and returns a value. Debiting the requested amount while
    // cash rose by less would silently delete the difference. The debit is
    // therefore derived from what actually landed.
    const base = { ...createTestGameState(), bankSavings: 1_000_000 };
    base.stats.money = MONEY_CEILING - 400;

    const after = apply(base, (set) => withdrawCashFromAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 1_000));

    const cashGained = after.stats.money - (MONEY_CEILING - 400);
    const savingsLost = 1_000_000 - (after.bankSavings ?? 0);
    expect(savingsLost).toBe(cashGained);
    expect(after.stats.money + (after.bankSavings ?? 0))
      .toBe(MONEY_CEILING - 400 + 1_000_000);
  });

  it('conserves value across a deposit → tick → withdraw round trip', () => {
    // The failure this guards is the one that justified the read-only rule:
    // money destroyed on the way in, or printed on the way out.
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 10_000;
    const startTotal = base.stats.money + base.bankSavings;

    const deposited = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 4_000));
    const ticked = reMirror(deposited);
    const withdrawn = apply(ticked, (set) => withdrawCashFromAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 4_000));

    expect(withdrawn.stats.money + (withdrawn.bankSavings ?? 0)).toBe(startTotal);
    expect(withdrawn.bankSavings).toBe(0);
  });
});

describe('the checking mirror is still read-only', () => {
  // Re-asserted here (not only in mirrorAccountExploit) because this change
  // narrowed the guard from "both mirrors" to "checking only". If someone later
  // widens the savings carve-out to cover checking, this fails loudly.
  it('deposits into checking-default are still rejected', () => {
    const base = createTestGameState();
    base.stats.money = 5_000;

    const after = apply(base, (set) => depositCashToAccount(set, 'checking-default', 1_000));

    expect(after.stats.money).toBe(5_000);
  });

  it('withdrawals from checking-default are still rejected', () => {
    const base = createTestGameState();
    base.stats.money = 5_000;

    const after = apply(base, (set) => withdrawCashFromAccount(set, 'checking-default', 1_000));

    expect(after.stats.money).toBe(5_000);
  });
});

describe('the savings pool is not double-counted', () => {
  it('a legacy-savings deposit does not register as a self-opened deposit', () => {
    // `nonMirrorDeposits` is summed ALONGSIDE `bankSavings` by the canonical
    // netWorth, the HUD chip and the Bank Breakdown modal. If the deposit landed
    // in a non-mirror row as well, every one of those would double it.
    const base = { ...createTestGameState(), bankSavings: 0 };
    base.stats.money = 5_000;

    const after = apply(base, (set) => depositCashToAccount(set, LEGACY_SAVINGS_ACCOUNT_ID, 2_000));

    expect(nonMirrorDeposits(after.banking!.accounts)).toBe(0);
  });
});
