import { evaluatePetForCompetition, resolveCompetition } from '../competition';
import { Pet } from '@/contexts/game/types';

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'p1',
    name: 'Rex',
    type: 'dog',
    age: 100,
    hunger: 100,
    happiness: 100,
    health: 100,
    energy: 100,
    ...over,
  } as Pet;
}

describe('evaluatePetForCompetition', () => {
  it('returns null for unknown competition id', () => {
    expect(evaluatePetForCompetition(pet(), 'nope')).toBeNull();
  });

  it('reports meetsRequirement true when stat is above threshold', () => {
    const r = evaluatePetForCompetition(pet({ happiness: 90 }), 'beauty')!;
    expect(r.meetsRequirement).toBe(true);
    expect(r.winProbability).toBeGreaterThanOrEqual(0.4);
  });

  it('reports meetsRequirement false when stat is too low', () => {
    const r = evaluatePetForCompetition(pet({ happiness: 30 }), 'beauty')!;
    expect(r.meetsRequirement).toBe(false);
    expect(r.winProbability).toBeLessThan(0.4);
  });

  it('caps win probability at 0.9', () => {
    const r = evaluatePetForCompetition(pet({ happiness: 100, competitionWins: 10 }), 'beauty')!;
    expect(r.winProbability).toBeLessThanOrEqual(0.9);
  });

  it('aggregate competition uses mean of three stats', () => {
    const r = evaluatePetForCompetition(pet({ happiness: 80, health: 70, energy: 75 }), 'championship')!;
    expect(r.gatingStat).toBe('aggregate');
    expect(r.gatingValue).toBe(75);
  });
});

describe('resolveCompetition', () => {
  it('returns won=true when roll is below probability', () => {
    const r = resolveCompetition(pet({ happiness: 90 }), 'beauty', 0.01)!;
    expect(r.won).toBe(true);
    expect(r.payoutDelta).toBe(500);
    expect(r.pet.competitionWins).toBe(1);
  });

  it('returns won=false when roll exceeds probability', () => {
    const r = resolveCompetition(pet({ happiness: 30 }), 'beauty', 0.99)!;
    expect(r.won).toBe(false);
    expect(r.payoutDelta).toBe(-50); // entry fee loss
  });
});
