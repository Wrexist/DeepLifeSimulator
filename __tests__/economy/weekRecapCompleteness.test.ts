/**
 * TICK-A4 — the weekly recap was computed before eight cash movements.
 *
 * `weekResult` is built partway through the week loop, and eight things move
 * cash AFTER it: subscriptions, the hustle tick, the crypto tick, banking late
 * fees, banking bills, channel memberships, savings goals, and auto-reinvest.
 * Only the subscription fee folded itself back in. So a week whose entire story
 * was "the mining rig paid out and the bills came due" reported neither, and
 * the sheet's `netChange` did not match the money the player watched change.
 *
 * This is the THIRD instance of the same class in that one object —
 * `luxuryRiskCost` and `luxuryYield` were both found and fixed the same way,
 * for the same reason, in the recap-1 pass. That is what makes it worth a
 * structural guard rather than another one-line fix: the next subsystem added
 * after the build point will do it again.
 *
 * The test is deliberately a SOURCE guard rather than a full week simulation.
 * The week loop needs the whole provider stack, and what actually went wrong
 * here is structural — a write that skipped the reporting path — so that is
 * what is pinned.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'), 'utf8',
);

const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const CODE = strip(SRC);

/** Everything after `weekResult` is built — the window where the bug lives. */
function afterRecapBuilt(): string {
  const i = CODE.indexOf('const weekResult = {');
  expect(i).toBeGreaterThan(-1);
  return CODE.slice(i);
}

describe('TICK-A4 - the reporting helpers exist and are honest', () => {
  it('there is one place a post-recap cash movement is recorded', () => {
    expect(CODE).toMatch(/const recordRecapCash = \(applied: number\): void =>/);
    expect(CODE).toMatch(/const applyCashAndRecord = \(delta: number\): void =>/);
  });

  it('the helper reports the ACTUAL applied delta, not the nominal one', () => {
    // Every site floors with Math.max(0, …), so on a broke week the nominal
    // overstates what really left the wallet. Reporting the nominal would have
    // been a second, quieter version of the same bug.
    expect(CODE).toMatch(/const before = newStats\.money;/);
    expect(CODE).toMatch(/newStats\.money = Math\.max\(0, before \+ delta\);/);
    expect(CODE).toMatch(/recordRecapCash\(newStats\.money - before\)/);
  });

  it('a positive delta is income and a negative one is an expense', () => {
    expect(CODE).toMatch(/if \(rounded > 0\) weekResult\.incomeEarned \+= rounded;/);
    expect(CODE).toMatch(/else weekResult\.expensesPaid \+= -rounded;/);
    expect(CODE).toMatch(/weekResult\.netChange \+= rounded;/);
  });

  it('a zero or non-finite delta records nothing', () => {
    // Guards the equivalence snapshots: a week with no hustle, no crypto and no
    // bills must produce a byte-identical recap to before this change.
    expect(CODE).toMatch(/if \(!isFinite\(applied\)\) return;/);
    expect(CODE).toMatch(/if \(rounded === 0\) return;/);
  });
});

describe('TICK-A4 - every post-recap cash movement reports itself', () => {
  /**
   * The structural guard. A raw `newStats.money = Math.max(0, newStats.money …)`
   * after the recap is built is exactly the shape that caused this, so the
   * window is required to contain none.
   */
  it('no raw floored wallet write survives after the recap is built', () => {
    const tail = afterRecapBuilt();
    const raw = tail.match(/newStats\.money = Math\.max\(0, newStats\.money [+-][^;]*\);/g) ?? [];

    // The subscription fee is the one pre-existing site that already folded
    // itself in by hand, immediately below its own write. It is left as-is
    // because its guard preserves the seeded-tick equivalence snapshots.
    expect(raw.map((r) => r.trim())).toEqual([
      'newStats.money = Math.max(0, newStats.money - subscriptionBilling.totalCharged);',
    ]);
  });

  it('and that one exception still folds itself in', () => {
    expect(CODE).toMatch(/weekResult\.expensesPaid \+= chargeRounded;/);
    expect(CODE).toMatch(/weekResult\.netChange -= chargeRounded;/);
  });

  it('the six converted sites all route through the helper', () => {
    const tail = afterRecapBuilt();

    for (const site of [
      'hustleTickResult.cashDelta',
      'cryptoTick.cashDelta',
      '-bankingTick.lateFeesDeducted',
      '-bankingTick.billsPaidFromCash',
      'membershipsResult.cashDelta',
      'cashDeltaAfterReinvest',
    ]) {
      expect(`${site}: ${tail.includes(`applyCashAndRecord(${site})`)}`)
        .toBe(`${site}: true`);
    }
  });

  it('the savings-goal REWARD is reported but the transfer is not', () => {
    // The carve-out, asserted so it reads as intentional: the reward is new
    // money, the transfer conserves assets and booking it as an expense would
    // report a loss on a week the player lost nothing.
    const tail = afterRecapBuilt();

    expect(tail).toMatch(/recordRecapCash\(goalsResult\.rewardCash\)/);
    expect(tail).not.toMatch(/recordRecapCash\(goalsResult\.cash/);
    // The transfer assignment itself is untouched.
    expect(tail).toMatch(/newStats\.money = Math\.max\(0, goalsResult\.cash \+ goalsResult\.rewardCash\);/);
  });
});

describe('TICK-A4 - the two earlier fixes of this class are still in place', () => {
  /**
   * `luxuryRiskCost` and `luxuryYield` are the same bug found twice before.
   * If either regresses, the structural guard above would not catch it - they
   * are folded into the recap's initial construction, not written after it.
   */
  it('luxury risk cost is still counted as an expense', () => {
    expect(CODE).toMatch(/const totalExpenses = [^;]*luxuryRiskCost/);
  });

  it('luxury yield is still counted as income', () => {
    expect(CODE).toMatch(/incomeEarned: totalIncome \+ luckyBonus \+ streakBonusAmount \+ luxuryYield/);
    expect(CODE).toMatch(/netChange: Math\.round\(totalIncome \+ luckyBonus \+ streakBonusAmount \+ luxuryYield - totalExpenses\)/);
  });

  it('and none of them are taxed retroactively (the control)', () => {
    // `totalIncome` feeds calculateIncomeTax far earlier. Folding recap-only
    // figures into it would be a balance change, not a reporting fix - the
    // helper writes to weekResult and nothing else.
    expect(CODE).not.toMatch(/recordRecapCash[\s\S]{0,400}totalIncome \+=/);
    expect(CODE).not.toMatch(/applyCashAndRecord[\s\S]{0,200}totalIncome =/);
  });
});
