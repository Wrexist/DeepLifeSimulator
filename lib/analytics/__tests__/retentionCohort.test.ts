import {
  createCohortRecord,
  parseCohortRecord,
  rawDayIndex,
  recordSession,
} from '@/lib/analytics/retentionCohort';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 1);

describe('createCohortRecord', () => {
  it('anchors a genuinely new install and marks it usable', () => {
    const record = createCohortRecord(T0, false);
    expect(record.firstSeenMs).toBe(T0);
    expect(record.anchorEstimated).toBe(false);
    expect(record.lastDayIndex).toBe(0);
    expect(record.sessions).toBe(0);
  });

  it('marks a player who predates the feature as estimated', () => {
    // Their real install date is unknowable, so anchoring today would read as a
    // brand-new install and inflate the cohort. The flag is how the sink
    // excludes them instead of averaging them in.
    expect(createCohortRecord(T0, true).anchorEstimated).toBe(true);
  });
});

describe('rawDayIndex', () => {
  it('floors, so day 0 spans the whole first 24 hours', () => {
    const record = createCohortRecord(T0, false);
    expect(rawDayIndex(record, T0)).toBe(0);
    expect(rawDayIndex(record, T0 + DAY - 1)).toBe(0);
    expect(rawDayIndex(record, T0 + DAY)).toBe(1);
    expect(rawDayIndex(record, T0 + 7 * DAY + 3_600_000)).toBe(7);
  });

  it('never returns a negative index or NaN', () => {
    const record = createCohortRecord(T0, false);
    expect(rawDayIndex(record, T0 - 5 * DAY)).toBe(0);
    expect(rawDayIndex(record, NaN)).toBe(0);
    expect(rawDayIndex({ ...record, firstSeenMs: NaN }, T0)).toBe(0);
  });
});

describe('recordSession', () => {
  it('reports day 0 and one session on the very first launch', () => {
    const { next, snapshot } = recordSession(createCohortRecord(T0, false), T0);
    expect(snapshot).toMatchObject({
      dayIndex: 0,
      daysSeen: 1,
      sessions: 1,
      isNewDay: true,
      anchorEstimated: false,
    });
    expect(next.lastDayIndex).toBe(0);
  });

  it('counts a second session on the same day without advancing the day', () => {
    const first = recordSession(createCohortRecord(T0, false), T0);
    const second = recordSession(first.next, T0 + 3_600_000);
    expect(second.snapshot.dayIndex).toBe(0);
    expect(second.snapshot.daysSeen).toBe(1);
    expect(second.snapshot.sessions).toBe(2);
    expect(second.snapshot.isNewDay).toBe(false);
  });

  it('advances the day index on a return, which is what D1/D7 are counted from', () => {
    let record = createCohortRecord(T0, false);
    record = recordSession(record, T0).next;
    const d1 = recordSession(record, T0 + DAY);
    expect(d1.snapshot.dayIndex).toBe(1);
    expect(d1.snapshot.isNewDay).toBe(true);
    const d7 = recordSession(d1.next, T0 + 7 * DAY);
    expect(d7.snapshot.dayIndex).toBe(7);
    expect(d7.snapshot.daysSeen).toBe(3);
  });

  it('is MONOTONIC — a rewound clock cannot walk the cohort backwards', () => {
    // The one real data-quality threat here. Nothing is paid out, so there is
    // no incentive to move the clock; the risk is an accidental change (device
    // reset, timezone) manufacturing a second "day 3" and double-counting the
    // install in that bucket.
    let record = createCohortRecord(T0, false);
    record = recordSession(record, T0 + 5 * DAY).next;
    expect(record.lastDayIndex).toBe(5);

    const rewound = recordSession(record, T0 + 2 * DAY);
    expect(rewound.snapshot.dayIndex).toBe(5);
    expect(rewound.snapshot.isNewDay).toBe(false);
    expect(rewound.next.lastDayIndex).toBe(5);
    // The session still counts — the player really did play.
    expect(rewound.snapshot.sessions).toBe(2);
  });

  it('counts each distinct day once, however many sessions it holds', () => {
    let record = createCohortRecord(T0, false);
    for (const at of [T0, T0 + 1000, T0 + DAY, T0 + DAY + 1000, T0 + 3 * DAY]) {
      record = recordSession(record, at).next;
    }
    expect(record.daysSeen).toBe(3);
    expect(record.sessions).toBe(5);
    expect(record.lastDayIndex).toBe(3);
  });

  it('carries the estimated flag through every session', () => {
    let record = createCohortRecord(T0, true);
    const first = recordSession(record, T0);
    record = first.next;
    const later = recordSession(record, T0 + 30 * DAY);
    expect(first.snapshot.anchorEstimated).toBe(true);
    expect(later.snapshot.anchorEstimated).toBe(true);
  });
});

describe('parseCohortRecord', () => {
  it('round-trips a written record', () => {
    const record = createCohortRecord(T0, false);
    expect(parseCohortRecord(JSON.stringify(record))).toEqual(record);
  });

  it('returns null for anything it cannot trust', () => {
    // A half-written record would otherwise produce NaN day indices that
    // silently poison the cohort instead of failing loudly. Null makes the
    // caller mint a fresh, correctly-flagged record.
    for (const raw of [
      null,
      undefined,
      '',
      'not json',
      '{}',
      '{"firstSeenMs":"nope","lastDayIndex":0,"daysSeen":0,"sessions":0}',
      '{"firstSeenMs":null,"lastDayIndex":0,"daysSeen":0,"sessions":0}',
      '{"firstSeenMs":1,"lastDayIndex":0,"daysSeen":0}',
    ]) {
      expect(parseCohortRecord(raw as never)).toBeNull();
    }
  });

  it('treats a record with no flag as estimated — the conservative direction', () => {
    const parsed = parseCohortRecord(
      '{"firstSeenMs":1,"lastDayIndex":2,"daysSeen":2,"sessions":3}',
    );
    expect(parsed?.anchorEstimated).toBe(true);
  });

  it('clamps stored negatives rather than trusting them', () => {
    const parsed = parseCohortRecord(
      '{"firstSeenMs":1,"anchorEstimated":false,"lastDayIndex":-4,"daysSeen":-1,"sessions":-9}',
    );
    expect(parsed).toMatchObject({ lastDayIndex: 0, daysSeen: 0, sessions: 0 });
  });
});
