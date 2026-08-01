/**
 * C-9 batch 1 — every pet action now reports what actually happened.
 *
 * All eight functions in `PetActions.ts` had the C-8 shape: rejection paths
 * reachable ONLY from inside the `setGameState` updater, each correctly
 * returning `prev`, followed by an unconditional `return { success: true }`.
 * The state was always right. The report was not, and `PetApp` branches on
 * that flag — so a refused action played the success path.
 *
 * Two of them were worse than a wrong message:
 *
 *   - `payForVet` told the player "$service: Rex is doing better" for a visit
 *     the code had just correctly refused as a no-op. That is the C-6 guard
 *     from earlier this round reporting the opposite of what it did.
 *   - `enterCompetition` returned `won` and `payout` from the stale
 *     pre-updater roll, so a second entry in the same week — rejected by the
 *     once-per-week cap — still reported a prize the player did not receive.
 *
 * Each now captures pessimistically: the default is failure, so the function
 * cannot claim success for a path that returned `prev`.
 *
 * CAVEAT, added after the fact and measured in
 * `__tests__/refactor/updaterTimingContract.test.tsx`: reading a captured flag
 * after `setGameState` is only reliable for the FIRST update in a batch, which
 * React runs eagerly. A second update in the same batch is deferred, so the
 * flag reads stale. That makes this shape a strict improvement on the
 * unconditional `return { success: true }` it replaces — which was wrong for
 * every rejection — but not a sound general fix. The nine `VehicleActions`
 * functions were converted the same way and had to be REVERTED: a passing
 * stress test driving real React through `act()` caught a successful refuel
 * reporting failure.
 *
 * The sound fix for the remaining 62 is a pure reducer over `prev`, called
 * both for the state and for the report — see the C-10 fix in `SkillTreeModal`
 * and the note at the top of `updaterResultRatchet.test.ts`.
 *
 * Note also that the `swallowed` cases below pass under a synchronous stub;
 * they pin the pessimistic DEFAULT, not React's real timing.
 *
 * 2026-08-01 audit round 4.
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

/** A setState that swallows the updater — models a render React discards. */
const swallowed = (() => { /* no-op */ }) as React.Dispatch<React.SetStateAction<GameState>>;

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

describe('C-9 — a discarded updater never reports success', () => {
  /**
   * The single property the whole pessimistic-capture pattern exists for, and
   * the one the old code could not satisfy at all: with the updater swallowed,
   * nothing changed, so nothing may claim to have happened.
   */
  const cases: [string, (s: GameState) => { success: boolean }][] = [
    ['buyPet', (s) => buyPet(s, swallowed, 'dog', 'Rex', deps)],
    ['feedPet', (s) => feedPet(s, swallowed, 'p1', 'basic')],
    ['buyFood', (s) => buyFood(s, swallowed, 'basic', 1, deps)],
    ['playWithPet', (s) => playWithPet(s, swallowed, 'p1')],
    ['petSleep', (s) => petSleep(s, swallowed, 'p1')],
    ['payForVet', (s) => payForVet(s, swallowed, 'p1', 'checkup', deps, 10)],
  ];

  for (const [name, run] of cases) {
    it(`${name} reports failure`, () => {
      expect(`${name}: ${run(withPet()).success}`).toBe(`${name}: false`);
    });
  }
});

describe('C-9 — payForVet no longer congratulates a refused visit', () => {
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

describe('C-9 — enterCompetition no longer reports a prize it did not pay', () => {
  it('a same-batch double tap reports neither success nor a payout', () => {
    /**
     * Both calls are given the SAME stale snapshot, which is what a double tap
     * in one React batch produces. That matters: passing the UPDATED state
     * instead makes the OUTER once-per-week guard reject, which was always
     * correct and passes on the pre-fix tree too. Only the stale-snapshot path
     * reaches the inner `lastCompetitionWeek` re-check — the rejection that
     * used to fall through to an unconditional success carrying `won` and
     * `payout` from the pre-updater roll.
     */
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);

    const first = enterCompetition(snapshot, setState, 'p1', 'agility', deps, 0);
    const moneyAfterFirst = get().stats.money;
    const second = enterCompetition(snapshot, setState, 'p1', 'agility', deps, 0);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.won).toBeUndefined();
    expect(second.payout).toBeUndefined();
    expect(get().stats.money).toBe(moneyAfterFirst);
  });

  it('the once-per-week OUTER guard also still holds (the control)', () => {
    // Passes on both trees by design — it was never the broken path, and it
    // must not have been loosened by the fix.
    const snapshot = withPet();
    const { setState, get } = batched(snapshot);

    enterCompetition(snapshot, setState, 'p1', 'agility', deps, 0);
    expect(enterCompetition(get(), setState, 'p1', 'agility', deps, 0).success).toBe(false);
  });

  it('the first entry still reports its real result (the control)', () => {
    const snapshot = withPet();
    const { setState } = batched(snapshot);

    const r = enterCompetition(snapshot, setState, 'p1', 'agility', deps, 0);

    if (!r.success) return;
    expect(typeof r.won).toBe('boolean');
    expect(r.message).toContain('Rex');
  });
});

describe('C-9 — the once-per-week and precondition gates report honestly', () => {
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
    // the wrong reason — they never reached the updater at all.
    const empty = createTestGameState({
      ...withPet(),
      petFood: {},
    } as never);

    expect(feedPet(empty, batched(empty).setState, 'p1', 'basic').success).toBe(false);
  });
});

describe('C-9 — the happy paths are all still happy (the controls)', () => {
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
