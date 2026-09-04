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
    //
    // "Dominates" is not "always wins", and until Program 13 this test could
    // not tell the difference. The weekly pick was seeded on the WEEK alone, so
    // every life drew the same number and this assertion was really pinning one
    // fixed draw that happened to land inside the secret's span. With the roll
    // salted per life it is a real 100-against-the-pool weight: measured over
    // 24 lineages it wins 20 times, losing to `near_miss_choke`,
    // `cooking_disaster`, `neighbor_conflict` and `lottery_win`.
    //
    // So the test asserts what it actually means — that the legendary tag RIDES
    // onto the generated event — across a spread of lives, plus the domination
    // itself as the statistic it is.
    const lineages = Array.from({ length: 12 }, (_, i) => `rarity-probe-${i}`);
    let wins = 0;
    let stamped = 0;
    for (const lineageId of lineages) {
      const state = createTestGameState({
        weeksLived: 600,
        lifeStartWeek: 0,
        lastEventWeeksLived: 500,
        stats: { money: 777_777 },
        lineageId,
      });
      const events = rollWeeklyEvents(state);
      expect(events.length).toBeGreaterThan(0);
      const secret = events.find((e) => e.id === 'secret_lucky_777');
      if (!secret) continue;
      wins += 1;
      if (secret.rarity === 'legendary') stamped += 1;
    }
    // It has to actually win most of the time, or the weight means nothing…
    expect(wins).toBeGreaterThanOrEqual(8);
    // …and every time it wins, it arrives carrying its label.
    expect(stamped).toBe(wins);
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
