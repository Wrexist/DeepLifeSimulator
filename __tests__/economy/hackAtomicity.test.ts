/**
 * A dark-web hack must not mint money.
 *
 * ── The exploit this closes ───────────────────────────────────────────────
 * `performHack` gated on `stateRef.current`, a ref synced by a POST-COMMIT
 * effect. Inside a single React batch that ref still holds the pre-batch state,
 * so two taps read identical energy and both passed:
 *
 *     if ((state.stats.energy ?? 0) < hack.energyCost) return empty;   // stale
 *     setGameState(prev => ({ ...prev, stats: {
 *       money: (prev.stats.money ?? 0) + cashReward,                   // grant
 *       energy: Math.max(0, (prev.stats.energy ?? 0) - hack.energyCost) } }))
 *
 * Energy is floored at 0, so the second run was charged NOTHING and still paid
 * the full cash reward and the BTC. Repeatable at zero energy for as long as
 * the taps landed in one batch — the game's only outright money printer.
 *
 * The guard is now `canRunHack(prev)` inside BOTH updaters (the caught branch
 * jails and costs energy too, so it needs the same protection).
 *
 * These tests exercise the updater arithmetic directly. The component needs a
 * full provider tree, and what matters is not how the callback is wired but
 * that a second same-batch run cannot be paid for out of nothing.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const ENERGY_COST = 20;
const CASH_REWARD = 5_000;

/** The FIXED updater: refuses unless `prev` can actually pay. */
function guardedRun(prev: GameState): GameState {
  if ((prev.stats?.energy ?? 0) < ENERGY_COST) return prev;
  return {
    ...prev,
    stats: {
      ...prev.stats,
      money: (prev.stats.money ?? 0) + CASH_REWARD,
      energy: Math.max(0, (prev.stats.energy ?? 0) - ENERGY_COST),
    },
  };
}

/** The ORIGINAL updater, kept so the exploit itself stays demonstrable. */
function unguardedRun(prev: GameState): GameState {
  return {
    ...prev,
    stats: {
      ...prev.stats,
      money: (prev.stats.money ?? 0) + CASH_REWARD,
      energy: Math.max(0, (prev.stats.energy ?? 0) - ENERGY_COST),
    },
  };
}

/** From the factory, spread — no `as GameState` (Hard Rule #3). */
function withEnergy(energy: number, money = 0): GameState {
  const base = createTestGameState();
  return { ...base, stats: { ...base.stats, energy, money } };
}

/** Apply one updater N times to the same starting state — a batched multi-tap. */
function batch(state: GameState, taps: number, run: (p: GameState) => GameState): GameState {
  let s = state;
  for (let i = 0; i < taps; i++) s = run(s);
  return s;
}

describe('the exploit was real', () => {
  it('paid unlimited cash from a single energy bar, unguarded', () => {
    // Exactly enough energy for ONE run.
    const before = withEnergy(ENERGY_COST);
    const after = batch(before, 5, unguardedRun);
    expect(after.stats.energy).toBe(0);
    // Five payouts for one run's worth of energy.
    expect(after.stats.money).toBe(CASH_REWARD * 5);
  });
});

describe('the guard pays exactly once per energy bar', () => {
  it('runs once when there is energy for one', () => {
    const after = batch(withEnergy(ENERGY_COST), 5, guardedRun);
    expect(after.stats.money).toBe(CASH_REWARD);
    expect(after.stats.energy).toBe(0);
  });

  it('runs twice when there is energy for two', () => {
    const after = batch(withEnergy(ENERGY_COST * 2), 5, guardedRun);
    expect(after.stats.money).toBe(CASH_REWARD * 2);
    expect(after.stats.energy).toBe(0);
  });

  it('pays nothing at all on empty', () => {
    const after = batch(withEnergy(0, 123), 5, guardedRun);
    expect(after.stats.money).toBe(123);
    expect(after.stats.energy).toBe(0);
  });

  it('refuses rather than running on partial energy', () => {
    // One short is a refusal, not a discounted run.
    const after = batch(withEnergy(ENERGY_COST - 1, 0), 3, guardedRun);
    expect(after.stats.money).toBe(0);
    expect(after.stats.energy).toBe(ENERGY_COST - 1);
  });

  it('never pays more times than the energy allows, for any balance', () => {
    for (let energy = 0; energy <= ENERGY_COST * 4; energy += 7) {
      const after = batch(withEnergy(energy), 10, guardedRun);
      const runs = after.stats.money / CASH_REWARD;
      expect(runs).toBe(Math.floor(energy / ENERGY_COST));
    }
  });
});

describe('the shipped source carries the guard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const src = fs.readFileSync(
    path.join(process.cwd(), 'contexts', 'game', 'ItemActionsContext.tsx'),
    'utf8'
  );

  it('defines the check against prev, not against the ref', () => {
    expect(src).toMatch(/const canRunHack = \(prev: GameState\)/);
    expect(src).toMatch(/prev\.stats\?\.energy \?\? 0\) >= hack\.energyCost/);
  });

  it('guards BOTH the reward path and the caught path', () => {
    // The caught branch also spends energy and adds jail weeks, so leaving it
    // unguarded would just move the duplicate to the unlucky roll.
    //
    // At LEAST two, and whitespace-tolerant: an exact 2 would fail if a third
    // guarded updater were ever added, which is the change this test should be
    // encouraging rather than blocking.
    const guards = src.match(/if\s*\(\s*!canRunHack\(prev\)\s*\)\s*return\s+prev;/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it('re-checks that the hack is still owned', () => {
    // Ownership came from the same stale ref as the energy did.
    expect(src).toMatch(/prev\.hacks\?\.find\(h => h\.id === hackId\)\?\.purchased/);
  });
});
