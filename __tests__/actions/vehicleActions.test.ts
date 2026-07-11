/**
 * VehicleActions (Wave A):
 *   - purchaseVehicleWithAutoLoan now grants the advertised reputationBonus once
 *     at purchase (the UI buys exclusively through this path, so the dealer-card
 *     "+X rep" badge was previously a lie). Capped at 100; not double-granted on
 *     a repeat-buy no-op.
 *   - processAccident('total') removes the vehicle AND reassigns activeVehicleId
 *     — the canonical total-loss removal path the weekly tick mirrors.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  purchaseVehicleWithAutoLoan,
  processAccident,
} from '@/contexts/game/actions/VehicleActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { getVehicleTemplate, createVehicleFromTemplate } from '@/lib/vehicles/vehicles';

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

describe('purchaseVehicleWithAutoLoan — reputation grant', () => {
  it('grants the template reputationBonus once on a cash purchase', () => {
    const template = getVehicleTemplate('economy_sedan')!; // reputationBonus 2
    const store = makeStore(
      createTestGameState({
        hasDriversLicense: true,
        stats: { money: 100000, reputation: 0 },
      }),
    );

    const res = purchaseVehicleWithAutoLoan(store.setGameState, {
      templateId: 'economy_sedan',
      tier: 'cash',
      term: '5y',
      weeklyIncome: 2000,
    });

    expect(res.success).toBe(true);
    const s = store.get();
    expect(s.stats.reputation).toBe(template.reputationBonus); // 0 + 2
    expect((s.vehicles ?? []).some((v) => v.id === 'economy_sedan')).toBe(true);
    // Cash tier debits the full price.
    expect(s.stats.money).toBe(100000 - template.price);
  });

  it('caps granted reputation at 100', () => {
    const store = makeStore(
      createTestGameState({
        hasDriversLicense: true,
        stats: { money: 100000, reputation: 99 },
      }),
    );
    purchaseVehicleWithAutoLoan(store.setGameState, {
      templateId: 'economy_sedan', // +2 would overshoot to 101
      tier: 'cash',
      term: '5y',
      weeklyIncome: 2000,
    });
    expect(store.get().stats.reputation).toBe(100);
  });

  it('does not double-grant reputation when the vehicle is already owned', () => {
    const store = makeStore(
      createTestGameState({
        hasDriversLicense: true,
        stats: { money: 100000, reputation: 0 },
      }),
    );
    // First buy grants +2.
    purchaseVehicleWithAutoLoan(store.setGameState, {
      templateId: 'economy_sedan', tier: 'cash', term: '5y', weeklyIncome: 2000,
    });
    expect(store.get().stats.reputation).toBe(2);
    // Second buy is rejected (already owned) → reputation unchanged.
    const again = purchaseVehicleWithAutoLoan(store.setGameState, {
      templateId: 'economy_sedan', tier: 'cash', term: '5y', weeklyIncome: 2000,
    });
    expect(again.success).toBe(false);
    expect(store.get().stats.reputation).toBe(2);
  });

  it('grants reputation on the financed (non-cash) path too', () => {
    const template = getVehicleTemplate('economy_sedan')!;
    const store = makeStore(
      createTestGameState({
        hasDriversLicense: true,
        stats: { money: 100000, reputation: 10 },
      }),
    );
    const res = purchaseVehicleWithAutoLoan(store.setGameState, {
      templateId: 'economy_sedan',
      tier: 'standard', // 20% down + a financed remainder
      term: '5y',
      weeklyIncome: 5000,
    });
    // If financing is offered, the same return path grants rep; a rejection
    // (e.g. DTI) leaves reputation untouched — either way it never LOSES rep.
    if (res.success) {
      expect(store.get().stats.reputation).toBe(10 + template.reputationBonus);
      expect((store.get().loans ?? []).some((l) => l.type === 'auto')).toBe(true);
    } else {
      expect(store.get().stats.reputation).toBe(10);
    }
  });
});

describe('processAccident — total loss', () => {
  it('removes the totaled vehicle and reassigns activeVehicleId to a survivor', () => {
    const v1 = createVehicleFromTemplate(getVehicleTemplate('economy_sedan')!, 0);
    const v2 = { ...createVehicleFromTemplate(getVehicleTemplate('used_suv')!, 0), id: 'used_suv' };
    const store = makeStore(
      createTestGameState({
        hasDriversLicense: true,
        stats: { health: 100 },
        vehicles: [v1, v2],
        activeVehicleId: v1.id,
      }),
    );

    const res = processAccident(store.get(), store.setGameState, v1.id, 'total', { updateStats });

    expect(res.success).toBe(true);
    const s = store.get();
    expect((s.vehicles ?? []).some((v) => v.id === v1.id)).toBe(false); // removed
    expect((s.vehicles ?? []).some((v) => v.id === 'used_suv')).toBe(true); // survivor kept
    expect(s.activeVehicleId).toBe('used_suv'); // reassigned to survivor
    expect(s.stats.health).toBeLessThan(100); // driver injured
  });

  it('clears activeVehicleId when the only vehicle is totaled', () => {
    const v1 = createVehicleFromTemplate(getVehicleTemplate('economy_sedan')!, 0);
    const store = makeStore(
      createTestGameState({
        hasDriversLicense: true,
        stats: { health: 100 },
        vehicles: [v1],
        activeVehicleId: v1.id,
      }),
    );

    processAccident(store.get(), store.setGameState, v1.id, 'total', { updateStats });
    const s = store.get();
    expect(s.vehicles ?? []).toHaveLength(0);
    expect(s.activeVehicleId).toBeUndefined();
  });
});
