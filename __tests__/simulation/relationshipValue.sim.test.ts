/**
 * WHAT DOES A BOND ACTUALLY BUY? — Master Program 12, Phases 3 and 9.
 *
 * Manual: `RUN_RELATIONSHIP_VALUE=1 npx jest relationshipValue --silent=false`
 * (`DUMP=<file>` writes the rows as JSON).
 *
 * Program 11 measured a friendship life at 250 weeks — 36 relationships, mean
 * happiness identical to the loner's, a sixth of the money — and concluded that
 * a bond above 60 buys almost nothing. That was an inference from a code read
 * plus one persona. This is the controlled version.
 *
 * ── The design ────────────────────────────────────────────────────────────
 *
 * Every cohort runs the SAME policy, the SAME seed and the SAME scenario. The
 * only thing that differs is WHO is in the life and at WHAT bond, and the bonds
 * are RE-STAMPED every week so decay cannot confound the comparison. So any
 * difference in the recorded axes is caused by the relationships themselves,
 * not by what it cost to keep them.
 *
 * That separation matters: "keeping 36 friendships is expensive" (Program 11)
 * and "having 36 friendships does nothing" are different claims, and only the
 * second one is a defect in the value model.
 *
 * The policy is survival-only — no social actions at all — for the same reason:
 * a persona that spends its week on people is measuring the ACTIONS, and the
 * question here is what the STATE is worth.
 */
import { runPersona, rowAt, type SimResult, type SimPolicy } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import type { GameState, Relationship } from '@/contexts/game/types';

const RUN = process.env.RUN_RELATIONSHIP_VALUE === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(60 * 60 * 1000);

const HORIZONS = [20, 50, 100, 250];
const WEEKS = 250;

/** N friends, all at `bond`, deterministic in every field the tick reads. */
export function friendsAt(count: number, bond: number): Relationship[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cohort-friend-${i}`,
    name: `Friend ${i}`,
    type: 'friend' as const,
    relationshipScore: bond,
    personality: ['friendly', 'ambitious', 'analytical', 'charming', 'reserved', 'caring'][i % 6],
    gender: (i % 2 === 0 ? 'male' : 'female') as 'male' | 'female',
    age: 25 + (i % 15),
    job: 'Colleague',
    income: 45_000,
  }));
}

interface Cohort {
  name: string;
  count: number;
  bond: number;
}

/**
 * The §23 quality-vs-quantity ladder, plus the two ends of the §5 question.
 * ONE DEEP and FIVE MODERATE carry the same TOTAL bond points as TWENTY WEAK
 * carries in a single friend — so if the game rewarded depth at all, the top
 * rows would separate from the bottom ones.
 */
const COHORTS: Cohort[] = [
  { name: 'NOBODY', count: 0, bond: 0 },
  { name: 'ONE AT 45', count: 1, bond: 45 },
  { name: 'ONE AT 60', count: 1, bond: 60 },
  { name: 'ONE AT 75', count: 1, bond: 75 },
  { name: 'ONE AT 90', count: 1, bond: 90 },
  { name: 'ONE AT 100', count: 1, bond: 100 },
  { name: 'FIVE AT 60', count: 5, bond: 60 },
  { name: 'TWENTY AT 45', count: 20, bond: 45 },
  { name: 'FIFTY AT 45', count: 50, bond: 45 },
];

/**
 * The average survival policy, with the cohort's bonds re-stamped every week.
 *
 * Re-stamping is the control. Without it the 45-bond cohorts slide under
 * `NEGLECT_THRESHOLD` over 250 weeks of silence and the comparison becomes
 * "what does decay cost", which is a different question with a known answer.
 */
function pinnedPolicy(cohort: Cohort): SimPolicy {
  const inner = PERSONAS['A average']();
  return async (ctx) => {
    await inner(ctx);
    if (cohort.count === 0) return;
    await ctx.actions.setState((prev) => ({
      ...prev,
      relationships: (prev.relationships ?? []).map((r) =>
        r?.id?.startsWith('cohort-friend-') ? { ...r, relationshipScore: cohort.bond } : r,
      ),
    }));
  };
}

d('what a bond is worth, holding everything else equal', () => {
  it('runs every cohort and prints the value table', async () => {
    const results: Record<string, SimResult> = {};

    for (const cohort of COHORTS) {
      results[cohort.name] = await runPersona({
        name: cohort.name,
        scenarioId: 'food_courier',
        seed: 1,
        weeks: WEEKS,
        policy: pinnedPolicy(cohort),
        mutateSeed: (s: GameState) => ({
          ...s,
          lineageId: 'life_value_probe',
          relationships: [...(s.relationships ?? []), ...friendsAt(cohort.count, cohort.bond)],
        }),
      });
    }

    const mean = (r: SimResult, pick: (row: SimResult['rows'][number]) => number) =>
      r.rows.reduce((sum, row) => sum + pick(row), 0) / Math.max(1, r.rows.length);

    for (const week of HORIZONS) {
      console.log(`\n=== week ${week} ===`);
      console.log(
        'cohort        | people | bond |  netWorth |  happy | meanHappy |  health | energy | tier | chapters | socialNews',
      );
      for (const cohort of COHORTS) {
        const r = results[cohort.name];
        const row = rowAt(r, week);
        if (!row) continue;
        const news = r.rows
          .filter((x) => x.week <= week)
          .reduce((n, x) => n + x.socialEvents.length, 0);
        console.log(
          `${cohort.name.padEnd(13)} | ${String(cohort.count).padStart(6)} | ${String(cohort.bond).padStart(4)} | ${String(row.netWorth).padStart(9)} | ${String(row.happiness).padStart(6)} | ${mean(r, (x) => x.happiness).toFixed(1).padStart(9)} | ${String(row.health).padStart(7)} | ${String(row.energy).padStart(6)} | ${String(row.tier).padStart(4)} | ${String(row.chapters.length).padStart(8)} | ${String(news).padStart(10)}`,
        );
      }
    }

    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(
        process.env.DUMP,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(results).map(([k, r]) => [
              k,
              { died: r.died, deathWeek: r.deathWeek, rows: r.rows },
            ]),
          ),
          null,
          1,
        ),
      );
    }
    expect(Object.keys(results)).toHaveLength(COHORTS.length);
  });
});
