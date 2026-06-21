/**
 * Regression: pets BEYOND the pre-roll length must still be able to fall sick.
 *
 * `tickPetsForWeek` maps over the full pets array (alive + dead), so `petIdx`
 * can exceed the pre-rolled `petSickness` array length on a player who has
 * owned many pets over a lifetime. Before the fix the consumer indexed
 * `rolls.petSickness[petIdx]` directly, yielding `undefined` past the end —
 * and `undefined < 0.06` is `false`, silently making those pets immune to
 * sickness. The consumer now wraps the index (modulo the array length).
 */

import { tickPetsForWeek } from '@/contexts/game/actions/weekly/applyPets';
import type { Pet } from '@/contexts/game/types';

function makePet(id: string, overrides: Partial<Pet> = {}): Pet {
  return {
    id,
    name: id,
    type: 'dog',
    age: 10,
    hunger: 0,
    happiness: 80,
    health: 80,
    isSick: false,
    isDead: false,
    ...overrides,
  } as Pet;
}

describe('tickPetsForWeek — pet sickness index wrap', () => {
  it('a pet past the pre-roll length can still fall sick (not immune)', () => {
    // 12 pets; pre-roll arrays are length 20, but exercise an index that would
    // have been out of range under the old length-10 buffer (idx 11).
    const pets = Array.from({ length: 12 }, (_, i) => makePet(`p${i}`));
    // Force a guaranteed-sick draw for every slot.
    const rolls = {
      petSickness: Array.from({ length: 10 }, () => 0), // 0 < 0.02 → always sick
      petSicknessType: Array.from({ length: 10 }, () => 0.1),
    };

    const result = tickPetsForWeek(pets, rolls);

    // The 11th pet (index 11) wraps to petSickness[11 % 10] = petSickness[1] = 0
    // → must be sick. Pre-fix it read undefined → stayed healthy.
    expect(result[11].isSick).toBe(true);
    expect(result[11].sickness).toBeDefined();
  });

  it('an empty roll buffer leaves pets healthy (no NaN / no crash)', () => {
    const pets = [makePet('a'), makePet('b')];
    const result = tickPetsForWeek(pets, { petSickness: [], petSicknessType: [] });
    expect(result.every(p => !p.isSick)).toBe(true);
  });

  it('a draw above the sickness threshold keeps a healthy pet well', () => {
    const pets = [makePet('a', { health: 80 })];
    const result = tickPetsForWeek(pets, { petSickness: [0.9], petSicknessType: [0.5] });
    expect(result[0].isSick).toBe(false);
  });
});
