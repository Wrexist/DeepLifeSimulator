/**
 * `validateMoneyInvariants` — the money-path check that cried wolf.
 *
 * `MoneyActionsContext.updateMoney` computes the new balance as
 *
 *     const newMoney = Math.max(0, prevState.stats.money + amount);
 *
 * and then hands that CLAMPED value to `validateMoneyInvariants`, whose
 * expectation is the UNCLAMPED `currentMoney + moneyChange`. So every spend
 * larger than the balance reported `Money calculation mismatch` and logged
 * `Money update violated invariants` — not because anything was wrong, but
 * because the checker did not know about the clamp its own caller applies.
 *
 * That is worse than having no check. The one channel that would report a real
 * arithmetic error was full of guaranteed false positives, which is the same
 * failure the coverage ratchet was rewritten to avoid: a signal that always
 * fires trains you to stop reading it.
 *
 * The two situations are genuinely different and the result now says which:
 *   - clamped at zero  → a WARNING. The arithmetic is right; a caller charged
 *     more than the player had, which §4.4 says should have been refused
 *     upstream. Worth surfacing, not worth calling the state invalid.
 *   - anything else     → an ERROR, as before.
 *
 * Found by branch coverage: `utils/stateInvariants.ts` was at 5.2% branches
 * and had no test file at all.
 */
import {
  validateMoneyInvariants,
  validateStatsInvariants,
  validateStatChanges,
} from '@/utils/stateInvariants';

/** Exactly what `updateMoney` does, so the test tracks the real caller. */
const updateMoney = (money: number, amount: number) => {
  const newMoney = Math.max(0, money + amount);
  return { newMoney, check: validateMoneyInvariants(money, amount, newMoney) };
};

describe('an overdrafting spend is not an invariant violation', () => {
  it('does not report an error when the balance clamps at zero', () => {
    // The regression. $500 spending $1,000 lands at $0 by design.
    const { newMoney, check } = updateMoney(500, -1_000);

    expect(newMoney).toBe(0);
    expect(check.errors).toEqual([]);
    expect(check.valid).toBe(true);
  });

  it('but it does say so, because the caller should have refused it', () => {
    // The information is real — §4.4 puts affordability in the same updater as
    // the charge — so it is kept, as the warning it always was.
    const { check } = updateMoney(500, -1_000);

    expect(check.warnings).toHaveLength(1);
    expect(check.warnings[0]).toMatch(/clamp/i);
    expect(check.warnings[0]).toContain('500'); // the shortfall, not just a flag
  });

  it('spending exactly the balance is silent (the boundary)', () => {
    const { newMoney, check } = updateMoney(500, -500);

    expect(newMoney).toBe(0);
    expect(check.valid).toBe(true);
    expect(check.warnings).toEqual([]);
  });
});

describe('and a genuine mismatch is still an error', () => {
  it('catches a final balance that does not match the arithmetic', () => {
    // The case the check exists for: 100 + 50 should be 150, not 999.
    const check = validateMoneyInvariants(100, 50, 999);

    expect(check.valid).toBe(false);
    expect(check.errors.join(' ')).toMatch(/mismatch/i);
  });

  it('does not let the clamp excuse a wrong non-zero result', () => {
    // A clamp can only ever produce 0. A negative expectation landing on some
    // other number is still arithmetic that does not add up, and treating the
    // clamp as a blanket exemption would have hidden exactly this.
    const check = validateMoneyInvariants(500, -1_000, 250);

    expect(check.valid).toBe(false);
    expect(check.errors.join(' ')).toMatch(/mismatch/i);
  });

  it('still rejects a negative final balance', () => {
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

  it('does not also cry mismatch when an input is already NaN', () => {
    // `NaN !== NaN`, so the arithmetic comparison would fire a second, useless
    // error on top of the real one. One cause should produce one message.
    const check = validateMoneyInvariants(NaN, 10, 10);

    expect(check.errors).toHaveLength(1);
    expect(check.errors[0]).toMatch(/currentMoney/);
  });

  it('accepts an ordinary earn (the control)', () => {
    const { newMoney, check } = updateMoney(1_000, 250);

    expect(newMoney).toBe(1_250);
    expect(check.valid).toBe(true);
    expect(check.warnings).toEqual([]);
  });
});

describe('the sibling checks this file had no tests for at all', () => {
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

  it('treats an absent stat as fine, not as zero', () => {
    // Every check is guarded on `!== undefined`; a partial object is the
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

  it('skips null and undefined changes without complaining', () => {
    expect(validateStatChanges({ energy: undefined }).valid).toBe(true);
  });
});
