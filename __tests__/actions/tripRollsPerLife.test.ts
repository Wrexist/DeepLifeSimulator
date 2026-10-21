/**
 * Trip events are a function of the LIFE and the trip, not the trip alone.
 *
 * `returnFromTrip` keyed its roller on `${destinationId}:${startWeek}`, so two
 * different lives that booked the same destination on the same week drew the
 * same lost wallet / tourist trap (CLAUDE.md §4.3: never key a life-affecting
 * roll on the week alone).
 */
import type React from 'react';
import { returnFromTrip } from '@/contexts/game/actions/TravelActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, TravelState } from '@/contexts/game/types';

const deps = { updateStats, updateMoney };

function onTrip(lineageId: string, startWeek: number): GameState {
  const travel: TravelState = {
    currentTrip: { destinationId: 'tokyo', returnWeek: startWeek + 1, startWeek },
    visitedDestinations: ['tokyo'],
    passportOwned: true,
    businessOpportunities: {},
    travelHistory: [],
    passportMilestones: [],
  };
  return createTestGameState({ lineageId, weeksLived: startWeek + 2, travel });
}

function eventsFor(lineageId: string, startWeek: number): string {
  const snap = onTrip(lineageId, startWeek);
  let state = snap;
  const set: React.Dispatch<React.SetStateAction<GameState>> = (u) => {
    state = typeof u === 'function' ? u(state) : u;
  };
  const r = returnFromTrip(snap, set, deps);
  expect(r.success).toBe(true);
  return JSON.stringify((r.events ?? []).map((e) => e.id));
}

describe('trip events per life', () => {
  const weeks = Array.from({ length: 40 }, (_, i) => 100 + i * 7);

  it('the same life and trip always rolls the same events (no reload reroll)', () => {
    for (const w of weeks.slice(0, 5)) {
      expect(eventsFor('life-a', w)).toBe(eventsFor('life-a', w));
    }
  });

  it('two lives booking the same trip on the same week do not share every outcome', () => {
    const a = weeks.map((w) => eventsFor('life-a', w));
    const b = weeks.map((w) => eventsFor('life-b', w));
    expect(a).not.toEqual(b);
  });
});
