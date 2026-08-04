/**
 * R4-X5 / R4-X8 — four more gate-then-grant sites that charged twice for one
 * purchase.
 *
 * Each reads its precondition from the STALE outer `gameState`, then debits
 * inside the updater with `Math.max(0, money - cost)` — which floors instead of
 * rejecting. None of the buttons has an in-flight guard, so two taps landing in
 * one React batch both ran, and the second bought nothing:
 *
 *   - `refuelVehicle`  — refills an already-full tank and charges for it
 *   - `repairVehicle`  — repairs an already-perfect vehicle and charges for it
 *   - `getDriversLicense` — buys a licence the player already holds
 *   - `acceptAcquisition` — the offer is gone from `pendingAcquisitions` on the
 *     second pass, so the filter is a no-op, but it still charges the asking
 *     price again, adds another +3 reputation and another synergy bump, and
 *     double-counts `totalAcquisitionsCompleted`. Acquisition prices run to
 *     seven figures.
 *
 * On a thin wallet the floor is worse than the double charge: the player's cash
 * is zeroed rather than the second tap being declined. CLAUDE.md §4.4 — the
 * charge and the effect must be decided against the same `prev`.
 * 2026-07-31 audit round 4.
 */
import {
  getDriversLicense,
  refuelVehicle,
  repairVehicle,
} from '@/contexts/game/actions/VehicleActions';
import { acceptAcquisition } from '@/contexts/game/actions/HustleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Vehicle } from '@/contexts/game/types';

/** Applies updaters to a shared state while handing every caller the same stale snapshot. */
function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') {
      throw new Error('action wrote a raw value instead of a functional updater');
    }
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const CAR = {
  id: 'economy_sedan',
  name: 'Economy Sedan',
  fuelLevel: 20,
  condition: 40,
  price: 20_000,
  weeklyFuelCost: 60,
} as unknown as Vehicle;

function withCar(money: number, over: Partial<Vehicle> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    hasDriversLicense: true,
    vehicles: [{ ...CAR, ...over }] as Vehicle[],
    activeVehicleId: CAR.id,
  });
}

const deps = { updateMoney };

describe('R4-X5 — vehicle upkeep charges once per tap-burst', () => {
  it('refuel: two taps in one batch fill the tank once and charge once', () => {
    const snapshot = withCar(100_000);
    const { setState, get } = batched(snapshot);

    refuelVehicle(snapshot, setState, CAR.id, deps);
    const afterOne = 100_000 - get().stats.money;
    refuelVehicle(snapshot, setState, CAR.id, deps);

    expect(afterOne).toBeGreaterThan(0);
    expect(100_000 - get().stats.money).toBe(afterOne);
    expect(get().vehicles?.[0].fuelLevel).toBe(100);
  });

  it('refuel: a thin wallet is not zeroed by the second tap', () => {
    // The floor, stated directly: Math.max(0, money - cost) took whatever was
    // left rather than declining.
    const snapshot = withCar(100_000);
    const probe = batched(snapshot);
    refuelVehicle(snapshot, probe.setState, CAR.id, deps);
    const cost = 100_000 - probe.get().stats.money;

    const thin = withCar(cost + Math.floor(cost / 2));
    const { setState, get } = batched(thin);
    refuelVehicle(thin, setState, CAR.id, deps);
    refuelVehicle(thin, setState, CAR.id, deps);

    expect(get().stats.money).toBe(Math.floor(cost / 2));
    expect(get().stats.money).toBeGreaterThan(0);
  });

  it('repair: two taps in one batch repair once and charge once', () => {
    const snapshot = withCar(100_000);
    const { setState, get } = batched(snapshot);

    repairVehicle(snapshot, setState, CAR.id, deps);
    const afterOne = 100_000 - get().stats.money;
    repairVehicle(snapshot, setState, CAR.id, deps);

    expect(afterOne).toBeGreaterThan(0);
    expect(100_000 - get().stats.money).toBe(afterOne);
    expect(get().vehicles?.[0].condition).toBe(100);
  });

  it("driver's licence: two taps buy one licence", () => {
    const base = createTestGameState();
    const snapshot = createTestGameState({
      stats: { ...base.stats, money: 100_000 },
      hasDriversLicense: false,
      date: { ...base.date, age: 25 },
    });
    const { setState, get } = batched(snapshot);

    getDriversLicense(snapshot, setState, deps);
    const afterOne = 100_000 - get().stats.money;
    getDriversLicense(snapshot, setState, deps);

    expect(afterOne).toBeGreaterThan(0);
    expect(100_000 - get().stats.money).toBe(afterOne);
    expect(get().hasDriversLicense).toBe(true);
  });

  it('a genuinely second refuel later still charges (not over-blocked)', () => {
    // The control: the guard is "already full", not "ever refuelled".
    const snapshot = withCar(100_000);
    const first = batched(snapshot);
    refuelVehicle(snapshot, first.setState, CAR.id, deps);
    const cost = 100_000 - first.get().stats.money;

    const drained = createTestGameState({
      ...first.get(),
      vehicles: [{ ...first.get().vehicles![0], fuelLevel: 20 }],
    });
    const second = batched(drained);
    refuelVehicle(drained, second.setState, CAR.id, deps);

    expect(100_000 - second.get().stats.money).toBe(2 * cost);
  });
});

describe('R4-X8 — an acquisition closes once per tap-burst', () => {
  const COMPANY_ID = 'co-1';
  const ASKING = 250_000;

  function withOffer(money: number): GameState {
    const base = createTestGameState();
    return createTestGameState({
      stats: { ...base.stats, money, reputation: 10 },
      weeksLived: 40,
      hustleApp: {
        companies: {
          [COMPANY_ID]: {
            marketSharePercent: 10,
            pendingAcquisitions: [{
              id: 'acq-1',
              targetName: 'Rival Co',
              askingPrice: ASKING,
              synergyBonusPercent: 20,
              expiresWeek: 60,
            }],
            notifications: [],
          },
        },
        lifetimeStats: { totalAcquisitionsCompleted: 0 },
      } as never,
    });
  }

  it('the fixture really has a pending offer (guards everything below)', () => {
    expect(withOffer(1_000_000).hustleApp?.companies?.[COMPANY_ID]?.pendingAcquisitions).toHaveLength(1);
  });

  it('charges the asking price once for two taps', () => {
    const snapshot = withOffer(1_000_000);
    const { setState, get } = batched(snapshot);

    acceptAcquisition(setState, snapshot, COMPANY_ID, 'acq-1');
    acceptAcquisition(setState, snapshot, COMPANY_ID, 'acq-1');

    expect(1_000_000 - get().stats.money).toBe(ASKING);
    expect(get().hustleApp?.companies?.[COMPANY_ID]?.pendingAcquisitions).toHaveLength(0);
  });

  it('grants the reputation and the lifetime stat once', () => {
    const snapshot = withOffer(1_000_000);
    const { setState, get } = batched(snapshot);

    acceptAcquisition(setState, snapshot, COMPANY_ID, 'acq-1');
    acceptAcquisition(setState, snapshot, COMPANY_ID, 'acq-1');

    expect(get().stats.reputation).toBe(13);
    expect(get().hustleApp?.lifetimeStats?.totalAcquisitionsCompleted).toBe(1);
  });

  it('applies the synergy market-share bump once', () => {
    const snapshot = withOffer(1_000_000);
    const { setState, get } = batched(snapshot);

    acceptAcquisition(setState, snapshot, COMPANY_ID, 'acq-1');
    acceptAcquisition(setState, snapshot, COMPANY_ID, 'acq-1');

    expect(get().hustleApp?.companies?.[COMPANY_ID]?.marketSharePercent).toBe(15);
  });

  it('a DIFFERENT pending offer still closes (not over-blocked)', () => {
    // The control: the guard is "this offer is gone", not "an acquisition
    // already happened".
    const snapshot = withOffer(1_000_000);
    const withTwo = createTestGameState({
      ...snapshot,
      hustleApp: {
        ...snapshot.hustleApp,
        companies: {
          [COMPANY_ID]: {
            ...snapshot.hustleApp!.companies![COMPANY_ID],
            pendingAcquisitions: [
              ...snapshot.hustleApp!.companies![COMPANY_ID].pendingAcquisitions,
              { id: 'acq-2', targetName: 'Other Co', askingPrice: 100_000, synergyBonusPercent: 8, expiresWeek: 60 },
            ],
          },
        },
      } as never,
    });
    const { setState, get } = batched(withTwo);

    acceptAcquisition(setState, withTwo, COMPANY_ID, 'acq-1');
    acceptAcquisition(setState, get(), COMPANY_ID, 'acq-2');

    expect(1_000_000 - get().stats.money).toBe(ASKING + 100_000);
    expect(get().hustleApp?.lifetimeStats?.totalAcquisitionsCompleted).toBe(2);
  });
});
