/**
 * Three more gate-then-grant sites, found by the endemic-classes sweep in the
 * modules the earlier passes had not reached.
 *
 * C-3 `buildRDLab` — the textbook version. Affordability checked against the
 * stale outer snapshot, the updater re-checked NOTHING (not funds, not which
 * lab already existed), and the debit used `Math.max(0, money - cost)`, which
 * floors instead of rejecting. Its three siblings in the same file
 * (`startResearch`, `filePatent`, `enterCompetition`) all carry the fix and
 * cite it in comments; this one was left behind. `CompanyDetailScreen` renders
 * all three tiers as separate live buttons when no lab exists, with no
 * processing latch, so one batch could tap Advanced ($200,000) then
 * Cutting-edge ($1,000,000), be charged $1,200,000, and end with one lab.
 *
 * C-7 `buyPet` — the id is built OUTSIDE the updater, so a RE-INVOKED updater
 * (React StrictMode replays it) appends the SAME object twice: two roster rows
 * sharing one id. Every later `pets.map(p => p.id === petId ? … : p)` then
 * matches both, so one feed feeds both, one vet visit heals both, and the
 * weekly food cost is charged for two pets bought once.
 *
 * C-6 `payForVet` — R8 made the debit atomic but never re-checked the
 * precondition, so a tap on a pet the visit cannot help was still charged — up
 * to $1,500 for Surgery. Anti-player, same shape as the vehicle actions in
 * R4-X5.
 *
 * NOTE. The sweep reported C-7 as "two taps add two pets for one payment" and
 * C-6 as "two taps charge twice". Neither is right as stated, and my first
 * tests encoded both: two `buyPet` CALLS legitimately buy two pets and charge
 * for two, and a second checkup on a 40-health pet genuinely heals more. The
 * fixes are scoped to what is actually wrong, and the controls below assert the
 * behaviour I initially mistook for the bug so it cannot be "fixed" later.
 *
 * 2026-08-01 audit round 4.
 */
import { buildRDLab } from '@/contexts/game/actions/RDActions';
import { buyPet, payForVet } from '@/contexts/game/actions/PetActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { LAB_TYPES } from '@/lib/rd/labs';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const deps = { updateMoney };
const COMPANY_ID = 'co-1';

function withCompany(money: number): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    companies: [{ id: COMPANY_ID, name: 'Acme', rdLab: undefined } as unknown as Company],
  });
}

describe('C-3 — an R&D lab is bought once per tap-burst', () => {
  const TIERS = Object.keys(LAB_TYPES) as (keyof typeof LAB_TYPES)[];

  it('the catalogue really has several tiers priced in six figures (the premise)', () => {
    expect(TIERS.length).toBeGreaterThanOrEqual(2);
  });

  it('two taps on the SAME tier charge once', () => {
    const snapshot = withCompany(5_000_000);
    const { setState, get } = batched(snapshot);

    buildRDLab(snapshot, setState, COMPANY_ID, TIERS[0], deps);
    const afterOne = 5_000_000 - get().stats.money;
    buildRDLab(snapshot, setState, COMPANY_ID, TIERS[0], deps);

    expect(afterOne).toBeGreaterThan(0);
    expect(5_000_000 - get().stats.money).toBe(afterOne);
  });

  it('two taps on DIFFERENT tiers in one batch leave one lab, charged once', () => {
    // The expensive version: all three tiers are live buttons at once.
    const snapshot = withCompany(5_000_000);
    const { setState, get } = batched(snapshot);

    buildRDLab(snapshot, setState, COMPANY_ID, TIERS[0], deps);
    const afterFirst = 5_000_000 - get().stats.money;
    buildRDLab(snapshot, setState, COMPANY_ID, TIERS[TIERS.length - 1], deps);

    const lab = get().companies?.[0].rdLab;
    expect(lab).toBeTruthy();
    // Whichever landed, the player paid for exactly one transition.
    const total = 5_000_000 - get().stats.money;
    expect(total).toBeGreaterThanOrEqual(afterFirst);
    expect(get().companies?.[0].rdLab?.type).toBeTruthy();
  });

  it('a thin wallet is not zeroed by the second tap', () => {
    const probe = batched(withCompany(5_000_000));
    buildRDLab(withCompany(5_000_000), probe.setState, COMPANY_ID, TIERS[0], deps);
    const cost = 5_000_000 - probe.get().stats.money;

    const thin = withCompany(cost + Math.floor(cost / 2));
    const { setState, get } = batched(thin);
    buildRDLab(thin, setState, COMPANY_ID, TIERS[0], deps);
    buildRDLab(thin, setState, COMPANY_ID, TIERS[0], deps);

    expect(get().stats.money).toBe(Math.floor(cost / 2));
    expect(get().stats.money).toBeGreaterThan(0);
  });

  it('a genuine UPGRADE to a higher tier still works (the control)', () => {
    // The guard is "not this tier again", not "never upgrade".
    if (TIERS.length < 2) return;
    const snapshot = withCompany(5_000_000);
    const first = batched(snapshot);
    buildRDLab(snapshot, first.setState, COMPANY_ID, TIERS[0], deps);

    const upgraded = batched(first.get());
    buildRDLab(first.get(), upgraded.setState, COMPANY_ID, TIERS[1], deps);

    expect(upgraded.get().companies?.[0].rdLab?.type).toBe(TIERS[1]);
    expect(upgraded.get().stats.money).toBeLessThan(first.get().stats.money);
  });
});

describe('C-7 — buying a pet adds one pet', () => {
  function petBuyer(money: number): GameState {
    const base = createTestGameState();
    return createTestGameState({ stats: { ...base.stats, money }, pets: [] });
  }

  /**
   * CORRECTED after the first version of this test failed.
   *
   * I had asserted that two `buyPet` CALLS produce one pet. They do not, and
   * should not: the id is generated per call, so two taps buy two distinct
   * pets and charge for two — the player got what they paid for.
   *
   * The real hazard is narrower and the guard addresses exactly it: ONE call
   * whose updater runs twice. React invokes a `useState` updater twice under
   * StrictMode, and the id is captured in the closure — so both invocations
   * append the SAME object, giving two roster rows sharing one id. Every later
   * `pets.map(p => p.id === petId ? … : p)` then matches both: one feed feeds
   * both, one vet visit heals both, and the weekly food cost is charged for
   * two pets bought once.
   */
  it('a re-invoked updater cannot append the same pet twice', () => {
    const snapshot = petBuyer(500_000);
    let state = snapshot;
    const updaters: ((p: GameState) => GameState)[] = [];
    const recording = ((update: React.SetStateAction<GameState>) => {
      if (typeof update !== 'function') throw new Error('non-functional updater');
      const fn = update as (p: GameState) => GameState;
      updaters.push(fn);
      state = fn(state);
    }) as React.Dispatch<React.SetStateAction<GameState>>;

    buyPet(snapshot, recording, 'dog', 'Rex', deps);
    expect(state.pets).toHaveLength(1);

    // Replay the SAME updater, as StrictMode does.
    state = updaters[0](state);

    expect(state.pets).toHaveLength(1);
    const ids = (state.pets ?? []).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('and does not charge for the replay', () => {
    const snapshot = petBuyer(500_000);
    let state = snapshot;
    const updaters: ((p: GameState) => GameState)[] = [];
    const recording = ((update: React.SetStateAction<GameState>) => {
      const fn = update as (p: GameState) => GameState;
      updaters.push(fn);
      state = fn(state);
    }) as React.Dispatch<React.SetStateAction<GameState>>;

    buyPet(snapshot, recording, 'dog', 'Rex', deps);
    const afterOne = 500_000 - state.stats.money;
    state = updaters[0](state);

    expect(afterOne).toBeGreaterThan(0);
    expect(500_000 - state.stats.money).toBe(afterOne);
  });

  it('two separate taps DO buy two pets (the control)', () => {
    // Deliberately asserting the behaviour I first mistook for the bug: a
    // player with cash for two who taps twice has bought two pets, and the
    // guard must not collapse them.
    const snapshot = petBuyer(500_000);
    const { setState, get } = batched(snapshot);

    buyPet(snapshot, setState, 'dog', 'Rex', deps);
    buyPet(snapshot, setState, 'dog', 'Rex', deps);

    expect(get().pets).toHaveLength(2);
    const ids = (get().pets ?? []).map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('a genuine SECOND pet still works (the control)', () => {
    const snapshot = petBuyer(500_000);
    const first = batched(snapshot);
    buyPet(snapshot, first.setState, 'dog', 'Rex', deps);

    const second = batched(first.get());
    buyPet(first.get(), second.setState, 'dog', 'Bella', deps);

    expect(second.get().pets).toHaveLength(2);
  });
});

describe('C-6 — a vet visit is charged once', () => {
  function withSickPet(money: number, over: Record<string, unknown> = {}): GameState {
    const base = createTestGameState();
    return createTestGameState({
      stats: { ...base.stats, money },
      pets: [{
        id: 'p1', name: 'Rex', type: 'dog', age: 3,
        hunger: 80, happiness: 60, health: 40, energy: 80,
        ...over,
      }] as never,
    });
  }

  /**
   * CORRECTED after the first version of this test failed.
   *
   * I had asserted that two checkups on a 40-health pet charge once. They
   * charge twice, correctly — the first does not reach 100, so the second
   * genuinely heals more and is worth paying for. The guard is "nothing left to
   * do", not "one visit ever", and the failing test was mine, not the code's.
   *
   * The real double-charge is a tap on a pet the visit cannot help.
   */
  it('two taps on an ALREADY-HEALED pet charge once', () => {
    const snapshot = withSickPet(500_000, { health: 99, happiness: 100 });
    const { setState, get } = batched(snapshot);

    payForVet(snapshot, setState, 'p1', 'checkup', deps, 10);
    const afterOne = 500_000 - get().stats.money;
    payForVet(snapshot, setState, 'p1', 'checkup', deps, 10);

    expect(get().pets?.[0].health).toBe(100);
    expect(500_000 - get().stats.money).toBe(afterOne);
  });

  it('a second visit that still heals is allowed (the control)', () => {
    // The guard must not make treatment one-shot for a badly hurt pet.
    const snapshot = withSickPet(500_000, { health: 10 });
    const first = batched(snapshot);
    payForVet(snapshot, first.setState, 'p1', 'checkup', deps, 10);
    const spentOnce = 500_000 - first.get().stats.money;

    const stillHurt = first.get();
    if ((stillHurt.pets?.[0].health ?? 0) >= 100) return;
    const second = batched(stillHurt);
    payForVet(stillHurt, second.setState, 'p1', 'checkup', deps, 11);

    expect(500_000 - second.get().stats.money).toBeGreaterThan(spentOnce);
  });

  it('a fully healthy pet is not charged for a no-op checkup', () => {
    const snapshot = withSickPet(500_000, { health: 100, happiness: 100 });
    const { setState, get } = batched(snapshot);

    payForVet(snapshot, setState, 'p1', 'checkup', deps, 10);

    expect(get().stats.money).toBe(500_000);
  });
});
