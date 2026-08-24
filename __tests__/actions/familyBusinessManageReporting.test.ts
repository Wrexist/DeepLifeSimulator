/**
 * Player report, 2026-08-15 — a $40.25M player told they need $10,000.
 *
 *   Need $10,000 for "marketing" — you have $40.25M.
 *
 * Surfaced as an in-game error banner (`CompanyActionsContext` calls
 * `showError` on any `success: false`), from a save with 40,096,831 cash.
 *
 * ── Why it happened ───────────────────────────────────────────────────────
 *
 * `manageFamilyBusiness` set `didManage = true` INSIDE its `setGameState`
 * updater and read the flag straight after the call. React runs only the FIRST
 * functional update of a batch eagerly; a second one is DEFERRED, so the flag
 * was still `false` at the read even though the updater went on to charge the
 * $10,000 and grant the +5 brand correctly. The tail then reported failure with
 * the shortfall-less spelling of the affordability message — which is why the
 * banner said "you have $40.25M" and named no shortfall at all.
 *
 * That is exactly the class `__tests__/refactor/updaterTimingContract.test.tsx`
 * measures and CLAUDE.md §4.1 forbids. The state was never wrong; the report
 * was. The knock-on cost was real though: the caller only calls `saveGame()` on
 * success, so a successful manage went unsaved and played the error haptic.
 *
 * ── Why the existing tests missed it ──────────────────────────────────────
 *
 * Every action suite drives `setGameState` with `createSetGameStateStub`, which
 * invokes the updater synchronously. Under that stub the capture is ALWAYS
 * readable, so `exploitFixes.test.ts` saw `success: true` and passed. This file
 * adds a DEFERRED stub — updaters queue, and flush only after the action has
 * returned — which is the production path for any update that is not first in
 * its batch.
 */
import React, { useState } from 'react';
// A typed STATIC import, deliberately — `updaterTimingContract.test.tsx` reaches
// for `require` with a comment saying react-test-renderer "ships no types", but
// `@types/react-test-renderer` is in fact installed, so that is stale. A static
// import type-checks clean and avoids spending the `no-require-imports` budget
// in `scripts/lib/lintRatchet.js`, which is currently at its ceiling.
import TestRenderer, { act } from 'react-test-renderer';
import {
  manageFamilyBusiness,
  resolveFamilyBusinessManage,
} from '@/contexts/game/actions/FamilyBusinessActions';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import type { Dispatch, SetStateAction } from 'react';

/**
 * A `setGameState` that QUEUES updaters instead of running them.
 *
 * Models React's deferred path: the updater has not run when `setGameState`
 * returns, so anything an action assigns inside it is still at its initial
 * value when the action reads it. `flush()` applies the queue in order, which is
 * what React does at render time.
 */
function makeDeferredSetState(initial: GameState) {
  let state = initial;
  const queue: SetStateAction<GameState>[] = [];

  const setGameState: Dispatch<SetStateAction<GameState>> = (action) => {
    queue.push(action);
  };
  const flush = () => {
    while (queue.length) {
      const action = queue.shift()!;
      state = typeof action === 'function'
        ? (action as (prev: GameState) => GameState)(state)
        : action;
    }
  };

  return { setGameState, flush, current: () => state, pending: () => queue.length };
}

/** The reporting player: a family business, and far more cash than any action costs. */
function richOwner(money = 40_096_831): GameState {
  return createTestGameState({
    stats: { money } as never,
    companies: [{ id: 'co1', name: 'Acme' }] as never,
    familyBusinesses: [
      { companyId: 'co1', foundedGeneration: 1, generationsHeld: 0, brandValue: 0, reputation: 50 },
    ] as never,
    generationNumber: 1,
  });
}

const businessOf = (s: GameState) => s.familyBusinesses?.find((fb) => fb.companyId === 'co1');

describe('manageFamilyBusiness reports the outcome it actually produced', () => {
  it('a $40M player is NOT told they need $10,000 when the updater is deferred', () => {
    // The reported bug, reproduced. Pre-fix this returned
    // `success: false` with `Need $10,000 for "marketing" — you have $40.25M.`
    const { setGameState, flush, pending } = makeDeferredSetState(richOwner());

    const r = manageFamilyBusiness(richOwner(), setGameState, 'co1', 'marketing');

    // The updater genuinely has not run yet — this is the production timing.
    expect(pending()).toBe(1);
    expect(r.success).toBe(true);
    expect(r.message).not.toMatch(/Need \$/);

    flush();
  });

  it('and the state it reports matches the state it produced', () => {
    const state = richOwner();
    const { setGameState, flush, current } = makeDeferredSetState(state);

    const r = manageFamilyBusiness(state, setGameState, 'co1', 'marketing');
    flush();

    expect(r.success).toBe(true);
    expect(current().stats.money).toBe(40_096_831 - 10_000);
    expect(businessOf(current())?.brandValue).toBe(5);
  });

  it('every action reports success under deferred timing when affordable', () => {
    const cases: [Parameters<typeof manageFamilyBusiness>[3], number, number, number][] = [
      ['marketing', 10_000, 5, 0],
      ['reputation', 25_000, 0, 10],
      ['branding', 50_000, 15, 2],
    ];

    for (const [action, cost, brandGain, reputationGain] of cases) {
      const state = richOwner();
      const { setGameState, flush, current } = makeDeferredSetState(state);

      const r = manageFamilyBusiness(state, setGameState, 'co1', action);
      flush();

      expect(`${action}: ${r.success}`).toBe(`${action}: true`);
      expect(`${action} cash: ${current().stats.money}`).toBe(`${action} cash: ${40_096_831 - cost}`);
      expect(businessOf(current())?.brandValue).toBe(brandGain);
      expect(businessOf(current())?.reputation).toBe(50 + reputationGain);
    }
  });

  it('the synchronous (eager) path still reports success too', () => {
    // The path that already worked - pinned so the fix is not a swap of which
    // timing is broken.
    const state = richOwner();
    const stub = createSetGameStateStub(state);

    const r = manageFamilyBusiness(state, stub.setGameState, 'co1', 'branding');

    expect(r.success).toBe(true);
    expect(stub.current().stats.money).toBe(40_096_831 - 50_000);
    expect(businessOf(stub.current())?.brandValue).toBe(15);
  });
});

describe('manageFamilyBusiness under REAL React batching', () => {
  /**
   * The deferred stub above models React; this drives the real thing, through
   * the same renderer the stress suites use. It is the closest a Node test gets
   * to the reporting player's tap, and it is what actually reproduced the
   * banner: pre-fix this assertion failed with
   *
   *   false :: Need $10,000 for "marketing" - you have $40.1M.
   *
   * character-for-character the shape of the report.
   */
  let setter: Dispatch<SetStateAction<GameState>>;
  let bump: Dispatch<SetStateAction<number>>;
  let observed: GameState;

  function Probe() {
    const [s, setS] = useState(richOwner());
    const [, setN] = useState(0);
    setter = setS;
    bump = setN;
    observed = s;
    return null;
  }

  it('reports success for an affordable push that is NOT first in its batch', () => {
    act(() => { TestRenderer.create(React.createElement(Probe)); });

    let r: { success: boolean; message: string } | undefined;
    act(() => {
      // Burn the eager slot. React runs only the FIRST functional update of a
      // batch at call time; anything after it is deferred - which is the
      // ordinary case in a handler that touches more than one piece of state.
      bump((n) => n + 1);
      r = manageFamilyBusiness(observed, setter, 'co1', 'marketing');
    });

    expect(`${r!.success} :: ${r!.message}`).toBe('true :: marketing completed successfully');
    expect(observed.stats.money).toBe(40_096_831 - 10_000);
    expect(observed.familyBusinesses?.[0].brandValue).toBe(5);
  });
});

describe('manageFamilyBusiness still rejects what it should', () => {
  it('unaffordable → failure, no charge, and the message names the shortfall', () => {
    const state = createTestGameState({
      stats: { money: 10_000 } as never,
      companies: [{ id: 'co1', name: 'Acme' }] as never,
      familyBusinesses: [
        { companyId: 'co1', foundedGeneration: 1, generationsHeld: 0, brandValue: 0, reputation: 50 },
      ] as never,
      generationNumber: 1,
    });
    const { setGameState, flush, current, pending } = makeDeferredSetState(state);

    const r = manageFamilyBusiness(state, setGameState, 'co1', 'reputation'); // $25k
    flush();

    expect(r.success).toBe(false);
    expect(r.message).toContain('short');
    // Rejected before the updater is even queued - nothing to flush.
    expect(pending()).toBe(0);
    expect(current().stats.money).toBe(10_000);
    expect(businessOf(current())?.reputation).toBe(50);
  });

  it('a missing family business reports that, not a money problem', () => {
    // Pre-fix, a business that vanished between snapshot and commit fell through
    // to the `!didManage` tail and was reported as "Need $10,000 …".
    const state = createTestGameState({
      stats: { money: 40_096_831 } as never,
      companies: [{ id: 'co1', name: 'Acme' }] as never,
      familyBusinesses: [] as never,
      generationNumber: 1,
    });
    const { setGameState } = makeDeferredSetState(state);

    const r = manageFamilyBusiness(state, setGameState, 'co1', 'marketing');

    expect(r.success).toBe(false);
    expect(r.message).toBe('Family business not found');
  });

  it('a same-batch double-tap charges once and grants once', () => {
    // The atomicity the previous fix bought must survive this one. Fund exactly
    // ONE marketing push, then tap twice off the same stale snapshot.
    const snapshot = createTestGameState({
      stats: { money: 10_000 } as never,
      companies: [{ id: 'co1', name: 'Acme' }] as never,
      familyBusinesses: [
        { companyId: 'co1', foundedGeneration: 1, generationsHeld: 0, brandValue: 0, reputation: 50 },
      ] as never,
      generationNumber: 1,
    });
    const { setGameState, flush, current } = makeDeferredSetState(snapshot);

    manageFamilyBusiness(snapshot, setGameState, 'co1', 'marketing');
    manageFamilyBusiness(snapshot, setGameState, 'co1', 'marketing');
    flush();

    expect(current().stats.money).toBe(0); // charged once
    expect(businessOf(current())?.brandValue).toBe(5); // granted once, not +10
  });
});

describe('resolveFamilyBusinessManage is a pure function of the state it is given', () => {
  it('does not mutate the state passed in', () => {
    const state = richOwner();
    const before = JSON.stringify(state);

    resolveFamilyBusinessManage(state, 'co1', 'branding');

    expect(JSON.stringify(state)).toBe(before);
  });

  it('called twice on the same state gives the same answer (the updater may re-run)', () => {
    // React can invoke an updater more than once for one dispatch (eager compute
    // plus render, StrictMode double-invoke). The commit must be idempotent in
    // `prev` or a single tap could charge twice.
    const state = richOwner();

    const a = resolveFamilyBusinessManage(state, 'co1', 'marketing');
    const b = resolveFamilyBusinessManage(state, 'co1', 'marketing');

    expect(a.ok).toBe(true);
    expect(JSON.stringify(a.next)).toBe(JSON.stringify(b.next));
  });

  it('rejects an action outside the union instead of charging $0 for it', () => {
    // The old `switch` initialised `cost = 0` and had no default, so an unknown
    // action fell through every case and ran free.
    const state = richOwner();

    const r = resolveFamilyBusinessManage(
      state,
      'co1',
      'expansion' as unknown as Parameters<typeof resolveFamilyBusinessManage>[2],
    );

    expect(r.ok).toBe(false);
    expect(r.message).toContain('Unknown family business action');
  });

  it('a corrupted (NaN) balance is unaffordable rather than silently passing', () => {
    const state = createTestGameState({
      stats: { money: NaN } as never,
      companies: [{ id: 'co1', name: 'Acme' }] as never,
      familyBusinesses: [
        { companyId: 'co1', foundedGeneration: 1, generationsHeld: 0, brandValue: 0, reputation: 50 },
      ] as never,
      generationNumber: 1,
    });

    const r = resolveFamilyBusinessManage(state, 'co1', 'marketing');

    expect(r.ok).toBe(false);
    expect(r.message).not.toContain('NaN');
  });
});
