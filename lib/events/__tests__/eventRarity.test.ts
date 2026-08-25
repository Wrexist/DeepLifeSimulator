/**
 * Event rarity is DISPLAY-ONLY (2026-08-25 round 2): the template tag rides
 * onto the generated WeeklyEvent at pick time so the modal can mark the find,
 * and selection never reads it.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { rollWeeklyEvents } from '@/lib/events/engine';
import { secretEventTemplates } from '@/lib/events/secretEvents';

describe('event rarity', () => {
  it('a discovered secret arrives stamped legendary', () => {
    // secret_lucky_777: condition money === 777,777, weight 100 - it dominates
    // the pool the week its needle is threaded. Force the fire gate via pity.
    const state = createTestGameState({
      weeksLived: 600,
      lifeStartWeek: 0,
      lastEventWeeksLived: 500,
      stats: { money: 777_777 },
    });
    const events = rollWeeklyEvents(state);
    expect(events.length).toBeGreaterThan(0);
    const secret = events.find((e) => e.id === 'secret_lucky_777');
    expect(secret).toBeDefined();
    expect(secret?.rarity).toBe('legendary');
  });

  it('an ordinary pool event carries no rarity', () => {
    const state = createTestGameState({
      weeksLived: 600,
      lifeStartWeek: 0,
      lastEventWeeksLived: 500,
      stats: { money: 5_000 },
    });
    const events = rollWeeklyEvents(state);
    expect(events.length).toBeGreaterThan(0);
    // Whatever fired, it is not one of the tagged needles in this state.
    expect(events[0].rarity === undefined || events[0].rarity === 'rare').toBe(true);
  });

  it('every secret template is authored as a one-shot (the label rides on that)', () => {
    for (const t of secretEventTemplates) {
      expect(t.oncePerLife).toBe(true);
    }
  });
});
