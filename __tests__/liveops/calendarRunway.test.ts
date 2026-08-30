/**
 * The runway checker's parser, pinned against the real catalogue.
 *
 * `scripts/check-liveops-calendar.cjs` reads `lib/liveops/catalogue.ts` as TEXT,
 * because it is a plain node script with no TypeScript build in front of it.
 * That is a reasonable trade and a fragile one: the first version assumed
 * four-space indentation where the file uses two, and the second anchored on
 * the first `[` after the name - which belongs to the type annotation
 * `readonly LiveEventDefinition[]`. Both silently parsed ZERO events and
 * reported the catalogue as dead.
 *
 * A false alarm is worse than no check. Someone who sees this fail once for a
 * reason that turns out to be imaginary learns to skip it, and then it is not
 * there on the day the calendar really has run out. This test is what makes the
 * text parser safe: it compares what the script reads against what the module
 * actually exports, so any reformatting of the catalogue that breaks the parser
 * fails here, in the suite, rather than as a mysterious red preflight.
 */
import { LOCAL_EVENTS } from '@/lib/liveops/catalogue';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const checker = require('../../scripts/check-liveops-calendar.cjs') as {
  readCompiled: () => { events: { id: string; startsAt: number; endsAt: number; kind?: string; stages: string[] | null }[]; error?: string };
  readPublished: () => { events: unknown[]; error?: string; paused?: boolean };
  runwayDays: (events: { startsAt: number; endsAt: number; kind?: string; stages: string[] | null }[], stage: string, now: number) => number;
};

describe('the runway checker reads the real catalogue', () => {
  const parsed = checker.readCompiled();

  it('parses without an error', () => {
    expect(parsed.error).toBeUndefined();
  });

  it('finds exactly the events the module exports', () => {
    // Count AND ids: a parser that finds five of six events reports a shorter
    // runway than the truth, which is the false-alarm direction.
    expect(parsed.events.map((e) => e.id).sort()).toEqual(LOCAL_EVENTS.map((e) => e.id).sort());
  });

  it("reads each event's windows exactly", () => {
    for (const truth of LOCAL_EVENTS) {
      const got = parsed.events.find((e) => e.id === truth.id);
      expect({ id: truth.id, found: !!got }).toEqual({ id: truth.id, found: true });
      expect(got!.startsAt).toBe(Date.parse(truth.startsAt));
      expect(got!.endsAt).toBe(Date.parse(truth.endsAt));
    }
  });

  it('reads the stage targeting, which decides who a gap affects', () => {
    for (const truth of LOCAL_EVENTS) {
      const got = parsed.events.find((e) => e.id === truth.id)!;
      expect(got.stages).toEqual(truth.eligibility?.stages ?? null);
    }
  });

  it('reads the kind, so returning events stay out of the coverage maths', () => {
    for (const truth of LOCAL_EVENTS) {
      expect(parsed.events.find((e) => e.id === truth.id)!.kind).toBe(truth.kind);
    }
  });
});

describe('the published calendar parses too', () => {
  it('reads without an error and finds events', () => {
    const parsed = checker.readPublished();
    expect(parsed.error).toBeUndefined();
    expect(parsed.events.length).toBeGreaterThan(0);
  });
});

describe('runwayDays', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-01-01T00:00:00Z');
  const ev = (startDay: number, endDay: number, stages: string[] | null = null) => ({
    startsAt: now + startDay * DAY,
    endsAt: now + endDay * DAY,
    stages,
  });

  it('reports the LAST covered day, not the first uncovered one', () => {
    // The bug this replaced: a calendar with months of events reported zero
    // runway purely because nothing was running on the day the check ran.
    expect(checker.runwayDays([ev(10, 40)], 'new', now)).toBe(40);
  });

  it('spans a hole rather than stopping at it', () => {
    expect(checker.runwayDays([ev(0, 5), ev(30, 60)], 'new', now)).toBe(60);
  });

  it('is zero for an empty or fully-past calendar', () => {
    expect(checker.runwayDays([], 'new', now)).toBe(0);
    expect(checker.runwayDays([ev(-30, -10)], 'new', now)).toBe(0);
  });

  it('counts only events that target the stage', () => {
    const events = [ev(0, 50, ['late'])];
    expect(checker.runwayDays(events, 'late', now)).toBe(50);
    expect(checker.runwayDays(events, 'new', now)).toBe(0);
  });
});
