/**
 * Warehouse upgrades must be charged against fresh state.
 *
 * ── The three bugs this closes ────────────────────────────────────────────
 * `upgradeWarehouse` validated everything against the caller's snapshot and
 * then applied the change with no second look:
 *
 *     if (gameState.warehouse.level >= maxLevel) return …
 *     if (currentMoney < cost) return …
 *     setGameState(prev => ({ ...prev,
 *       warehouse: { ...prev.warehouse, level: prev.warehouse.level + 1 },
 *       stats: { ...prev.stats, money: prev.stats.money - cost } }))
 *
 * Two taps in one React batch see identical state, so both pass, and then:
 *
 *   1. the level rises TWICE — straight past the max-10 ceiling;
 *   2. the second upgrade is billed at the STALE level's cheaper price
 *      (cost scales with level, and both taps computed it from the old one);
 *   3. `money` is written by hand with no clamp, so an overdraw stores a
 *      NEGATIVE balance instead of being refused.
 *
 * (3) is the reverse of the gym exploit next door, where clamping FORGAVE the
 * debt and paid out for free. Both come from the same root: the only check
 * lived outside the updater.
 *
 * `buyWarehouse`, `buyMiner` and `sellMiner` in the same file all validate
 * inside their updater — this one was the outlier, which is why the fix makes
 * it look like its siblings rather than inventing a new shape.
 */

import { upgradeWarehouse } from '@/contexts/game/company';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * Drive the reducer the way React does under contention: collect the updaters
 * and apply them in sequence to the SAME starting state, which is what a
 * batched double-tap produces.
 */
function runBatched(state: GameState, taps: number): GameState {
  const updaters: ((p: GameState) => GameState)[] = [];
  const collect = (u: unknown) => {
    if (typeof u === 'function') updaters.push(u as (p: GameState) => GameState);
  };
  // Every tap is handed the SAME snapshot — that is the whole point.
  for (let i = 0; i < taps; i++) upgradeWarehouse(state, collect as never);
  return updaters.reduce((acc, u) => u(acc), state);
}

/**
 * Built from the factory and narrowed by spreading, with NO `as GameState`.
 * Hard Rule #3 bans that assertion in tests for a reason worth restating: it
 * silences exactly the error that tells you a field has moved or been renamed,
 * so a suite full of them keeps passing against a shape that no longer exists.
 */
function withWarehouse(level: number, money: number): GameState {
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, money },
    warehouse: { level, miners: {}, minerDurability: {} },
  };
}

describe('a single upgrade still works', () => {
  it('raises the level once and charges once', () => {
    const before = withWarehouse(1, 1_000_000);
    const after = runBatched(before, 1);
    expect(after.warehouse?.level).toBe(2);
    expect(after.stats.money).toBeLessThan(before.stats.money);
  });

  it('refuses when the player cannot afford it, changing nothing', () => {
    const before = withWarehouse(1, 0);
    const after = runBatched(before, 1);
    expect(after.warehouse?.level).toBe(1);
    expect(after.stats.money).toBe(0);
  });
});

describe('a batched double-tap cannot double-upgrade', () => {
  it('applies only ONE level per genuine payment', () => {
    // Enough for exactly one upgrade at level 1, nowhere near two.
    const before = withWarehouse(1, 30_000);
    const after = runBatched(before, 2);
    expect(after.warehouse?.level).toBe(2);
  });

  it('never leaves a NEGATIVE balance', () => {
    // The specific corruption: hand-written `money - cost` with no clamp and
    // no refusal. A negative balance poisons every display and comparison.
    for (const money of [0, 1, 25_000, 30_000, 49_999]) {
      const after = runBatched(withWarehouse(1, money), 3);
      expect(after.stats.money).toBeGreaterThanOrEqual(0);
    }
  });

  it('bills the second upgrade at the level it is actually buying', () => {
    // Cost scales with level. Both taps used to compute it from the STALE
    // level, so the second one bought a level-2 upgrade at level-1 prices.
    const rich = withWarehouse(1, 10_000_000);
    const once = runBatched(rich, 1);
    const twice = runBatched(rich, 2);
    const firstCharge = rich.stats.money - once.stats.money;
    const secondCharge = once.stats.money - twice.stats.money;
    expect(twice.warehouse?.level).toBe(3);
    expect(secondCharge).toBeGreaterThan(firstCharge);
  });
});

describe('the reported outcome matches what actually happened', () => {
  /**
   * Call `upgradeWarehouse` with a snapshot that PASSES its outer checks while
   * the committed state the updater sees does not — exactly the divergence a
   * batched second tap produces — and return what the function claimed.
   */
  function outcomeWhenCommittedStateIs(committed: GameState, snapshot: GameState) {
    return upgradeWarehouse(snapshot, ((u: unknown) => {
      if (typeof u === 'function') (u as (p: GameState) => GameState)(committed);
    }) as never);
  }

  it('reports success, and the real level, when the upgrade lands', () => {
    const state = withWarehouse(1, 1_000_000);
    const res = outcomeWhenCommittedStateIs(state, state);
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/level 2\b/);
  });

  it('does NOT claim success when the updater refused for lack of funds', () => {
    // THE BUG THIS EXISTS FOR. The message used to be built from the caller's
    // snapshot after the updater ran, so a rejected tap still answered
    // "Warehouse upgraded to level 2!" — naming a level never reached and a
    // charge never made. Fixing the state without fixing the message would just
    // move the lie.
    const res = outcomeWhenCommittedStateIs(withWarehouse(1, 0), withWarehouse(1, 1_000_000));
    expect(res.success).toBe(false);
    expect(res.message).not.toMatch(/upgraded to level/i);
  });

  it('does NOT claim success when the updater refused at the ceiling', () => {
    const res = outcomeWhenCommittedStateIs(withWarehouse(10, 1_000_000), withWarehouse(1, 1_000_000));
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/maximum level/i);
  });

  it('fails CLOSED when the updater never runs', () => {
    // React only evaluates an updater eagerly when the fiber has no pending
    // lanes (CLAUDE.md §4.1), so under contention the result may still hold its
    // initial value. That value must be a refusal: "said no when it meant yes"
    // is recoverable — the player taps again — whereas the other direction
    // tells someone they bought something they did not.
    const res = upgradeWarehouse(withWarehouse(1, 1_000_000), (() => {}) as never);
    expect(res.success).toBe(false);
  });
});

describe('the level ceiling holds under contention', () => {
  it('does not step past max level when already there', () => {
    const after = runBatched(withWarehouse(10, 10_000_000), 3);
    expect(after.warehouse?.level).toBe(10);
  });

  it('does not overshoot the ceiling from just below it', () => {
    // The stale check said "level 9 < 10, allowed" for every tap in the batch.
    //
    // Asserted as an EXACT 10, not `<= 10`: the loose form also passes if no
    // upgrade applies at all and the level sits at 9, which would hide the
    // guard over-rejecting. One tap must land, and only one.
    const after = runBatched(withWarehouse(9, 10_000_000), 4);
    expect(after.warehouse?.level).toBe(10);
  });
});
