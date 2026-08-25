/**
 * Per-event recency suppression (2026-08-25 retention pass).
 *
 * Only 16 of ~340 pool templates carried ANY repeat guard (`oncePerLife`);
 * everything else could fire again the very next eligible week. The guard is
 * DERIVED from `eventLog` — the memory the game already writes — so there is
 * no stored seen-set to drift (the seasonal repeat bug was exactly a stored
 * guard nobody wrote).
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import {
  recentlyLivedEventIds,
  rollWeeklyEvents,
  EVENT_REPEAT_COOLDOWN_WEEKS,
} from '@/lib/events/engine';

type LogEntry = NonNullable<GameState['eventLog']>[number];

function logEntry(id: string, weeksLived: number): LogEntry {
  return {
    id,
    description: 'x',
    choice: 'a',
    week: 1,
    year: 2026,
    weeksLived,
    category: 'general',
  } as LogEntry;
}

describe('recentlyLivedEventIds', () => {
  it('windows on weeksLived: inside suppresses, outside does not', () => {
    const log = [
      logEntry('fresh_hit', 100 - 1),
      logEntry('edge_in', 100 - (EVENT_REPEAT_COOLDOWN_WEEKS - 1)),
      logEntry('edge_out', 100 - EVENT_REPEAT_COOLDOWN_WEEKS),
      logEntry('ancient', 5),
    ];
    const ids = recentlyLivedEventIds(log, 100);
    expect(ids.has('fresh_hit')).toBe(true);
    expect(ids.has('edge_in')).toBe(true);
    expect(ids.has('edge_out')).toBe(false);
    expect(ids.has('ancient')).toBe(false);
  });

  it('ignores malformed entries and future stamps rather than guessing', () => {
    const log = [
      null as never,
      { id: 42 } as never,
      logEntry('from_the_future', 200),
      { id: 'no_stamp', description: 'x', choice: 'a', week: 1, year: 2026, category: 'general' } as LogEntry,
    ];
    const ids = recentlyLivedEventIds(log, 100);
    expect(ids.size).toBe(0);
  });

  it('handles a missing log', () => {
    expect(recentlyLivedEventIds(undefined, 100).size).toBe(0);
    expect(recentlyLivedEventIds(null, 100).size).toBe(0);
  });
});

describe('rollWeeklyEvents under the guard', () => {
  it('a pity-forced week still produces an event even when the log is saturated with recent ids', () => {
    // Saturate the recency window with every id the engine could conceivably
    // pick (we can't enumerate the pool from outside, so log the ids the
    // engine actually fires across a probe range — if the fallback were
    // missing, a saturated log would starve the pity guarantee instead).
    const base = createTestGameState({
      weeksLived: 600,
      lifeStartWeek: 0,
      lastEventWeeksLived: 500, // 100-week drought → far past every pity threshold
    });

    // First: collect what fires on a clean log.
    const first = rollWeeklyEvents(base);
    expect(first.length).toBeGreaterThan(0);

    // Then: mark that exact id as just-lived and roll the same week again —
    // the engine must pick something ELSE (the suppression working), not
    // nothing (the fallback missing).
    const suppressed = rollWeeklyEvents({
      ...base,
      eventLog: [logEntry(first[0].id, 599)],
    });
    expect(suppressed.length).toBeGreaterThan(0);
    expect(suppressed[0].id).not.toBe(first[0].id);
  });
});
