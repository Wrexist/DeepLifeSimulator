/**
 * Mandatory costs charged AFTER the money writeback are no longer forgiven.
 *
 * `applyArrears` (v31) gave the money axis a failure state, but only for the
 * six bill lines computed BEFORE the writeback. Everything after it used
 * `money = Math.max(0, money - cost)`, silently forgiving whatever the player
 * could not afford — luxury upkeep and insurance, crime fines, student-loan
 * payments. Roughly half of all mandatory outgoings, including the single
 * largest: a full luxury collection owes $556,820/wk, and a broke owner kept
 * the collection AND its $301,200/wk of yields while booking nothing.
 *
 * So the game had two different answers to "you cannot pay" depending on which
 * side of the writeback a cost happened to sit on.
 */

import fs from 'fs';
import path from 'path';
import { chargeOrDefer } from '@/contexts/game/actions/weekly/chargeOrDefer';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';

const ctxWith = (money: number, deferred?: number): WeekContext =>
  ({
    newStats: { money } as WeekContext['newStats'],
    notifications: [],
    preRolls: {} as WeekContext['preRolls'],
    nextWeeksLived: 100,
    deferredCharges: deferred,
  }) as WeekContext;

describe('paying what you can', () => {
  it('takes the full cost when affordable and defers nothing', () => {
    const ctx = ctxWith(1_000);
    const r = chargeOrDefer(ctx, 400);

    expect(r).toEqual({ paid: 400, deferred: 0 });
    expect(ctx.newStats.money).toBe(600);
    expect(ctx.deferredCharges).toBeUndefined();
  });

  it('takes everything and defers the rest when short', () => {
    const ctx = ctxWith(100);
    const r = chargeOrDefer(ctx, 400);

    expect(r).toEqual({ paid: 100, deferred: 300 });
    expect(ctx.newStats.money).toBe(0);
    expect(ctx.deferredCharges).toBe(300);
  });

  it('defers the whole cost when broke', () => {
    const ctx = ctxWith(0);
    const r = chargeOrDefer(ctx, 556_820);

    expect(r.paid).toBe(0);
    expect(r.deferred).toBe(556_820);
    expect(ctx.deferredCharges).toBe(556_820);
  });

  it('never drives cash negative — the invariant ~40 call sites depend on', () => {
    for (const [money, cost] of [[0, 100], [50, 1_000], [999, 1_000]]) {
      const ctx = ctxWith(money);
      chargeOrDefer(ctx, cost);
      expect(`${money}/${cost}:${ctx.newStats.money >= 0}`).toBe(`${money}/${cost}:true`);
    }
  });

  it('accumulates across several charges in one week', () => {
    // A broke player owing upkeep AND a fine AND a loan payment carries all
    // three, not just the last one.
    const ctx = ctxWith(0);
    chargeOrDefer(ctx, 100);
    chargeOrDefer(ctx, 250);
    chargeOrDefer(ctx, 50);

    expect(ctx.deferredCharges).toBe(400);
  });

  it('does not compound — the shortfall is carried at face value', () => {
    // lessons.md records a version that compounded a surcharge on the standing
    // debt and turned $1,000 into $144,755 over ten years: a locked save, not
    // pressure. Late fees belong in applyArrears, in one place.
    const ctx = ctxWith(0);
    for (let week = 0; week < 520; week += 1) chargeOrDefer(ctx, 1_000);

    expect(ctx.deferredCharges).toBe(520_000);
  });
});

describe('degenerate inputs', () => {
  it('ignores zero and negative costs', () => {
    const ctx = ctxWith(500);
    expect(chargeOrDefer(ctx, 0)).toEqual({ paid: 0, deferred: 0 });
    expect(chargeOrDefer(ctx, -100)).toEqual({ paid: 0, deferred: 0 });
    expect(ctx.newStats.money).toBe(500);
  });

  it('treats NaN/Infinity as no charge rather than poisoning cash', () => {
    for (const bad of [NaN, Infinity, undefined as unknown as number]) {
      const ctx = ctxWith(500);
      chargeOrDefer(ctx, bad);
      expect(`${String(bad)}:${ctx.newStats.money}`).toBe(`${String(bad)}:500`);
    }
  });

  it('recovers a corrupt starting balance to 0 rather than producing NaN', () => {
    const ctx = ctxWith(NaN as unknown as number);
    chargeOrDefer(ctx, 100);
    expect(Number.isFinite(ctx.newStats.money)).toBe(true);
    expect(ctx.newStats.money).toBe(0);
  });
});

describe('the forgiving pattern is gone from the mandatory-cost reducers', () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

  it.each([
    'contexts/game/actions/weekly/applyLuxuryItems.ts',
    'contexts/game/actions/weekly/applyCrimeTick.ts',
    'contexts/game/actions/weekly/applyEducationProgression.ts',
    'contexts/game/actions/weekly/applyVehicles.ts',
    'contexts/game/actions/weekly/applyPets.ts',
    'contexts/game/actions/weekly/applyPregnancyProgression.ts',
  ])('%s defers instead of flooring', (rel) => {
    const source = read(rel);
    expect(source).toMatch(/chargeOrDefer\(/);
    // The specific shape that forgave the debt: `money = Math.max(0, money - x)`.
    expect(source).not.toMatch(/newStats\.money\s*=\s*Math\.max\(\s*0\s*,[^)]*-\s*/);
  });

  it('leaves diet and education alone — they are ALREADY in weeklyBillsDue', () => {
    // Deferring them here too would double-charge: `dietWeeklyCost` and
    // `educationWeeklyCost` are both summed into the pre-writeback bill line
    // that applyArrears already settles. Diet additionally self-skips when
    // unaffordable, which is its own (correct) handling.
    const diet = read('contexts/game/actions/weekly/applyDietPlan.ts');
    expect(diet).not.toMatch(/chargeOrDefer\(/);
  });

  it('the tick folds the deferred total into overdueBalance', () => {
    // Reachability: an accumulator nothing reads is the same as forgiving.
    const source = read('contexts/game/GameActionsContext.tsx');
    expect(source).toMatch(/arrears\.overdueBalance \+ Math\.max\(0, weeklyCtx\.deferredCharges/);
  });
});
