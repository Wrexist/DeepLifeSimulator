/**
 * `utils/stateInvariants.ts` — the money-path checks, which had no tests at all.
 *
 * Found via branch coverage: this file sat at 5.2% branches / 9.6% statements
 * while `validateMoneyInvariants` is wired into `MoneyActionsContext.updateMoney`.
 *
 * ── One thing worth recording, because the first version of this file got it
 *    wrong ──────────────────────────────────────────────────────────────────
 *
 * `updateMoney` ends with `Math.max(0, prevState.stats.money + amount)`, and
 * hands that CLAMPED value to a validator whose expectation is the UNCLAMPED
 * `currentMoney + moneyChange`. Read from the clamp downward, that looks like a
 * guaranteed false positive on every overdraft.
 *
 * It is not, because of the twenty lines ABOVE the clamp: `updateMoney` already
 * rejects an overdraft and returns `prevState` unchanged when
 * `money + amount < -0.01`. So the only inputs that could produce a mismatch
 * never reach the check. The clamp is a pure backstop for the sub-cent window
 * the guard allows through, and in that window `|finalMoney - expectedFinal|`
 * is at most 0.01 — exactly the tolerance the validator already permits.
 *
 * The mismatch branch is therefore unreachable from production, and it should
 * stay an ERROR: `validateMoneyInvariants` has no way to know a clamp happened,
 * so relaxing it for `finalMoney === 0` would let a genuinely corrupt zero pass.
 * Caught in review of #133. The tests below model the REAL caller — guard and
 * all — so they cannot re-confirm that mistake.
 */
import {
  validateMoneyInvariants,
  validateStatsInvariants,
  validateStatChanges,
} from '@/utils/stateInvariants';
import type { InvariantCheckResult } from '@/utils/stateInvariants';

/**
 * A discriminated union rather than an optional `check`: when the guard refuses
 * the spend there is no validation to report, and `rejected` is what says so.
 */
type MoneyUpdateResult =
  | { rejected: true; newMoney: number; check: null }
  | { rejected: false; newMoney: number; check: InvariantCheckResult };

/**
 * `updateMoney`'s money arithmetic, both halves, verbatim from
 * `contexts/game/MoneyActionsContext.tsx`. The guard is the point — a helper
 * with only the clamp models a caller that does not exist.
 */
const updateMoney = (money: number, amount: number): MoneyUpdateResult => {
  if (amount < 0 && money + amount < -0.01) {
    return { rejected: true, newMoney: money, check: null };
  }
  const newMoney = Math.max(0, money + amount);
  return {
    rejected: false,
    newMoney,
    check: validateMoneyInvariants(money, amount, newMoney),
  };
};

describe('updateMoney refuses an overdraft instead of clamping it', () => {
  it('leaves the balance untouched when the spend exceeds it', () => {
    // §4.4: the affordability test lives in the same updater as the charge, so
    // the state is returned unchanged rather than nudged to zero.
    const result = updateMoney(500, -1_000);

    expect(result.rejected).toBe(true);
    expect(result.newMoney).toBe(500);
  });

  it('so the validator never sees a clamped-away shortfall', () => {
    // The reason the mismatch branch stays an error: it is unreachable here.
    expect(updateMoney(500, -1_000).check).toBeNull();
  });

  it('spending the exact balance is allowed and lands on zero', () => {
    const result = updateMoney(500, -500);

    expect(result.rejected).toBe(false);
    expect(result.newMoney).toBe(0);
    expect(result.check?.valid).toBe(true);
  });

  it('the sub-cent window the guard allows through stays within tolerance', () => {
    // The only inputs that reach the clamp at all: a shortfall smaller than a
    // cent. It lands on 0, and the validator accepts it on its 0.01 tolerance
    // rather than on any special-casing of zero — which is why that tolerance
    // is load-bearing and not decoration.
    //
    // A half-cent, not a full one: `1 - 1.01` is -0.010000000000000009 in
    // binary floating point, which IS below the `-0.01` bound, so the guard
    // rejects it. The window is open, but narrower than it reads.
    const result = updateMoney(1, -1.005);

    expect(result.rejected).toBe(false);
    expect(result.newMoney).toBe(0);
    expect(result.check?.valid).toBe(true);
  });

  it('and a one-cent shortfall is already outside it (the float boundary)', () => {
    expect(updateMoney(1, -1.01).rejected).toBe(true);
  });

  it('an ordinary earn is unremarkable (the control)', () => {
    const result = updateMoney(1_000, 250);

    expect(result.newMoney).toBe(1_250);
    expect(result.check?.valid).toBe(true);
    expect(result.check?.warnings).toEqual([]);
  });
});

describe('validateMoneyInvariants rejects what it is there to reject', () => {
  it('catches a final balance that does not match the arithmetic', () => {
    const check = validateMoneyInvariants(100, 50, 999);

    expect(check.valid).toBe(false);
    expect(check.errors.join(' ')).toMatch(/mismatch/i);
  });

  it('still errors when a negative expectation lands on zero', () => {
    // The validator cannot see whether a caller clamped, so a zero that does
    // not follow from the arithmetic is indistinguishable from corruption and
    // is treated as such. Relaxing this was proposed and rejected in #133.
    const check = validateMoneyInvariants(500, -1_000, 0);

    expect(check.valid).toBe(false);
    expect(check.errors.join(' ')).toMatch(/mismatch/i);
  });

  it('rejects a negative final balance', () => {
    const check = validateMoneyInvariants(100, -500, -400);

    expect(check.valid).toBe(false);
    expect(check.errors.join(' ')).toMatch(/negative/i);
  });

  it('rejects NaN and Infinity on every input', () => {
    expect(validateMoneyInvariants(NaN, 10, 10).valid).toBe(false);
    expect(validateMoneyInvariants(10, NaN, 10).valid).toBe(false);
    expect(validateMoneyInvariants(10, 10, NaN).valid).toBe(false);
    expect(validateMoneyInvariants(Infinity, 10, 10).valid).toBe(false);
    expect(validateMoneyInvariants(10, -Infinity, 10).valid).toBe(false);
  });

  it('reports one error per bad input, not a cascade', () => {
    // `NaN !== NaN`, so the arithmetic comparison would pile a useless second
    // error on top of the real one — the `errors.length === 0` guard is what
    // stops that, and this pins it.
    const check = validateMoneyInvariants(NaN, 10, 10);

    expect(check.errors).toHaveLength(1);
    expect(check.errors[0]).toMatch(/currentMoney/);
  });

  it('accepts a correct calculation within its 0.01 tolerance', () => {
    expect(validateMoneyInvariants(100, 50, 150.005).valid).toBe(true);
  });
});

describe('the sibling checks, which also had no tests', () => {
  it('flags an out-of-range stat but allows the bounds themselves', () => {
    expect(validateStatsInvariants({ health: 101 }).valid).toBe(false);
    expect(validateStatsInvariants({ health: -1 }).valid).toBe(false);
    expect(validateStatsInvariants({ health: 0 }).valid).toBe(true);
    expect(validateStatsInvariants({ health: 100 }).valid).toBe(true);
  });

  it('flags negative money and gems', () => {
    expect(validateStatsInvariants({ money: -1 }).valid).toBe(false);
    expect(validateStatsInvariants({ gems: -1 }).valid).toBe(false);
  });

  it('warns rather than errors on an implausibly large gem balance', () => {
    const check = validateStatsInvariants({ gems: 1_000_000_000 });

    expect(check.valid).toBe(true);
    expect(check.warnings).toHaveLength(1);
  });

  it('treats an absent stat as fine, not as zero', () => {
    // Every check is guarded on `!== undefined`, and a partial object is the
    // normal input here, so an empty one must be valid rather than 0-valued.
    expect(validateStatsInvariants({}).valid).toBe(true);
  });

  it('warns rather than errors on an implausibly large stat CHANGE', () => {
    const check = validateStatChanges({ happiness: 5_000 });

    expect(check.valid).toBe(true);
    expect(check.warnings).toHaveLength(1);
  });

  it('errors on a NaN stat change', () => {
    expect(validateStatChanges({ energy: NaN }).valid).toBe(false);
  });

  it('skips undefined changes without complaining', () => {
    expect(validateStatChanges({ energy: undefined }).valid).toBe(true);
  });
});
