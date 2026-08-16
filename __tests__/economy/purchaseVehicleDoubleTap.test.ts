/**
 * WP-E — `VehicleActions.purchaseVehicle` was a textbook gate → grant
 * (CLAUDE.md §4.4).
 *
 * Every gate (licence, reputation, affordability, already-owned) read the stale
 * render-time snapshot, the updater re-checked NOTHING, and the debit floored at
 * zero (`Math.max(0, prevMoney - vehiclePrice)`). Two taps in one React batch
 * therefore:
 *   • pushed TWO garage entries, and
 *   • charged whatever cash was left for the second one (silent debt
 *     forgiveness rather than a refusal).
 *
 * The duplicate entries also shared an id, because `createVehicleFromTemplate`
 * stamps `id: template.id` — and `sellVehicle` filters by id, so selling
 * removed BOTH copies while crediting ONE sale price. That id identity is
 * deliberate (the whole vehicle system keys on it: the already-own gate, the
 * `VEHICLE_TEMPLATES` price lookup in `sellVehicle`, `loan.vehicleId`,
 * insurance, weekly processing), so the fix is re-checking ownership against
 * `prev`, not unique ids.
 *
 * `purchaseVehicle` is now a pure resolver (`resolvePurchaseVehicle`) called
 * twice — against the caller's snapshot for the outcome, against `prev` for the
 * state — the shape `__tests__/refactor/updaterResultRatchet.test.ts`
 * prescribes. Nothing crosses the updater boundary, so the reported outcome is
 * whatever the SNAPSHOT supported and the STATE is the authority; the
 * assertions below pin the state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { purchaseVehicle, sellVehicle } from '@/contexts/game/actions/VehicleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { getVehicleTemplate } from '@/lib/vehicles/vehicles';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const deps = { updateMoney, updateStats };
const TEMPLATE = getVehicleTemplate('economy_sedan')!;

/** Minimal synchronous setGameState honoring functional-updater semantics. */
function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function'
      ? (update as (p: GameState) => GameState)(current)
      : update;
  };
  return { get: () => current, setGameState };
}

const licensed = (money: number): GameState =>
  createTestGameState({
    hasDriversLicense: true,
    weeksLived: 200,
    stats: { money, reputation: 50 } as never,
    vehicles: [],
  });

describe('WP-E — purchaseVehicle premise', () => {
  it('the template is real, priced, and needs no reputation', () => {
    expect(TEMPLATE.price).toBeGreaterThan(0);
    expect(TEMPLATE.requiredReputation ?? 0).toBeLessThanOrEqual(50);
  });

  it('a single purchase charges once and adds one vehicle', () => {
    const snapshot = licensed(TEMPLATE.price * 3);
    const store = makeStore(snapshot);

    const res = purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);

    expect(res.success).toBe(true);
    expect(store.get().vehicles).toHaveLength(1);
    expect(store.get().stats.money).toBe(TEMPLATE.price * 3 - TEMPLATE.price);
  });
});

describe('WP-E — purchaseVehicle same-batch double-tap', () => {
  it('two taps on the same snapshot buy ONE vehicle and charge ONE price', () => {
    const snapshot = licensed(TEMPLATE.price * 3);
    const store = makeStore(snapshot);

    // Both calls receive the SAME stale snapshot — the real double-tap shape.
    purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);
    purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);

    const after = store.get();
    expect(after.vehicles).toHaveLength(1);
    expect(after.stats.money).toBe(TEMPLATE.price * 3 - TEMPLATE.price);
  });

  it('so the garage never holds two entries sharing one id (the sell exploit)', () => {
    const snapshot = licensed(TEMPLATE.price * 3);
    const store = makeStore(snapshot);

    purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);
    purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);

    const ids = (store.get().vehicles ?? []).map((v) => v.id);
    expect(ids).toEqual([TEMPLATE.id]);
    expect(new Set(ids).size).toBe(ids.length);

    // And selling settles exactly the one vehicle that was paid for: the
    // filter-by-id removal can no longer take a second, unpaid-for copy with it.
    const moneyBeforeSale = store.get().stats.money;
    const sale = sellVehicle(store.get(), store.setGameState, TEMPLATE.id, deps);
    expect(sale.success).toBe(true);
    expect(store.get().vehicles).toHaveLength(0);
    expect(store.get().stats.money).toBeGreaterThan(moneyBeforeSale);
  });

  it('reputation is granted once, not once per tap', () => {
    const snapshot = licensed(TEMPLATE.price * 3);
    const store = makeStore(snapshot);
    const before = snapshot.stats.reputation;

    purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);
    purchaseVehicle(snapshot, store.setGameState, TEMPLATE.id, deps);

    expect(store.get().stats.reputation).toBe(
      Math.min(100, before + TEMPLATE.reputationBonus),
    );
  });
});

describe('WP-E — purchaseVehicle refuses instead of clamping', () => {
  it('funds that ran out between the check and the updater buy nothing', () => {
    // The snapshot can afford it; `prev` cannot. Only the inner check sees this.
    // The old `Math.max(0, …)` handed over the car and forgave the shortfall.
    const rich = licensed(TEMPLATE.price * 3);
    let state = rich;
    const setGameState = ((update: SetStateAction<GameState>) => {
      state = (update as (p: GameState) => GameState)({
        ...state,
        stats: { ...state.stats, money: TEMPLATE.price - 1 },
      });
    }) as Dispatch<SetStateAction<GameState>>;

    purchaseVehicle(rich, setGameState, TEMPLATE.id, deps);

    expect(state.stats.money).toBe(TEMPLATE.price - 1); // not zeroed
    expect(state.vehicles ?? []).toHaveLength(0); // and no car
  });

  it('a snapshot that cannot afford it is rejected by the outer guard', () => {
    const broke = licensed(1);
    const store = makeStore(broke);

    const res = purchaseVehicle(broke, store.setGameState, TEMPLATE.id, deps);

    expect(res.success).toBe(false);
    expect(store.get().vehicles ?? []).toHaveLength(0);
    expect(store.get().stats.money).toBe(1);
  });
});
