/**
 * WP-A — `buyMiner` / `buyWarehouse` reported "Unknown error" for purchases
 * that had committed.
 *
 * Both were written as the pessimistic capture C-8 was withdrawn for:
 *
 *     let result = { success: false, message: 'Unknown error' };
 *     setGameState(prev => { …; result = { success: true, … }; return next; });
 *     return result;
 *
 * React runs only the FIRST functional update of a batch eagerly; a second is
 * DEFERRED, so the capture still held its initialiser when it was read. The
 * player was charged, got the miner, and was shown "Purchase Failed — Unknown
 * error" (`BitcoinMiningApp` branches on the flag). That is the same report a
 * player filed against `manageFamilyBusiness` on 2026-08-15.
 *
 * Both are now pure reducers (`resolveBuyMiner` / `resolveBuyWarehouse`) called
 * twice — against the caller's snapshot for the OUTCOME, against `prev` for the
 * STATE — matching the `resolveBuyCompanyUpgrade` fix. Nothing crosses the
 * updater boundary, and every gate is still re-validated inside it.
 */
import React from 'react';
import {
  buyMiner,
  buyWarehouse,
  resolveBuyMiner,
  resolveBuyWarehouse,
} from '@/contexts/game/company';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** The dispatch simulation from `companyUpgradeResult.test.ts`. */
function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

/**
 * A dispatch that DEFERS every updater, the way React does for any functional
 * update that is not first in its batch. `flush()` applies them afterwards —
 * i.e. strictly after the action has already returned its result. Under the old
 * capture shape the returned message was the initialiser; under a pure resolver
 * it cannot be.
 */
function deferred(initial: GameState) {
  let state = initial;
  const pending: ((s: GameState) => GameState)[] = [];
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    pending.push(update as (s: GameState) => GameState);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return {
    setState,
    flush: () => { while (pending.length) state = pending.shift()!(state); },
    get: () => state,
  };
}

const MINER = { id: 'basic', name: 'Basic Miner', cost: 500 };

function withWarehouse(money: number, level = 1, miners: Record<string, number> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    warehouse: { level, miners, minerDurability: {} },
  } as never);
}

function noWarehouse(money: number): GameState {
  const base = createTestGameState();
  const state = createTestGameState({ stats: { ...base.stats, money } });
  return { ...state, warehouse: undefined };
}

describe('buyMiner — the outcome survives a deferred updater', () => {
  it('reports the purchase it actually made, even when the updater runs later', () => {
    const snapshot = withWarehouse(10_000);
    const { setState, flush, get } = deferred(snapshot);

    const result = buyMiner(snapshot, setState, MINER.id, MINER.name, MINER.cost);

    // Reported BEFORE the updater has run — this is the line that used to say
    // "Unknown error".
    expect(result.success).toBe(true);
    expect(result.message).toBe('Successfully purchased Basic Miner!');

    flush();
    expect(get().warehouse?.miners[MINER.id]).toBe(1);
    expect(get().stats.money).toBe(9_500);
  });

  it('a real refusal still reports the real reason', () => {
    const snapshot = withWarehouse(100);
    const { setState, flush, get } = deferred(snapshot);

    const result = buyMiner(snapshot, setState, MINER.id, MINER.name, MINER.cost);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Not enough money');
    flush();
    expect(get().warehouse?.miners[MINER.id]).toBeUndefined();
    expect(get().stats.money).toBe(100);
  });

  it('with no warehouse, nothing is bought and the message says why', () => {
    const snapshot = noWarehouse(10_000);
    const { setState, flush, get } = deferred(snapshot);

    const result = buyMiner(snapshot, setState, MINER.id, MINER.name, MINER.cost);

    expect(result).toEqual({ success: false, message: 'You need a warehouse to buy miners' });
    flush();
    expect(get().stats.money).toBe(10_000);
  });

  it('a full warehouse is refused', () => {
    // Capacity at level 1 is 10.
    const snapshot = withWarehouse(10_000, 1, { basic: 10 });

    const result = resolveBuyMiner(snapshot, MINER.id, MINER.name, MINER.cost);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Warehouse is full/);
    expect(result.state).toBe(snapshot);
  });
});

describe('buyMiner — the gate still lives inside the updater', () => {
  it('a double tap in ONE batch buys one miner and charges once', () => {
    // Money is the gate that has to hold: only one purchase is affordable.
    const snapshot = withWarehouse(600);
    const { setState, get } = batched(snapshot);

    buyMiner(snapshot, setState, MINER.id, MINER.name, MINER.cost);
    buyMiner(snapshot, setState, MINER.id, MINER.name, MINER.cost);

    expect(get().warehouse?.miners[MINER.id]).toBe(1);
    expect(get().stats.money).toBe(100);
  });

  it('never stores a negative balance (the money goes through the central clamp)', () => {
    const snapshot = withWarehouse(600);
    const { setState, get } = batched(snapshot);

    for (let i = 0; i < 5; i++) {
      buyMiner(snapshot, setState, MINER.id, MINER.name, MINER.cost);
    }

    expect(get().stats.money).toBeGreaterThanOrEqual(0);
    expect(get().warehouse?.miners[MINER.id]).toBe(1);
  });
});

describe('buyWarehouse — same shape, same fix', () => {
  it('reports success for a purchase whose updater is deferred', () => {
    const snapshot = noWarehouse(5_000_000);
    const { setState, flush, get } = deferred(snapshot);

    const result = buyWarehouse(snapshot, setState);

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Warehouse purchased successfully/);

    flush();
    expect(get().warehouse?.level).toBe(1);
    expect(get().stats.money).toBeLessThan(5_000_000);
  });

  it('an unaffordable warehouse quotes the price rather than "Unknown error"', () => {
    const snapshot = noWarehouse(10);
    const { setState } = deferred(snapshot);

    const result = buyWarehouse(snapshot, setState);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Not enough money\. Warehouse costs \$/);
  });

  it('a second tap in the same batch does not buy a second warehouse', () => {
    const snapshot = noWarehouse(5_000_000);
    const { setState, get } = batched(snapshot);

    buyWarehouse(snapshot, setState);
    const spentOnce = get().stats.money;
    buyWarehouse(snapshot, setState);

    expect(get().stats.money).toBe(spentOnce);
    expect(get().warehouse?.level).toBe(1);
  });

  it('the resolver refuses an existing warehouse untouched', () => {
    const snapshot = withWarehouse(5_000_000);

    const result = resolveBuyWarehouse(snapshot);

    expect(result.success).toBe(false);
    expect(result.message).toBe('You already have a warehouse');
    expect(result.state).toBe(snapshot);
  });
});
