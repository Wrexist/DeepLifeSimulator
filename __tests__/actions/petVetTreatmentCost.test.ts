/**
 * Pet vet pricing — the vet now bills a sick pet's OWN sickness `treatmentCost`
 * for a sickness-treating service, instead of always charging the flat
 * VET_SERVICES price. Non-treatment services (checkup, grooming) and healthy
 * pets keep the flat price.
 */
import type { Dispatch, SetStateAction } from 'react';
import { GameState, Pet } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { payForVet } from '@/contexts/game/actions/PetActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import {
  vetServicePrice,
  findVetService,
  findSickness,
  VET_SERVICES,
  PET_SICKNESSES,
} from '@/lib/pets/catalog';

function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function' ? (update as (p: GameState) => GameState)(current) : update;
  };
  return { get: () => current, setGameState };
}

const money = (m: number) => ({ ...createTestGameState().stats, money: m });

const basePet = (over: Partial<Pet> = {}): Pet => ({
  id: 'p1',
  name: 'Rex',
  type: 'dog',
  age: 10,
  hunger: 80,
  happiness: 80,
  health: 50,
  energy: 80,
  ...over,
});

describe('vetServicePrice (pure)', () => {
  const treatment = findVetService('treatment')!; // treatsSickness, flat $500
  const checkup = findVetService('checkup')!; // NOT a treatment
  const cold = findSickness('cold')!; // treatmentCost 100

  it('uses the sickness treatmentCost for a sickness-treating service', () => {
    expect(vetServicePrice(treatment, cold)).toBe(cold.treatmentCost);
    expect(vetServicePrice(treatment, cold)).not.toBe(treatment.price);
  });

  it('falls back to the flat price when the pet is not sick', () => {
    expect(vetServicePrice(treatment, null)).toBe(treatment.price);
    expect(vetServicePrice(treatment, undefined)).toBe(treatment.price);
  });

  it('ignores the sickness cost for a non-treatment service', () => {
    expect(vetServicePrice(checkup, cold)).toBe(checkup.price);
  });

  it('every catalog sickness defines a positive treatmentCost that the vet reads', () => {
    for (const s of PET_SICKNESSES) {
      expect(s.treatmentCost).toBeGreaterThan(0);
      expect(vetServicePrice(VET_SERVICES.find((v) => v.treatsSickness)!, s)).toBe(s.treatmentCost);
    }
  });
});

describe('payForVet — charges the effective (treatmentCost) price', () => {
  it('a sick pet pays its sickness treatmentCost, not the flat service price', () => {
    const cold = findSickness('cold')!;
    const treatment = findVetService('treatment')!;
    expect(cold.treatmentCost).toBeLessThan(treatment.price); // sanity: the fix is observable
    const store = makeStore(
      createTestGameState({ stats: money(100_000), pets: [basePet({ isSick: true, sickness: 'cold' })] }),
    );
    const res = payForVet(store.get(), store.setGameState, 'p1', 'treatment', { updateMoney }, 5);
    expect(res.success).toBe(true);
    expect(store.get().stats.money).toBe(100_000 - cold.treatmentCost); // 100, not 500
    // The treatment cleared the sickness.
    expect(store.get().pets?.[0].isSick).toBe(false);
  });

  it('a healthy pet pays the flat service price', () => {
    const treatment = findVetService('treatment')!;
    const store = makeStore(
      createTestGameState({ stats: money(100_000), pets: [basePet({ isSick: false, sickness: undefined })] }),
    );
    const res = payForVet(store.get(), store.setGameState, 'p1', 'treatment', { updateMoney }, 5);
    expect(res.success).toBe(true);
    expect(store.get().stats.money).toBe(100_000 - treatment.price);
  });
});
