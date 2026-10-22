/**
 * Selling an insured car refunds the unused premium, as cancelling does.
 *
 * `sellVehicle` removed the car (and its policy) and credited only the sale
 * price, so a player who sold the week after buying a six-month policy lost
 * nearly the whole premium - unless they knew to cancel first, which
 * `cancelInsurance` refunds pro rata. Both paths now share `insuranceRefund`.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { insuranceRefund, sellVehicle } from '@/contexts/game/actions/VehicleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { calculateVehicleSellPrice, createVehicleFromTemplate, getVehicleTemplate } from '@/lib/vehicles/vehicles';

function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function' ? (update as (p: GameState) => GameState)(current) : update;
  };
  return { get: () => current, setGameState };
}

const deps = { updateMoney, updateStats };

function ownerOfInsuredCar(active: boolean) {
  const template = getVehicleTemplate('sport_motorcycle');
  if (!template) throw new Error('template missing');
  const weeksLived = 500;
  const car = {
    ...createVehicleFromTemplate(template, weeksLived - 1),
    insurance: {
      id: 'premium',
      type: 'premium' as const,
      monthlyCost: 400,
      coveragePercent: 100,
      active,
      expiresWeek: weeksLived + 25,
    },
  };
  const base = createTestGameState();
  return {
    car,
    store: makeStore(
      createTestGameState({
        weeksLived,
        hasDriversLicense: true,
        stats: { ...base.stats, money: 1_000, reputation: 50 },
        vehicles: [car],
        loans: [],
      }),
    ),
  };
}

describe('sellVehicle refunds an active policy', () => {
  it('credits the sale price plus the pro-rata premium refund', () => {
    const { car, store } = ownerOfInsuredCar(true);
    const expectedRefund = insuranceRefund(car.insurance, 500);
    expect(expectedRefund).toBeGreaterThan(2000); // 25 of 26 weeks of a $2,400 premium, less $25

    const result = sellVehicle(store.get(), store.setGameState, car.id, deps);
    expect(result.success).toBe(true);
    expect(store.get().stats.money).toBe(1_000 + calculateVehicleSellPrice(car) + expectedRefund);
    expect(result.message).toContain('Insurance refund');
  });

  it('pays nothing extra for a lapsed policy', () => {
    const { car, store } = ownerOfInsuredCar(false);
    sellVehicle(store.get(), store.setGameState, car.id, deps);
    expect(store.get().stats.money).toBe(1_000 + calculateVehicleSellPrice(car));
  });

  it('a double tap pays the refund once', () => {
    const { car, store } = ownerOfInsuredCar(true);
    const snapshot = store.get();
    sellVehicle(snapshot, store.setGameState, car.id, deps);
    sellVehicle(snapshot, store.setGameState, car.id, deps);
    expect(store.get().stats.money).toBe(
      1_000 + calculateVehicleSellPrice(car) + insuranceRefund(car.insurance, 500),
    );
  });
});
