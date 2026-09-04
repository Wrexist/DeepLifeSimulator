/**
 * WHAT THE EVENT PIPELINE ACTUALLY DELIVERS — Master Program 13, Phase 2.
 *
 * Manual: `RUN_EVENT_TELEMETRY=1 npx jest eventTelemetry --silent=false`
 * (`DUMP=<file>` writes the per-life fingerprints as JSON, `LIVES=<n>` sets the
 * cohort size, `WEEKS=<n>` the horizon).
 *
 * Program 12 observed that doubling an event's weight changed nothing — same
 * event, same week, all four lives — and reported it without explaining it.
 * This measures the pipeline itself rather than one feature's experience of it:
 * how many DIFFERENT events a life sees, how much two lives OVERLAP, and
 * whether a life replays identically.
 *
 * The fingerprint is the ordered list of `weeksLived:eventId` a life actually
 * ANSWERED, read from `eventLog` — the game's own record, not the test's.
 *
 * The persona answers everything it is offered, because a persona that never
 * opens a modal measures a blocked channel (`tasks/lessons.md`, three times).
 */
import {
  runPersona,
  answerPendingEvents,
  answerLifeMoment,
  meetIfOffered,
  type SimPolicy,
  type SimWeekContext,
  type SimResult,
} from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';

const RUN = process.env.RUN_EVENT_TELEMETRY === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(4 * 60 * 60 * 1000);

const LIVES = Number(process.env.LIVES ?? 50);
const WEEKS = Number(process.env.WEEKS ?? 100);

/** Answers everything the game raises, so the channel is never blocked. */
function attentivePlayer(): SimPolicy {
  const inner = PERSONAS['A average']();
  return async (ctx: SimWeekContext) => {
    await inner(ctx);
    await meetIfOffered(ctx);
    await answerPendingEvents(ctx);
    await answerLifeMoment(ctx);
  };
}

/** `weeksLived:eventId` for everything the life answered, in order. */
export function fingerprintOf(r: SimResult): string[] {
  return (r.finalState.eventLog ?? [])
    .filter((e) => e && typeof e.id === 'string')
    .map((e) => `${e.weeksLived ?? e.week}:${e.id}`);
}

/** Jaccard overlap of two fingerprints, by event id alone (order-free). */
function idOverlap(a: string[], b: string[]): number {
  const ids = (f: string[]) => new Set(f.map((x) => x.split(':').slice(1).join(':')));
  const A = ids(a);
  const B = ids(b);
  if (A.size === 0 && B.size === 0) return 1;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return shared / new Set([...A, ...B]).size;
}

/** Fraction of `week:id` pairs two lives have EXACTLY in common. */
function exactOverlap(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return shared / new Set([...A, ...B]).size;
}

d('what the event pipeline delivers across many lives', () => {
  it('measures reach, overlap and replayability', async () => {
    const runs: { seed: number; fp: string[]; result: SimResult }[] = [];

    for (let seed = 1; seed <= LIVES; seed++) {
      const r = await runPersona({
        name: `life-${seed}`,
        scenarioId: 'food_courier',
        seed,
        weeks: WEEKS,
        policy: attentivePlayer(),
      });
      runs.push({ seed, fp: fingerprintOf(r), result: r });
    }

    const counts = runs.map((r) => r.fp.length);
    const uniqueIds = new Set(runs.flatMap((r) => r.fp.map((x) => x.split(':').slice(1).join(':'))));

    // Pairwise overlap across the whole cohort.
    let idSum = 0;
    let exactSum = 0;
    let pairs = 0;
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        idSum += idOverlap(runs[i].fp, runs[j].fp);
        exactSum += exactOverlap(runs[i].fp, runs[j].fp);
        pairs++;
      }
    }

    // How many lives share a byte-identical fingerprint with life 1?
    const identicalToFirst = runs.filter(
      (r) => r.fp.join('|') === runs[0].fp.join('|'),
    ).length;

    const lines = [
      `lives=${LIVES} weeks=${WEEKS}`,
      `events answered per life: min ${Math.min(...counts)} / mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)} / max ${Math.max(...counts)}`,
      `distinct event ids across ALL ${LIVES} lives: ${uniqueIds.size}`,
      `mean pairwise ID overlap:    ${((idSum / pairs) * 100).toFixed(1)}%`,
      `mean pairwise EXACT overlap: ${((exactSum / pairs) * 100).toFixed(1)}%  (same event, same week)`,
      `lives byte-identical to life 1: ${identicalToFirst} / ${LIVES}`,
      '',
      'first 12 of life 1: ' + runs[0].fp.slice(0, 12).join(' '),
      'first 12 of life 2: ' + (runs[1]?.fp.slice(0, 12).join(' ') ?? '-'),
    ];
    for (const l of lines) console.log(l);

    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(
        process.env.DUMP,
        JSON.stringify(
          {
            lives: LIVES,
            weeks: WEEKS,
            summary: lines,
            fingerprints: Object.fromEntries(runs.map((r) => [r.seed, r.fp])),
          },
          null,
          1,
        ),
      );
    }
    expect(runs).toHaveLength(LIVES);
  });

  it('the SAME life replays byte-identically', async () => {
    const once = await runPersona({
      name: 'replay-a', scenarioId: 'food_courier', seed: 7, weeks: 60, policy: attentivePlayer(),
    });
    const twice = await runPersona({
      name: 'replay-b', scenarioId: 'food_courier', seed: 7, weeks: 60, policy: attentivePlayer(),
    });
    expect(fingerprintOf(twice)).toEqual(fingerprintOf(once));
  });
});
