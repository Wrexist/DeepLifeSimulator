import { tickPet, tickAllPets } from '../decay';
import { Pet } from '@/contexts/game/types';

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'p1',
    name: 'Rex',
    type: 'dog',
    age: 5 * 52, // 5 years old adult dog
    hunger: 100,
    happiness: 100,
    health: 100,
    energy: 100,
    ...over,
  } as Pet;
}

describe('tickPet', () => {
  it('ages by one week each tick', () => {
    const r = tickPet({ pet: pet({ age: 100 }), rollIllness: 0.99, rollSicknessKind: 0 });
    expect(r.pet.age).toBe(101);
  });

  it('drops hunger by breed decay amount when adult', () => {
    const r = tickPet({ pet: pet(), rollIllness: 0.99, rollSicknessKind: 0 });
    // adult dog → 12 * 1.0 = 12 drop
    expect(r.pet.hunger).toBe(88);
  });

  it('rolls a sickness when fire-roll is low', () => {
    const r = tickPet({ pet: pet({ vaccinated: false }), rollIllness: 0.001, rollSicknessKind: 0.5 });
    expect(r.pet.isSick).toBe(true);
    expect(r.pet.sickness).toBeDefined();
  });

  it('vaccinations lower illness chance — high roll skips', () => {
    const r = tickPet({ pet: pet({ vaccinated: true }), rollIllness: 0.05, rollSicknessKind: 0.5 });
    // adult dog base 0.025 * 0.5 vax = 0.0125 → 0.05 misses
    expect(r.pet.isSick).toBeFalsy();
  });

  it('drains health from active sickness', () => {
    const r = tickPet({
      pet: pet({ isSick: true, sickness: 'infection' }),
      rollIllness: 0.99,
      rollSicknessKind: 0,
    });
    // infection healthDrain = 5
    expect(r.pet.health).toBe(95);
  });

  it('kills pet at lifespan end via old-age', () => {
    const r = tickPet({
      pet: pet({ age: 15 * 52 - 1 }), // one week before lifespan
      rollIllness: 0.99,
      rollSicknessKind: 0,
    });
    expect(r.died).toBe(true);
    expect(r.causeOfDeath).toBe('old-age');
    expect(r.pet.isDead).toBe(true);
  });

  it('starvation when hunger hits zero and stays there for 2 weeks at 0 health', () => {
    let p = pet({ hunger: 5, health: 5, isSick: false });
    // Tick 1: hunger→0, health→0, weeksAtZeroHealth=1, not dead yet.
    const r1 = tickPet({ pet: p, rollIllness: 0.99, rollSicknessKind: 0 });
    expect(r1.died).toBe(false);
    // Tick 2: weeksAtZeroHealth=2 → death.
    const r2 = tickPet({ pet: r1.pet, rollIllness: 0.99, rollSicknessKind: 0 });
    expect(r2.died).toBe(true);
    expect(r2.causeOfDeath === 'starvation' || r2.causeOfDeath === 'illness').toBe(true);
  });

  it('skips dead pets', () => {
    const r = tickPet({ pet: pet({ isDead: true, age: 100 }), rollIllness: 0, rollSicknessKind: 0 });
    expect(r.died).toBe(false);
    expect(r.pet.age).toBe(100);
  });
});

describe('tickAllPets', () => {
  it('processes every pet in the list and collects deaths', () => {
    const list = [
      pet({ id: 'a', age: 15 * 52 - 1 }), // about to old-age
      pet({ id: 'b', age: 100 }),
    ];
    const { pets, deaths } = tickAllPets(list, () => 0.99);
    expect(pets.length).toBe(2);
    expect(deaths.length).toBe(1);
    expect(deaths[0].pet.id).toBe('a');
  });
});
