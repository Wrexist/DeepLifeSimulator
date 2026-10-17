/**
 * Buying and selling a vehicle must never net reputation.
 *
 * A purchase granted the full `reputationBonus` and a sale took back
 * `floor(bonus / 2)`, so each round trip netted +bonus/2. The owner's probe:
 * 19 round trips on the sport motorcycle (+10 rep, $15k, ~$3k lost per trip)
 * took reputation 0 -> 95 for $57k - enough to clear political office gates.
 *
 * Also pins the licence gate on the path the UI actually buys through
 * (`purchaseVehicleWithAutoLoan`): it never checked the pilot's licence, so
 * the $45k licence gated nothing.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  purchaseVehicle,
  purchaseVehicleWithAutoLoan,
  sellVehicle,
  reputationAfterVehiclePurchase,
  reputationAfterVehicleSale,
  vehiclePurchaseReputationGain,
  vehicleReputationBonus,
} from '@/contexts/game/actions/VehicleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { VEHICLE_TEMPLATES, getVehicleTemplate, createVehicleFromTemplate } from '@/lib/vehicles/vehicles';
import { PILOT_LICENSE } from '@/lib/vehicles/aircraft';

function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function' ? (update as (p: GameState) => GameState)(current) : update;
  };
  return { get: () => current, setGameState };
}

const deps = { updateMoney, updateStats };

function buyCash(store: ReturnType<typeof makeStore>, templateId: string) {
  return purchaseVehicleWithAutoLoan(store.get(), store.setGameState, {
    templateId,
    tier: 'cash',
    term: '5y',
    weeklyIncome: 5000,
  });
}

function driver(reputation: number, money = 10_000_000, extra: Partial<GameState> = {}) {
  const base = createTestGameState();
  return makeStore(
    createTestGameState({
      hasDriversLicense: true,
      stats: { ...base.stats, money, reputation },
      ...extra,
    }),
  );
}

describe('vehicle reputation - buy + sell never nets positive', () => {
  it("the owner's probe: 19 sport-motorcycle round trips leave reputation where it started", () => {
    const template = getVehicleTemplate('sport_motorcycle')!;
    expect(template.reputationBonus).toBe(10); // the probe's car - guards a vacuous pass
    const store = driver(0, 1_000_000);

    for (let trip = 0; trip < 19; trip++) {
      expect(buyCash(store, 'sport_motorcycle').success).toBe(true);
      expect(store.get().stats.reputation).toBe(10);
      expect(sellVehicle(store.get(), store.setGameState, 'sport_motorcycle', deps).success).toBe(true);
    }

    // Before the fix: 95 (each trip +10 -5).
    expect(store.get().stats.reputation).toBe(0);
  });

  it.each(VEHICLE_TEMPLATES.filter((t) => t.reputationBonus > 0 && t.type !== 'plane').map((t) => [t.id, t.reputationBonus] as const))(
    '%s (+%i): a round trip from any starting reputation ends at or below it',
    (id) => {
      for (const start of [0, 1, 37, 50, 89, 95, 99, 100]) {
        const store = driver(start);
        const template = getVehicleTemplate(id)!;
        // Clear any reputation floor so every template is buyable here.
        if ((template.requiredReputation ?? 0) > start) continue;
        expect(buyCash(store, id).success).toBe(true);
        sellVehicle(store.get(), store.setGameState, id, deps);
        const end = store.get().stats.reputation;
        expect(end).toBeLessThanOrEqual(start);
        // Exact when the grant was not clipped by the 100 cap.
        if (start + template.reputationBonus <= 100) expect(end).toBe(start);
      }
    },
  );

  it('the legacy purchaseVehicle path round-trips neutrally too', () => {
    const store = driver(20, 1_000_000);
    for (let trip = 0; trip < 5; trip++) {
      expect(purchaseVehicle(store.get(), store.setGameState, 'sport_motorcycle').success).toBe(true);
      sellVehicle(store.get(), store.setGameState, 'sport_motorcycle', deps);
    }
    expect(store.get().stats.reputation).toBe(20);
  });

  it('sell-then-rebuy is neutral whenever reputation covers the bonus', () => {
    const store = driver(0, 1_000_000);
    buyCash(store, 'sport_motorcycle'); // 10
    store.setGameState((p) => ({ ...p, stats: { ...p.stats, reputation: 42 } }));
    sellVehicle(store.get(), store.setGameState, 'sport_motorcycle', deps);
    expect(store.get().stats.reputation).toBe(32);
    buyCash(store, 'sport_motorcycle');
    expect(store.get().stats.reputation).toBe(42);
  });

  it('a same-batch double sale takes the reputation back once', () => {
    const store = driver(30, 1_000_000);
    buyCash(store, 'sport_motorcycle'); // 40
    const stale = store.get();
    sellVehicle(stale, store.setGameState, 'sport_motorcycle', deps);
    sellVehicle(stale, store.setGameState, 'sport_motorcycle', deps);
    expect(store.get().stats.reputation).toBe(30);
  });

  it('selling takes back the bonus stamped on the vehicle, not a re-read template', () => {
    const car = { ...createVehicleFromTemplate(getVehicleTemplate('sport_motorcycle')!, 0), reputationBonus: 4 };
    expect(vehicleReputationBonus(car)).toBe(4);
    const store = driver(50, 0, { vehicles: [car], activeVehicleId: car.id });
    sellVehicle(store.get(), store.setGameState, car.id, deps);
    expect(store.get().stats.reputation).toBe(46);
    // A vehicle that carried nothing takes nothing back.
    expect(vehicleReputationBonus({ id: 'starting_vehicle', reputationBonus: 0 })).toBe(0);
  });

  it('the clamp helpers: capped at 100 going up, floored at 0 going down, NaN-safe', () => {
    expect(reputationAfterVehiclePurchase(95, 10)).toBe(100);
    expect(vehiclePurchaseReputationGain(95, 10)).toBe(5);
    expect(vehiclePurchaseReputationGain(100, 10)).toBe(0);
    expect(reputationAfterVehicleSale(3, 10)).toBe(0);
    expect(reputationAfterVehiclePurchase(Number.NaN, 10)).toBe(10);
    expect(reputationAfterVehicleSale(50, Number.NaN)).toBe(50);
  });
});

describe('purchaseVehicleWithAutoLoan - the gates the legacy path already had', () => {
  const aircraft = VEHICLE_TEMPLATES.filter((t) => t.type === 'plane');

  it('the catalogue ships aircraft (otherwise the gate test is vacuous)', () => {
    expect(aircraft.length).toBeGreaterThan(0);
  });

  it.each(aircraft.map((t) => [t.id] as const))('%s is refused without a pilot licence, and nothing is charged', (id) => {
    const store = driver(100, 50_000_000, { hasPilotLicense: false });
    const before = store.get();
    const r = buyCash(store, id);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/pilot/i);
    expect(r.message).toContain(PILOT_LICENSE.cost.toLocaleString('en-US'));
    expect(store.get().stats.money).toBe(before.stats.money);
    expect((store.get().vehicles ?? []).some((v) => v.id === id)).toBe(false);
  });

  it('an aircraft is bought once the pilot licence is held', () => {
    const store = driver(0, 50_000_000, { hasPilotLicense: true });
    expect(buyCash(store, 'utility_helicopter').success).toBe(true);
    expect((store.get().vehicles ?? []).some((v) => v.id === 'utility_helicopter')).toBe(true);
  });

  it('a car below its reputation floor is refused on this path too', () => {
    const store = driver(0, 1_000_000);
    const r = buyCash(store, 'exotic_supercar'); // requiredReputation 50
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/reputation/i);
    expect(store.get().stats.money).toBe(1_000_000);
  });
});
