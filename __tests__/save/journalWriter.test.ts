/**
 * The journal finally gets a writer.
 *
 * `journal: JournalEntry[]` shipped in `initialState` with a full reader
 * (search, category filters, detail view), a pruner in `saveQueue`, and a
 * consumer in the life-story generator — and **no writer anywhere in the repo**.
 * So `Journal.tsx` always rendered "No journal entries yet", on the same
 * Progress screen the Help FAQ tells players to visit. Combined with the muted
 * `info` channel, the player had no way at all to review a week.
 *
 * The property that matters most here is IDEMPOTENCE: this runs inside the week
 * updater, and React 19 StrictMode can invoke an updater twice (the `R10-2`
 * dedupe on the notification flush exists for exactly that reason).
 */

import fs from 'fs';
import path from 'path';
import {
  appendWeekToJournal,
  MAX_JOURNAL_ENTRIES,
} from '@/lib/lifeMoments/journalWriter';
import type { JournalEntry } from '@/contexts/game/types';

const note = (id: string, title = 'Bills Overdue', message = 'You came up short.') => ({
  id,
  title,
  message,
});

describe('recording a week', () => {
  it('appends an entry per notable notification', () => {
    const out = appendWeekToJournal([], [note('arrears-312'), note('promoted-312', 'Promoted')], 312);

    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('arrears-312');
    expect(out[0].atWeek).toBe(312);
    expect(out[0].title).toBe('Bills Overdue');
    expect(out[0].details).toBe('You came up short.');
  });

  it('returns the SAME array when there is nothing to record', () => {
    // A quiet week must cause no state churn in the tick.
    const existing: JournalEntry[] = [];
    expect(appendWeekToJournal(existing, [], 10)).toBe(existing);
    expect(appendWeekToJournal(existing, undefined, 10)).toBe(existing);
    expect(appendWeekToJournal(existing, [note('weekly-summary')], 10)).toBe(existing);
  });

  it('keeps entries from previous weeks', () => {
    const week1 = appendWeekToJournal([], [note('arrears-1')], 1);
    const week2 = appendWeekToJournal(week1, [note('arrears-2')], 2);

    expect(week2.map((e) => e.id)).toEqual(['arrears-1', 'arrears-2']);
  });
});

describe('idempotence - a StrictMode double-invoke must not double-append', () => {
  it('running the same week twice produces the same journal', () => {
    const notes = [note('arrears-312'), note('tenancy-312', 'Evicted')];

    const once = appendWeekToJournal([], notes, 312);
    const twice = appendWeekToJournal(once, notes, 312);

    expect(twice).toEqual(once);
    // And it short-circuits to the same reference, so no churn either.
    expect(twice).toBe(once);
  });

  it('dedupes within a single call', () => {
    const out = appendWeekToJournal([], [note('arrears-1'), note('arrears-1')], 1);
    expect(out).toHaveLength(1);
  });

  it('a later week with a same-named event still records - ids carry the week', () => {
    const week1 = appendWeekToJournal([], [note('arrears-1')], 1);
    const week9 = appendWeekToJournal(week1, [note('arrears-9')], 9);

    expect(week9).toHaveLength(2);
  });
});

describe('what does not belong in a permanent record', () => {
  it.each(['weekly-summary', 'ad-courtesy-3', 'promo-premium', 'daily-gems-4'])(
    'skips %s',
    (id) => {
      expect(appendWeekToJournal([], [note(id)], 5)).toHaveLength(0);
    }
  );

  it('records a real subsystem event', () => {
    expect(appendWeekToJournal([], [note('arrears-5')], 5)).toHaveLength(1);
  });

  it('skips an entry with no title and no message', () => {
    expect(appendWeekToJournal([], [note('x-1', '', '')], 5)).toHaveLength(0);
  });
});

describe('bounds and robustness', () => {
  it('caps at the same limit saveQueue prunes to, keeping the newest', () => {
    // Otherwise the in-memory array and the persisted one disagree.
    let journal: JournalEntry[] = [];
    for (let week = 0; week < MAX_JOURNAL_ENTRIES + 20; week += 1) {
      journal = appendWeekToJournal(journal, [note(`e-${week}`)], week);
    }

    expect(journal).toHaveLength(MAX_JOURNAL_ENTRIES);
    expect(journal[journal.length - 1].id).toBe(`e-${MAX_JOURNAL_ENTRIES + 19}`);
  });

  it('matches the pruner in saveQueue', () => {
    const queue = fs.readFileSync(
      path.join(__dirname, '../../utils/saveQueue.ts'),
      'utf8'
    );
    expect(queue).toMatch(new RegExp(`journal\\.length > ${MAX_JOURNAL_ENTRIES}`));
  });

  it('tolerates a missing or corrupt existing journal', () => {
    expect(appendWeekToJournal(undefined, [note('a-1')], 1)).toHaveLength(1);
    expect(appendWeekToJournal(null, [note('a-1')], 1)).toHaveLength(1);
  });

  it('never writes NaN into atWeek', () => {
    const out = appendWeekToJournal([], [note('a-1')], NaN);
    expect(out[0].atWeek).toBe(0);
  });

  it('tags entries so the reader can categorise them', () => {
    const out = appendWeekToJournal([], [note('promo-x1', 'Promoted', 'New salary')], 1);
    // (that id is excluded - use a real one)
    const real = appendWeekToJournal([], [note('career-1', 'Promoted', 'New salary')], 1);
    expect(out).toHaveLength(0);
    expect(real[0].tags).toContain('career');
  });
});

describe('the writer is REACHABLE from the week loop', () => {
  // The whole reason this exists: the journal had a reader, a pruner and a
  // consumer, and no writer. A writer nothing calls would be the same bug.
  it('the tick appends to journal in its state assembly', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../contexts/game/GameActionsContext.tsx'),
      'utf8'
    );
    expect(source).toMatch(/journal: appendWeekToJournal\(prevState\.journal, pendingNotifications/);
  });
});
