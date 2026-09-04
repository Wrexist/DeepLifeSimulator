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
    // Routine event frequency is intentionally rare now, so force the pity
    // system (drought beyond the late-game pity threshold) to deterministically
    // guarantee an event and verify the generation path still works.
    const events = rollWeeklyEvents(
      createState({ weeksLived: 60, lastEventWeeksLived: 30 })
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].choices.length).toBeGreaterThan(0);
  });

  it('limits events to at most two per week', () => {
    // Force a guaranteed event via pity, then assert the per-week cap holds.
    const events = rollWeeklyEvents(
      createState({ weeksLived: 60, lastEventWeeksLived: 30 })
    );
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it('respects deterministic weekly event frequency across mid-game weeks', () => {
    // Use distinct absolute weeks so deterministic seeded randomness is exercised.
    // Place the last event well outside the smoothness cooldown (10 > late gap of
    // 4) so the routine random frequency - not the cooldown - is what's measured.
    //
    // SAMPLE SIZE (2026-09-04). This ran 100 weeks, which is not enough weeks to
    // bound a rate whose true value sits within 0.002 of the ceiling. Measured
    // over 2000 weeks the cadence is ~0.218; measured over 100 it swings 0.16 to
    // 0.23 purely on which weeks the window happens to cover, and TWO windows
    // (starting at week 160 and week 360) already exceeded this test's own 0.22
    // ceiling before anything changed. So a pass meant "this particular draw
    // landed low", and a fail meant nothing about the frequency gate.
    //
    // The bounds are unchanged - they are the owner's cadence range and lowering
    // a gate to get unstuck is what CLAUDE.md 8 forbids. What changed is that the
    // sample is now large enough for them to be a statement about the rate rather
    // than about one draw. It caught nothing when it failed: the season relabel
    // (Jan-Mar is Winter, so seasonal events stop firing a quarter early) moved
    // the 2000-week rate 0.215 -> 0.218, while the sampled window moved 0.210 ->
    // 0.230. The seasonal share rose because Halloween and Thanksgiving got their
    // real three-week windows back, having been clobbered to one week each by
    // overlapping holiday assignments.
    let eventsGenerated = 0;
    const testRuns = 2000;

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

    // Late-game cadence: the ~12% frequency gate now guarantees a weighted
    // pick when it passes (bug report 2026-07-03: players effectively never
    // saw events because a second 6% per-template roll ran after the gate).
    const eventRate = eventsGenerated / testRuns;
    expect(eventRate).toBeGreaterThanOrEqual(0.08);
    expect(eventRate).toBeLessThanOrEqual(0.22);
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

  it('VARIETY: surfaces different events across weeks instead of one fixed rotation', () => {
    // Regression (bug report 2026-07-03): pity always forced the single
    // highest-weight template, so players saw the same event forever.
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const weeksLived = 60 + i * 3;
      const events = rollWeeklyEvents(
        createState({ weeksLived, lastEventWeeksLived: weeksLived - 30 })
      );
      for (const e of events) seen.add(e.id.split('-')[0]);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
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

