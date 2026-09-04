/**
 * An event id may appear in the pending queue AT MOST ONCE.
 *
 * PLAYER REPORT (BBQ, 2026-08-31): "There are too many frequent pop ups of
 * events that have already happened. They pop up every time the game is
 * refreshed. In this manner are they re-occurring."
 *
 * `rollWeeklyEvents` never consulted `pendingEvents`, and an event id IS its
 * template id, so a template re-rolled while an unresolved copy was still queued
 * appended a second, indistinguishable entry. The player then saw the same
 * prompt twice, and answering it cleared only one - `resolveEvent` removes a
 * single entry by index - so the survivor reappeared on the next open.
 */
import { applyWeeklyEvents, MAX_PENDING_EVENTS } from '@/contexts/game/actions/weekly/applyWeeklyEvents';
import * as engine from '@/lib/events/engine';
import type { GameState } from '@/contexts/game/types';

/** The reducer only forwards this into the synthetic state it hands the roller. */
const ECONOMY = {} as GameState['economy'];

const anEvent = (id: string) => ({ id, description: id, choices: [{ id: 'ok', text: 'OK', effects: {} }] });

function stateWith(pending: unknown[]): GameState {
  return { pendingEvents: pending, weeksLived: 100 } as unknown as GameState;
}

function run(prevPending: unknown[], rolled: unknown[]) {
  const spy = jest.spyOn(engine, 'rollWeeklyEvents').mockReturnValue(rolled as never);
  try {
    return applyWeeklyEvents({
      prevState: stateWith(prevPending),
      updatedEconomy: ECONOMY,
      nextWeeksLived: 101,
      nextWeek: 1,
    });
  } finally {
    spy.mockRestore();
  }
}

describe('applyWeeklyEvents - the pending queue holds each event id once', () => {
  it('appends a genuinely new event', () => {
    const { updatedPendingEvents, newEventCount } = run([anEvent('a')], [anEvent('b')]);
    expect(updatedPendingEvents.map((e) => e.id)).toEqual(['a', 'b']);
    expect(newEventCount).toBe(1);
  });

  it('drops a re-roll of an event still sitting unresolved in the queue', () => {
    const { updatedPendingEvents } = run([anEvent('wedding')], [anEvent('wedding')]);
    expect(updatedPendingEvents.map((e) => e.id)).toEqual(['wedding']);
  });

  it('keeps the QUEUED copy, not the fresh one', () => {
    // The queued copy may already be stamped, routed to the mail app or carrying
    // an expiry - and it is the one the player has already been shown.
    const queued = { ...anEvent('jury_summons'), channel: 'mail', generatedAtWeeksLived: 90 };
    const { updatedPendingEvents } = run([queued], [anEvent('jury_summons')]);
    expect(updatedPendingEvents).toEqual([queued]);
  });

  it('deduplicates within a single tick as well as against the queue', () => {
    // One tick rolls from several sources (economic, seasonal, chain, random).
    const { updatedPendingEvents } = run([], [anEvent('a'), anEvent('a'), anEvent('b')]);
    expect(updatedPendingEvents.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('lets the same template return once the player has answered it', () => {
    const { updatedPendingEvents } = run([anEvent('other')], [anEvent('wedding')]);
    expect(updatedPendingEvents.map((e) => e.id)).toEqual(['other', 'wedding']);
  });

  it('stamps the generating week on what it does append', () => {
    const { updatedPendingEvents } = run([], [anEvent('a')]);
    expect(updatedPendingEvents[0].generatedAtWeeksLived).toBe(101);
  });

  it('still caps the queue by dropping the oldest', () => {
    const full = Array.from({ length: MAX_PENDING_EVENTS }, (_, i) => anEvent(`e${i}`));
    const { updatedPendingEvents } = run(full, [anEvent('newest')]);
    expect(updatedPendingEvents).toHaveLength(MAX_PENDING_EVENTS);
    expect(updatedPendingEvents[0].id).toBe('e1');
    expect(updatedPendingEvents[MAX_PENDING_EVENTS - 1].id).toBe('newest');
  });

  it('survives a generator that throws (the tick must not lose the week)', () => {
    const spy = jest.spyOn(engine, 'rollWeeklyEvents').mockImplementation(() => {
      throw new Error('catalog exploded');
    });
    try {
      const { updatedPendingEvents, newEventCount } = applyWeeklyEvents({
        prevState: stateWith([anEvent('a')]),
        updatedEconomy: ECONOMY,
        nextWeeksLived: 101,
        nextWeek: 1,
      });
      expect(updatedPendingEvents.map((e) => e.id)).toEqual(['a']);
      expect(newEventCount).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
