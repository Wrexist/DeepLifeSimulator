/**
 * C-9 batch 1, REVISED 2026-08-15 — every pet action reports what actually
 * happened, without reading across the updater boundary.
 *
 * ── The original problem (still fixed) ────────────────────────────────────
 *
 * All eight functions in `PetActions.ts` had the C-8 shape: rejection paths
 * reachable ONLY from inside the `setGameState` updater, each correctly
 * returning `prev`, followed by an unconditional `return { success: true }`.
 * The state was always right. The report was not, and `PetApp` branches on
 * that flag — so a refused action played the success path. Worst of them,
 * `payForVet` told the player "$service: Rex is doing better" for a visit the
 * code had just correctly refused as a no-op.
 *
 * ── Why the first fix was withdrawn ───────────────────────────────────────
 *
 * That round fixed it with a "pessimistic capture": `let treated = false`
 * assigned inside the updater and read after. This file's own header carried
 * the caveat, and a player report on 2026-08-15 turned the caveat into an
 * incident — in `manageFamilyBusiness`, a $40.25M player was told they needed
 * $10,000 for a $10,000 action that had in fact succeeded.
 *
 * React runs only the FIRST functional update of a batch eagerly; a second is
 * DEFERRED, so the capture reads its initial `false` for an action that
 * worked. The capture cannot distinguish "the updater rejected" from "the
 * updater has not run yet", and those need opposite reports.
 *
 * ── What replaces it ──────────────────────────────────────────────────────
 *
 * The treatment `innerOnlyRejections.test.ts` prescribes and that
 * `upgradeEnergySystem` / `buildRDLab` already use: an OUTER guard, never a
 * capture. Every inner `return prev` here is mirrored by an outer check
 * against the snapshot, so the report has no timing dependency at all. The
 * inner guards stay — they are the same-batch race protection for STATE.
 *
 * `payForVet` was the one with no outer mirror, so it got a real one:
 * `vetVisitWouldHelp`, the same predicate inside and out.
 *
 * ── The property that was dropped, deliberately ───────────────────────────
 *
 * The old suite asserted "with the updater swallowed, nothing may claim to
 * have happened". That is not achievable: a swallowed updater and a deferred
 * updater are indistinguishable from outside, and the only mechanism that
 * satisfies it — the capture — misreports every deferred success, which is the
 * common case and the one that reached a player. Those cases are replaced
 * below by the timing property that IS achievable and IS the reported bug.
 */
import {
  buyPet, feedPet, buyFood, buyToy, playWithPet, petSleep, payForVet, enterCompetition,
} from '@/contexts/game/actions/PetActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const deps = { updateMoney };

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

/**
 * A setState that QUEUES the updater instead of running it — React's deferred
 * path for any update that is not first in its batch.
 *
 * This is what the old `swallowed` stub should have been modelling. The
 * difference matters: a report read after `setGameState` sees exactly this
 * state of the world, and it must not conclude "rejected" from it.
 */
function deferred(initial: GameState) {
  let state = initial;
  const queue: React.SetStateAction<GameState>[] = [];
  const setState = ((update: React.SetStateAction<GameState>) => {
    queue.push(update);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  const flush = () => {
    while (queue.length) {
      const u = queue.shift()!;
      if (typeof u !== 'function') throw new Error('non-functional updater');
      state = (u as (p: GameState) => GameState)(state);
    }
  };
  return { setState, flush, get: () => state };
}

function withPet(over: Record<string, unknown> = {}, money = 1_000_000): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money, energy: 100 },
    weeksLived: 10,
    petFood: { basic: 5 },
    pets: [{
      id: 'p1', name: 'Rex', type: 'dog', age: 3,
      hunger: 50, happiness: 50, health: 50, energy: 100,
      ...over,
    }] as never,
  });
}

describe('C-9 - a DEFERRED updater never reports failure for work that lands', () => {
  /**
   * The property that replaces the old swallowed-updater assertions, and the
   * one the 2026-08-15 player report was about. Each action is invoked with a
   * setState that has not yet run the updater — React's ordinary deferred path
   * — and must still report the truth, which the flush then confirms.
   */
  const cases: [string, (s: GameState, set: React.Dispatch<React.SetStateAction<GameState>>) => { success: boolean }][] = [
    ['buyPet', (s, set) => buyPet(s, set, 'dog', 'Bella', deps)],
    ['feedPet', (s, set) => feedPet(s, set, 'p1', 'basic')],
    ['buyFood', (s, set) => buyFood(s, set, 'basic', 1, deps)],
    ['playWithPet', (s, set) => playWithPet(s, set, 'p1')],
    ['petSleep', (s, set) => petSleep(s, set, 'p1')],
    ['payForVet', (s, set) => payForVet(s, set, 'p1', 'checkup', deps, 10)],
  ];

  for (const [name, run] of cases) {
    it(`${name} reports success while the updater is still queued`, () => {
      const snapshot = withPet();
      const d = deferred(snapshot);

      const r = run(snapshot, d.setState);

      expect(`${name}: ${r.success}`).toBe(`${name}: true`);

      // And it was telling the truth - flushing really does change the state.
      const before = JSON.stringify(d.get());
      d.flush();
      expect(`${name} changed state: ${JSON.stringify(d.get()) !== before}`)
        .toBe(`${name} changed state: true`);
    });
  }

  it('and each still refuses, on the snapshot, when it genuinely cannot act', () => {
    // The other half: the outer guards are what report now, so they have to be
    // real. A broke player and a sick-free pet are both refused with no updater
    // dispatched at all.
    const broke = withPet({}, 0);
    const d1 = deferred(broke);
    expect(buyPet(broke, d1.setState, 'dog', 'Bella', deps).success).toBe(false);

    const healthy = withPet({ health: 100, happiness: 100, vaccinated: true });
    const d2 = deferred(healthy);
    expect(payForVet(healthy, d2.setState, 'p1', 'checkup', deps, 10).success).toBe(false);
  });
});

describe('C-9 - payForVet no longer congratulates a refused visit', () => {
  it('a healthy pet is refused AND told so', () => {
    // The C-6 guard already declined to charge. It just said the opposite.
    const snapshot = withPet({ health: 100, happiness: 100, vaccinated: true });
    const { setState, get } = batched(snapshot);

    const r = payForVet(snapshot, setState, 'p1', 'checkup', deps, 10);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/does not need/i);
    expect(get().stats.money).toBe(1_000_000);
  });

  it('a visit that helps still succeeds and still charges (the control)', () => {
    const snapshot = withPet({ health: 40 });
    const { setState, get } = batched(snapshot);

    const r = payForVet(snapshot, setState, 'p1', 'checkup', deps, 10);

    expect(r.success).toBe(true);
    expect(get().stats.money).toBeLessThan(1_000_000);
    expect(get().pets?.[0].health).toBeGreaterThan(40);
  });
});

describe('C-9 - enterCompetition pays once, whatever it reports', () => {
  it('a same-batch double tap enters ONCE and is charged/paid ONCE', () => {
    /**
     * Both calls are given the SAME stale snapshot, which is what a double tap
     * in one React batch produces. The inner `lastCompetitionWeek` re-check is
     * the only thing that can see the first entry, so it is what must hold.
     *
     * ── What changed here, and the trade being made ─────────────────────────
     *
     * This used to also assert `second.success === false` with no `won` /
     * `payout`, satisfied by a `let entered` capture read after the updater.
     * That capture is what the 2026-08-15 player report was about: it cannot
     * tell "the updater rejected" from "the updater has not run yet", and the
     * second reading is far more common - every update that is not first in
     * its React batch. A legitimate FIRST entry was being reported as "already
     * competed this week".
     *
     * With the capture gone, the report comes from the outer once-per-week
     * guard, which reads the stale snapshot and therefore passes twice. So a
     * stale double tap now reports its result twice. The MONEY is unaffected -
     * asserted below - and the prize really was paid, once. A duplicated
     * message on a rare double tap is a strictly better failure than a false
     * refusal on the common path.
     */
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);

    const first = enterCompetition(snapshot, setState, 'p1', 'agility', 0);
    const moneyAfterFirst = get().stats.money;
    const second = enterCompetition(snapshot, setState, 'p1', 'agility', 0);

    expect(first.success).toBe(true);
    // The state is the thing that has to be right, and it is: the second entry
    // was rejected inside the updater, so no second fee and no second prize.
    expect(get().stats.money).toBe(moneyAfterFirst);
    expect(get().pets?.[0].lastCompetitionWeek).toBe(10);
    // Documenting the accepted trade rather than leaving it unstated.
    expect(second.success).toBe(true);
  });

  it('the once-per-week OUTER guard also still holds (the control)', () => {
    // Passes on both trees by design - it was never the broken path, and it
    // must not have been loosened by the fix.
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);

    enterCompetition(snapshot, setState, 'p1', 'agility', 0);
    expect(enterCompetition(get(), setState, 'p1', 'agility', 0).success).toBe(false);
  });

  it('the first entry still reports its real result (the control)', () => {
    const snapshot = withPet();
    const { setState } = batched(snapshot);

    const r = enterCompetition(snapshot, setState, 'p1', 'agility', 0);

    if (!r.success) return;
    expect(typeof r.won).toBe('boolean');
    expect(r.message).toContain('Rex');
  });
});

describe('C-9 - the once-per-week and precondition gates report honestly', () => {
  it('a second sleep in the same week is refused, not celebrated', () => {
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);

    const first = petSleep(snapshot, setState, 'p1');
    const second = petSleep(get(), setState, 'p1');

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already slept/i);
  });

  it('a tired pet refuses to play, and says so', () => {
    const snapshot = withPet({ energy: 5 });
    const { setState } = batched(snapshot);

    expect(playWithPet(snapshot, setState, 'p1').success).toBe(false);
  });

  it('a normal play still succeeds (the control)', () => {
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);

    const r = playWithPet(snapshot, setState, 'p1');

    expect(r.success).toBe(true);
    expect(get().pets?.[0].happiness).toBeGreaterThan(50);
  });

  it('feeding with an empty bag is refused (the control on the inventory gate)', () => {
    // A REAL food id with an empty bag, so this exercises the inventory gate
    // rather than the unknown-food early return. The first version of this file
    // used an invented id throughout, which made several assertions pass for
    // the wrong reason - they never reached the updater at all.
    const empty = createTestGameState({
      ...withPet(),
      petFood: {},
    } as never);

    expect(feedPet(empty, batched(empty).setState, 'p1', 'basic').success).toBe(false);
  });
});

describe('C-9 - the happy paths are all still happy (the controls)', () => {
  it('buying a pet, food and a toy all still work', () => {
    const snapshot = withPet();
    const b = batched(snapshot);

    expect(buyPet(snapshot, b.setState, 'dog', 'Bella', deps).success).toBe(true);
    expect(buyFood(b.get(), b.setState, 'basic', 2, deps).success).toBe(true);
    expect(buyToy(b.get(), b.setState, 'p1', 'ball', deps).success).toBe(true);
    expect(feedPet(b.get(), b.setState, 'p1', 'basic').success).toBe(true);
  });

  it('but a toy already owned is refused, not re-sold', () => {
    const snapshot = withPet();
    const b = batched(snapshot);

    expect(buyToy(snapshot, b.setState, 'p1', 'ball', deps).success).toBe(true);
    const afterFirst = b.get().stats.money;
    const second = buyToy(b.get(), b.setState, 'p1', 'ball', deps);

    expect(second.success).toBe(false);
    expect(b.get().stats.money).toBe(afterFirst);
  });

  it('and none of them reports success without changing state', () => {
    // The inverse of the swallowed-updater test: whenever one of these reports
    // success, the state must actually differ.
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);
    const before = JSON.stringify(get().pets) + get().stats.money;

    const r = playWithPet(snapshot, setState, 'p1');

    expect(r.success).toBe(true);
    expect(JSON.stringify(get().pets) + get().stats.money).not.toBe(before);
  });
});
