/**
 * DOES THE WORLD RESPOND TO A WEIGHT? — Master Program 13, Phase 12.
 *
 * Manual: `RUN_WEIGHT_RESPONSE=1 npx jest eventWeightResponse --silent=false`
 * (`LIVES=<n>`, `WEEKS=<n>`, `TARGET=<event id>`, `SCALE=<n>`, `DUMP=<file>`).
 *
 * Program 12 tried this experiment once, informally: it raised
 * `close_friend_needs_you` from 1.6 to 3.0 and measured NO change at all -
 * same event, same week, in all four lives. The number was reverted rather
 * than shipped on a null result, and the non-response was recorded as a
 * finding about the engine rather than about the event.
 *
 * This is that experiment done properly, and it is the acceptance test for the
 * life-salt fix in `engine.ts`. The mechanism the fix addresses predicts the
 * null result exactly: a week-only seed draws ONE sample of the weighted
 * distribution per week, the SAME sample in every life, so moving one template's
 * span only changes the answer in the rare week where the span happens to
 * straddle that single fixed point. Under a life-salted roll each life draws
 * its own number, so a weight change has to move the DELIVERY RATE across a
 * cohort - or the weights genuinely are inert and the diagnosis was wrong.
 *
 * The experiment mutates the pool entry in place (test-only) and restores it,
 * so both arms run the same code on the same seeds and differ in exactly one
 * number.
 */
import {
  runPersona,
  answerPendingEvents,
  answerLifeMoment,
  meetIfOffered,
  type SimPolicy,
  type SimWeekContext,
} from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { eventTemplates } from '@/lib/events/engine';

const RUN = process.env.RUN_WEIGHT_RESPONSE === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(4 * 60 * 60 * 1000);

const LIVES = Number(process.env.LIVES ?? 16);
const WEEKS = Number(process.env.WEEKS ?? 120);
// `gym_invite` is the right probe: weight 0.3 (mid-pool), a condition that only
// asks for one relationship, and a measured base rate of 8 deliveries across 50
// lives - frequent enough to have statistical power, rare enough that a scaled
// weight has somewhere to go. The first run of this experiment probed
// `job_offer` and measured 0 vs 0, which says nothing about the engine: that
// template's weight function returns 0.1, the bottom of a 107-template pool, so
// zero deliveries in ten lives is the EXPECTED result at either scale. A null
// result from an underpowered probe is not evidence of a null effect.
const TARGET = process.env.TARGET ?? 'gym_invite';
const SCALE = Number(process.env.SCALE ?? 20);

function attentive(): SimPolicy {
  const inner = PERSONAS['A average']();
  return async (ctx: SimWeekContext) => {
    await inner(ctx);
    await meetIfOffered(ctx);
    await answerPendingEvents(ctx);
    await answerLifeMoment(ctx);
  };
}

type ArmResult = { target: number; total: number; distinct: number };
/** The target's share of all deliveries - the quantity a weight controls. */
const share = (r: ArmResult): number => (r.total > 0 ? r.target / r.total : 0);
const pct = (r: ArmResult): string => `${(share(r) * 100).toFixed(2)}%`;

/** Deliveries of every id, plus the target's count, across `LIVES` lives. */
async function arm(label: string): Promise<ArmResult> {
  let target = 0;
  let total = 0;
  const distinct = new Set<string>();
  for (let seed = 1; seed <= LIVES; seed++) {
    const r = await runPersona({
      name: `${label}-${seed}`, scenarioId: 'food_courier', seed, weeks: WEEKS, policy: attentive(),
    });
    for (const e of r.finalState.eventLog ?? []) {
      if (!e?.id) continue;
      total += 1;
      distinct.add(e.id);
      if (e.id === TARGET) target += 1;
    }
  }
  return { target, total, distinct: distinct.size };
}

d('weight responsiveness', () => {
  it('a weight change moves the delivery rate across a cohort', async () => {
    const entry = eventTemplates.find((t) => t.id === TARGET);
    expect(entry).toBeDefined();
    const original = entry!.weight;
    // A function weight is state-dependent; scale whatever it returns.
    const baseWeightIsFn = typeof original === 'function';

    const control = await arm('ctl');

    if (baseWeightIsFn) {
      const fn = original as (s: Parameters<Exclude<typeof original, number>>[0]) => number;
      entry!.weight = ((s) => fn(s) * SCALE) as typeof original;
    } else {
      entry!.weight = (original as number) * SCALE;
    }
    let treatment: ArmResult;
    try {
      treatment = await arm('trt');
    } finally {
      entry!.weight = original;
    }

    const lines = [
      `target=${TARGET} scale=${SCALE}x lives=${LIVES} weeks=${WEEKS}`,
      `  base weight: ${baseWeightIsFn ? '(state fn)' : String(original)}`,
      `  CONTROL   : ${control.target} deliveries of target | ${control.total} events | ${control.distinct} distinct ids | share ${pct(control)}`,
      `  TREATMENT : ${treatment.target} deliveries of target | ${treatment.total} events | ${treatment.distinct} distinct ids | share ${pct(treatment)}`,
      `  DELTA     : ${treatment.target - control.target} deliveries of the target`,
    ];
    for (const l of lines) console.log(l);
    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(process.env.DUMP, JSON.stringify({ summary: lines, control, treatment }, null, 2));
    }

    // The assertion is the point of the whole program: scaling a competing
    // template's weight by SCALE must deliver it MORE OFTEN across a cohort.
    // A pass is not a tuning claim - it is the proof that tuning is POSSIBLE,
    // which is what Program 12's null result left in doubt.
    //
    // Measured on the SHARE of deliveries rather than the raw count, because
    // the two arms do not have to produce the same number of events: a
    // different event in week N sends the life down a different branch, so the
    // denominator moves too. Share is the quantity the weight actually controls.
    expect(treatment.target).toBeGreaterThan(control.target);
    expect(share(treatment)).toBeGreaterThan(share(control) * 2);
  });
});
