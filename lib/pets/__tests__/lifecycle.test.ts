import { ageInYears, bandFor, isPastLifespan, lifeStage } from '../lifecycle';
import { findBreed } from '../catalog';
import { Pet } from '@/contexts/game/types';

const WPY = 52;

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'p1',
    name: 'Rex',
    type: 'dog',
    age: 0,
    hunger: 100,
    happiness: 100,
    health: 100,
    ...over,
  } as Pet;
}

describe('bandFor', () => {
  it('returns juvenile for <10% lifespan', () => {
    expect(bandFor(0.05).stage).toBe('juvenile');
  });
  it('returns adult mid-life', () => {
    expect(bandFor(0.5).stage).toBe('adult');
  });
  it('returns elderly above 90%', () => {
    expect(bandFor(0.95).stage).toBe('elderly');
  });
});

describe('lifeStage', () => {
  it('classifies a young dog as young', () => {
    // dog lifespan = 15y = 780w; 4y = 208w → 26% of life → "young"
    expect(lifeStage(pet({ age: 4 * WPY }))).toBe('young');
  });
  it('classifies an old turtle as elderly', () => {
    // turtle lifespan = 30y = 1560w; 28y = 1456w → 93% → elderly
    expect(lifeStage(pet({ type: 'turtle', age: 28 * WPY }))).toBe('elderly');
  });
  it('returns adult for unknown breed', () => {
    expect(lifeStage(pet({ type: 'fictional' }))).toBe('adult');
  });
});

describe('isPastLifespan', () => {
  it('returns true at exact lifespan', () => {
    const dog = findBreed('dog')!;
    expect(isPastLifespan(pet({ age: dog.lifespan * WPY }))).toBe(true);
  });
  it('returns false mid-life', () => {
    expect(isPastLifespan(pet({ age: 5 * WPY }))).toBe(false);
  });
});

describe('ageInYears', () => {
  it('floors to whole years', () => {
    expect(ageInYears(pet({ age: 3 * WPY + 20 }))).toBe(3);
  });
});
