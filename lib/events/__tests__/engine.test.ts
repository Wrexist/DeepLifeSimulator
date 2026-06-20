import { rollWeeklyEvents, eventTemplates } from '../engine';
import { GameState } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function createState(overrides: Partial<GameState>): GameState {
  return createTestGameState({
    stats: { health: 40, happiness: 40, energy: 40, fitness: 0, money: 50, reputation: 0, gems: 0 },
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

  it('respects deterministic weekly event frequency across mid-game weeks', () => {
    // Use distinct absolute weeks so deterministic seeded randomness is exercised.
    // Place the last event well outside the smoothness cooldown (10 > late gap of
    // 4) so the routine random frequency — not the cooldown — is what's measured.
    let eventsGenerated = 0;
    const testRuns = 100;

    for (let i = 0; i < testRuns; i++) {
      const weeksLived = 60 + i;
      const events = rollWeeklyEvents(
        createState({
          weeksLived,
          lastEventWeeksLived: weeksLived - 10,
        })
      );
      if (events.length > 0) {
        eventsGenerated++;
      }
    }

    // Late-game random event frequency is intentionally low (~2-6% observed in deterministic runs).
    const eventRate = eventsGenerated / testRuns;
    expect(eventRate).toBeGreaterThanOrEqual(0.02);
    expect(eventRate).toBeLessThanOrEqual(0.08);
  });

  it('SMOOTHNESS: suppresses discretionary popups during the cooldown window', () => {
    // An event that fired this very week (lastEventWeeksLived == weeksLived) is
    // inside the late-game cooldown gap, so no fresh popup should stack on top.
    let eventsGenerated = 0;
    const testRuns = 100;

    for (let i = 0; i < testRuns; i++) {
      const weeksLived = 60 + i;
      const events = rollWeeklyEvents(
        createState({
          weeksLived,
          // 1 week since the last event — well inside the 4-week late-game gap.
          lastEventWeeksLived: weeksLived - 1,
        })
      );
      if (events.length > 0) {
        eventsGenerated++;
      }
    }

    // Nothing but a pity-guaranteed event (24-week drought) may fire here, and a
    // 1-week-old event is nowhere near pity — so the window stays quiet.
    expect(eventsGenerated).toBe(0);
  });

  it('SMOOTHNESS: still guarantees an event after a long drought (pity)', () => {
    // 30 weeks without an event exceeds the 24-week late-game pity threshold;
    // the cooldown must not be able to starve the player forever.
    const events = rollWeeklyEvents(
      createState({ weeksLived: 200, lastEventWeeksLived: 170 })
    );
    expect(events.length).toBeGreaterThan(0);
  });
});

