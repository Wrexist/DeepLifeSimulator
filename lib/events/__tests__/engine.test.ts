import { rollWeeklyEvents, eventTemplates } from '../engine';
import { GameState } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function createState(overrides: Partial<GameState>): GameState {
  return createTestGameState({
    stats: { health: 40, happiness: 40, energy: 40, fitness: 0, money: 50, reputation: 0, goldBars: 0 },
    relationships: [{ id: 'f1', name: 'Alex', type: 'friend', relationshipScore: 20, personality: '', gender: 'male', age: 20 }],
    ...overrides,
  });
}

describe('events engine', () => {
  it('provides at least twelve event templates', () => {
    expect(eventTemplates.length).toBeGreaterThanOrEqual(12);
  });

  it('generates events based on state risk', () => {
    // Mock Math.random to return 0.1 (low enough to pass base event chance)
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const events = rollWeeklyEvents(createState({}));
    spy.mockRestore();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].choices.length).toBeGreaterThan(0);
  });

  it('limits events to at most two per week', () => {
    // Mock Math.random to return 0.1 (low enough to pass base event chance)
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const events = rollWeeklyEvents(createState({}));
    spy.mockRestore();
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it('respects the random frequency (approximately 1 in 4 weeks)', () => {
    // Test multiple runs to verify the random frequency
    let eventsGenerated = 0;
    const testRuns = 100;
    
    for (let i = 0; i < testRuns; i++) {
      const events = rollWeeklyEvents(createState({}));
      if (events.length > 0) {
        eventsGenerated++;
      }
    }
    
    // Should be approximately 20-30% of the time (allowing for randomness)
    const eventRate = eventsGenerated / testRuns;
    expect(eventRate).toBeGreaterThan(0.1); // At least 10%
    expect(eventRate).toBeLessThan(0.4); // At most 40%
  });
});

