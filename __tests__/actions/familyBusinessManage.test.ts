/**
 * `manageFamilyBusiness` — the field report, and the shape that produced it.
 *
 * A player on 2.5.12 sent:
 *
 *     Need $10,000 for "marketing" — you have $1.54M.
 *
 * with $1.54M in the bank. The gate was not wrong about the money; it never ran
 * against the money. `didManage` was assigned INSIDE the `setGameState` updater
 * and read on the next line, and React defers the second functional update of a
 * batch — so the flag read `false` while the updater went on to charge the
 * $10,000 and apply the brand gain. The same report showed the balance down to
 * $214,884: roughly 133 taps, every one of them charged, every one of them
 * reported as unaffordable.
 *
 * ── Why the existing tests could not catch it ─────────────────────────────
 *
 * `createSetGameStateStub` applies updaters SYNCHRONOUSLY, which is the one
 * timing where the broken shape works. A test written against it would have
 * passed on the bug. The deferred stub below is the honest model, and the
 * resolver tests below it are the real contract — a pure function has no
 * timing to get wrong.
 */
import type { Dispatch, SetStateAction } from 'react';
import {
  manageFamilyBusiness,
  resolveManageFamilyBusiness,
} from '@/contexts/game/actions/FamilyBusinessActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { createSetGameStateStub } from '@/__tests__/helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';

const COMPANY = 'acme';

const owner = (money: number): GameState =>
  createTestGameState({
    stats: { ...createTestGameState().stats, money },
    familyBusinesses: [
      { companyId: COMPANY, foundedGeneration: 1, generationsHeld: 0, brandValue: 10, reputation: 50 },
    ],
  });

/**
 * A `setGameState` that QUEUES updaters instead of running them, modelling
 * React deferring the second functional update of a batch. Nothing an action
 * assigns inside its updater is readable when the action returns.
 */
function createDeferredStub(initial: GameState) {
  let state = initial;
  const queue: Array<(prev: GameState) => GameState> = [];
  const setGameState: Dispatch<SetStateAction<GameState>> = (action) => {
    if (typeof action === 'function') queue.push(action as (prev: GameState) => GameState);
    else state = action;
  };
  return {
    setGameState,
    /** Run the deferred updaters, as React eventually would. */
    flush: () => { while (queue.length) state = queue.shift()!(state); },
    current: () => state,
  };
}

describe('the reported bug: a successful spend reported as unaffordable', () => {
  it('reports SUCCESS even when the updater is deferred', () => {
    // THE regression. With the old capture this returned success:false and the
    // "you have $1.54M" message, while the queued updater still took the money.
    const stub = createDeferredStub(owner(1_540_000));

    const result = manageFamilyBusiness(stub.current(), stub.setGameState, COMPANY, 'marketing');

    expect(result.success).toBe(true);
    expect(result.message).not.toMatch(/Need/);
  });

  it('charges exactly once, and the charge matches the answer', () => {
    const stub = createDeferredStub(owner(1_540_000));

    const result = manageFamilyBusiness(stub.current(), stub.setGameState, COMPANY, 'marketing');
    stub.flush();

    expect(result.success).toBe(true);
    expect(stub.current().stats.money).toBe(1_540_000 - 10_000);
    expect(stub.current().familyBusinesses![0].brandValue).toBe(15);
  });

  it('never takes money on a run it reports as failed', () => {
    // The inverse of the report, and the more damaging direction: the player
    // was charged ~$1.3M across taps that all said "you cannot afford this".
    const stub = createDeferredStub(owner(500));

    const result = manageFamilyBusiness(stub.current(), stub.setGameState, COMPANY, 'marketing');
    stub.flush();

    expect(result.success).toBe(false);
    expect(stub.current().stats.money).toBe(500);
    expect(stub.current().familyBusinesses![0].brandValue).toBe(10);
  });
});

describe('the refusal still says something true', () => {
  it('names the cost, the balance and the shortfall', () => {
    const { result } = resolveManageFamilyBusiness(owner(2_500), COMPANY, 'marketing');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/\$10,000/);
    expect(result.message).toMatch(/\$2,500/);
    expect(result.message).toMatch(/short/);
  });

  it('refuses a company that is not a family business', () => {
    const { result } = resolveManageFamilyBusiness(owner(1_000_000), 'not-a-company', 'marketing');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Family business not found');
  });
});

describe('the resolver is pure', () => {
  it('never mutates the state handed in', () => {
    const state = owner(1_000_000);
    const before = JSON.stringify(state);
    resolveManageFamilyBusiness(state, COMPANY, 'branding');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('returns the SAME object on rejection, so an updater no-ops cleanly', () => {
    const state = owner(10);
    expect(resolveManageFamilyBusiness(state, COMPANY, 'branding').next).toBe(state);
  });

  it('is idempotent per call — two resolutions of the same state agree', () => {
    const state = owner(1_000_000);
    const a = resolveManageFamilyBusiness(state, COMPANY, 'reputation');
    const b = resolveManageFamilyBusiness(state, COMPANY, 'reputation');
    expect(a.next.stats.money).toBe(b.next.stats.money);
    expect(a.result).toEqual(b.result);
  });
});

describe('a double tap in one batch pays once', () => {
  it('applies the benefit only as many times as it charges', () => {
    // Synchronous stub here on purpose: it models the SAME-batch double tap,
    // where both updaters run against evolving state.
    const stub = createSetGameStateStub(owner(15_000));

    manageFamilyBusiness(stub.current(), stub.setGameState, COMPANY, 'marketing');
    manageFamilyBusiness(stub.current(), stub.setGameState, COMPANY, 'marketing');

    const brandSteps = (stub.current().familyBusinesses![0].brandValue - 10) / 5;
    const charged = (15_000 - stub.current().stats.money) / 10_000;
    expect(brandSteps).toBe(charged);
  });
});

describe('every action in the table is reachable and priced', () => {
  it.each([
    ['marketing', 10_000, 5, 0],
    ['branding', 50_000, 15, 2],
    ['reputation', 25_000, 0, 10],
  ] as const)('%s costs $%d for +%d brand / +%d reputation', (action, cost, brand, rep) => {
    const state = owner(100_000);
    const { next, result } = resolveManageFamilyBusiness(state, COMPANY, action);
    expect(result.success).toBe(true);
    expect(state.stats.money - next.stats.money).toBe(cost);
    expect(next.familyBusinesses![0].brandValue).toBe(10 + brand);
    expect(next.familyBusinesses![0].reputation).toBe(50 + rep);
  });
});
