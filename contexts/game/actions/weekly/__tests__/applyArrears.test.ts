/**
 * Unpaid bills must become a debt, not a gift.
 *
 * The weekly cash line clamped at zero, so anything a player could not cover was
 * silently forgiven. That, plus the hard zero floor on `stats.money` and the
 * absence of any baseline cost of living, left the whole money axis without a
 * failure state — `BANKRUPTCY_FLOOR` named a bankruptcy the game could not reach.
 */
import { ARREARS_LATE_FEE_RATE, applyArrears } from '../applyArrears';

describe('applyArrears', () => {
  it('leaves a solvent week completely unchanged', () => {
    const r = applyArrears({ availableCash: 1000, billsDue: 300, previousOverdue: 0 });
    expect(r.cashAfter).toBe(700);
    expect(r.overdueBalance).toBe(0);
    expect(r.newShortfall).toBe(0);
    expect(r.surcharge).toBe(0);
    expect(r.creditScoreDelta).toBe(0);
  });

  it('books the shortfall instead of forgiving it', () => {
    // THE regression. Pre-fix this produced cashAfter 0 and nothing else — the
    // missing $200 simply ceased to exist.
    const r = applyArrears({ availableCash: 100, billsDue: 300, previousOverdue: 0 });
    expect(r.cashAfter).toBe(0);
    expect(r.newShortfall).toBe(200);
    expect(r.overdueBalance).toBeGreaterThanOrEqual(200);
  });

  it('never drives cash negative, however deep the hole', () => {
    const r = applyArrears({ availableCash: 0, billsDue: 100_000, previousOverdue: 50_000 });
    expect(r.cashAfter).toBe(0);
    expect(r.cashAfter).not.toBeLessThan(0);
  });

  it('settles old debt before this week s bills', () => {
    // Paying current-first would let a player carry a permanent balance while
    // always looking current, which makes the debt cosmetic.
    const r = applyArrears({ availableCash: 500, billsDue: 300, previousOverdue: 400 });
    expect(r.paidTowardOverdue).toBe(400);
    // $100 left against $300 of bills → $200 short this week.
    expect(r.newShortfall).toBe(200);
    expect(r.cashAfter).toBe(0);
  });

  it('clears the debt completely when the player can afford it', () => {
    const r = applyArrears({ availableCash: 5000, billsDue: 300, previousOverdue: 400 });
    expect(r.overdueBalance).toBe(0);
    expect(r.creditScoreDelta).toBe(0);
    expect(r.cashAfter).toBe(4300);
  });

  it('charges a late fee on what was missed this week', () => {
    const r = applyArrears({ availableCash: 0, billsDue: 1000, previousOverdue: 0 });
    expect(r.surcharge).toBe(Math.round(1000 * ARREARS_LATE_FEE_RATE));
    expect(r.overdueBalance).toBe(1000 + r.surcharge);
  });

  it('never grows a standing debt on a week with nothing newly missed', () => {
    // The first implementation compounded interest on the BALANCE and bounded it
    // with a ceiling derived from that same balance — circular, so $1 000 became
    // $144 755 over ten idle years. A debt that grows while the player is doing
    // nothing is a locked save, not pressure.
    let overdue = 1000;
    for (let week = 0; week < 500; week++) {
      const r = applyArrears({ availableCash: 0, billsDue: 0, previousOverdue: overdue });
      expect(r.surcharge).toBe(0);
      overdue = r.overdueBalance;
    }
    expect(overdue).toBe(1000);
  });

  it('grows only in proportion to what the player actually fails to pay', () => {
    // Monotone in the player's own misses — the property that keeps it escapable.
    let overdue = 0;
    for (let week = 0; week < 50; week++) {
      overdue = applyArrears({ availableCash: 0, billsDue: 100, previousOverdue: overdue }).overdueBalance;
    }
    // 50 weeks x ($100 + 5% fee) — linear, not exponential.
    expect(overdue).toBe(50 * 105);
  });

  it('is always escapable by earning', () => {
    // The way out has to be play, not luck. Deep hole, then a good income.
    let overdue = applyArrears({ availableCash: 0, billsDue: 4000, previousOverdue: 0 }).overdueBalance;
    expect(overdue).toBeGreaterThan(0);

    for (let week = 0; week < 10 && overdue > 0; week++) {
      overdue = applyArrears({ availableCash: 2000, billsDue: 200, previousOverdue: overdue }).overdueBalance;
    }
    expect(overdue).toBe(0);
  });

  it('treats a missing/corrupt carried balance as zero rather than NaN', () => {
    // This value is arithmetic in the weekly cash line, so a partial save
    // reaching here undefined would poison stats.money for the rest of the life.
    const r = applyArrears({ availableCash: 500, billsDue: 100 });
    expect(r.cashAfter).toBe(400);
    expect(Number.isFinite(r.overdueBalance)).toBe(true);

    const corrupt = applyArrears({
      availableCash: Number.NaN,
      billsDue: Number.POSITIVE_INFINITY,
      previousOverdue: -50,
    });
    expect(Number.isFinite(corrupt.cashAfter)).toBe(true);
    expect(Number.isFinite(corrupt.overdueBalance)).toBe(true);
    expect(corrupt.cashAfter).toBeGreaterThanOrEqual(0);
    expect(corrupt.overdueBalance).toBeGreaterThanOrEqual(0);
  });
});
