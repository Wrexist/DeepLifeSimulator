/**
 * The inflation system has to actually run.
 *
 * `applyWeeklyInflation` had ZERO production callers. `MoneyActionsContext`
 * imported it (and `getInflatedPrice`) and used neither. So `economy.priceIndex`
 * stayed at its initial `1` for every player, forever, which meant:
 *
 *   - `getInflatedPrice(x, 1) === x` at all eight real call sites (company
 *     founding, mining upgrades) — every "inflation-adjusted" price was raw
 *   - `inflationRateAnnual: 0.03` was a dead field
 *   - the R4-X7 change that routed policy `inflationRate` into this function
 *     connected a pipe to a function nobody called
 *
 * And `policyEffectsHonesty.test.ts` was green the whole time, because it calls
 * `applyWeeklyInflation` DIRECTLY. That is the leaf-vs-entry-point failure the
 * `applyBenefit` post-mortem already recorded (lessons.md, 2026-06-30): testing
 * the shared helper proves the helper works, not that the feature is reachable.
 *
 * So this file asserts REACHABILITY — that the weekly tick is wired to it — and
 * the balance property that makes turning it on safe.
 */
import fs from 'fs';
import path from 'path';
import { applyWeeklyInflation } from '@/lib/economy/inflation';
import { applyCareerSalaryAndPenalty } from '@/contexts/game/actions/weekly/applyCareerSalaryAndPenalty';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('inflation is reachable from the weekly tick', () => {
  it('the week loop calls applyWeeklyInflation', () => {
    // A reachability assertion has to look at the caller: there is no way to
    // prove "someone calls this" by calling it yourself.
    const tick = fs.readFileSync(
      path.join(REPO_ROOT, 'contexts/game/GameActionsContext.tsx'),
      'utf8',
    );
    const code = tick.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).toMatch(/applyWeeklyInflation\s*\(/);
  });

  it('advances the price index off its frozen 1', () => {
    let state = createTestGameState({ economy: { inflationRateAnnual: 0.03, priceIndex: 1 } });
    for (let week = 0; week < 52; week++) state = applyWeeklyInflation(state);
    expect(state.economy!.priceIndex).toBeGreaterThan(1.02);
    expect(state.economy!.priceIndex).toBeLessThan(1.04);
  });
});

describe('inflation does not quietly cut the player s wages', () => {
  /** Weekly pay the tick would credit for a given price index. */
  function weeklyPay(priceIndex: number): number {
    const state = createTestGameState({
      currentJob: 'inflation_probe',
      careers: [
        {
          id: 'inflation_probe',
          levels: [{ name: 'Probe', salary: 1000 }],
          level: 0,
          description: 'fixture',
          requirements: {},
          progress: 0,
          applied: true,
          accepted: true,
        },
      ],
      economy: { inflationRateAnnual: 0.03, priceIndex },
    } as Partial<GameState>);

    const ctx = {
      newStats: { ...state.stats },
      notifications: [],
    } as unknown as Parameters<typeof applyCareerSalaryAndPenalty>[1];

    return applyCareerSalaryAndPenalty(state, ctx).careerSalary;
  }

  it('scales nominal pay with the price index', () => {
    // Turning inflation on without this would be a pure downgrade: catalogue
    // costs climb through getInflatedPrice while the career ladder stays on a
    // fixed nominal number, so a long life ends paying a ~6x cost of living out
    // of a starting paycheck.
    expect(weeklyPay(2)).toBeGreaterThan(weeklyPay(1) * 1.9);
  });

  it('is a no-op at the neutral index, so nothing changes for a fresh save', () => {
    expect(weeklyPay(1)).toBe(1000);
  });

  it('ignores a corrupt index rather than zeroing the paycheck', () => {
    expect(weeklyPay(Number.NaN)).toBe(1000);
    expect(weeklyPay(0)).toBe(1000);
    expect(weeklyPay(-5)).toBe(1000);
  });
});
