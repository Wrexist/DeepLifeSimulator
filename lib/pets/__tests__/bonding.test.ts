import { bondingSummary } from '../bonding';
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

describe('bondingSummary', () => {
  it('returns zero when there are no pets', () => {
    const r = bondingSummary([]);
    expect(r.playerHappinessDelta).toBe(0);
    expect(r.playerHealthDelta).toBe(0);
    expect(r.hasCriticalPet).toBe(false);
  });

  it('rewards keeping a pet very happy', () => {
    const r = bondingSummary([pet({ happiness: 90, health: 80 })]);
    expect(r.playerHappinessDelta).toBeGreaterThan(0);
    expect(r.playerHealthDelta).toBeGreaterThan(0);
  });

  it('flags critical pet when health or hunger is very low', () => {
    const r = bondingSummary([pet({ health: 10 })]);
    expect(r.hasCriticalPet).toBe(true);
  });

  it('saps player happiness for sad pets', () => {
    const r = bondingSummary([pet({ happiness: 10, health: 20 })]);
    expect(r.playerHappinessDelta).toBeLessThanOrEqual(0);
  });

  it('skips dead pets entirely', () => {
    const r = bondingSummary([pet({ isDead: true, happiness: 100, health: 100 })]);
    expect(r.playerHappinessDelta).toBe(0);
  });
});
