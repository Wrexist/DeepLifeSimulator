/**
 * Social persona soak — Master Program 11, Phase 6.
 *
 * Manual: `RUN_SOCIAL_PERSONAS=1 npx jest socialPersonas --silent=false`.
 * Optional `DUMP=<file>` writes the rows as JSON for the report tables.
 *
 * Prints, per persona and horizon, who is in the life: relationships the
 * player CHOSE (parents and children excluded), friends, bonds at 60+, the
 * romance stage, children, Spark matches, the mean bond, and the relationship
 * news the tick raised. It answers the question the brief opens with — does
 * this feel like a life with other people in it — with numbers instead of a
 * code read.
 *
 * Skipped in CI (long). The gates live in `socialBoundaries.test.ts`.
 */
import { runPersona, formatSocialRun, rowAt, type SimResult } from '../helpers/earlyGameSim';
import { SOCIAL_PERSONAS } from '../helpers/socialPersonas';

const RUN = process.env.RUN_SOCIAL_PERSONAS === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(30 * 60 * 1000);

const HORIZONS = [20, 50, 100, 250];

d('social personas on the real tick', () => {
  it('runs every persona to every horizon and prints the tables', async () => {
    const results: Record<string, SimResult> = {};
    for (const [name, spec] of Object.entries(SOCIAL_PERSONAS)) {
      const r = await runPersona({
        name,
        scenarioId: spec.scenarioId,
        seed: 1,
        weeks: HORIZONS[HORIZONS.length - 1],
        policy: spec.make(),
      });
      results[name] = r;
      // eslint-disable-next-line no-console
      console.log(formatSocialRun(r, 10));
    }

    // eslint-disable-next-line no-console
    console.log('\n=== SOCIAL HORIZON TABLE ===');
    for (const week of HORIZONS) {
      // eslint-disable-next-line no-console
      console.log(`\n-- week ${week} --`);
      // eslint-disable-next-line no-console
      console.log('persona              | tier | chosen | friends | strong | romance | kids | avgBond | happiness | netWorth');
      for (const [name, r] of Object.entries(results)) {
        const row = rowAt(r, week);
        if (!row) continue;
        // eslint-disable-next-line no-console
        console.log(
          `${name.padEnd(20)} | ${String(row.tier).padStart(4)} | ${String(row.chosen).padStart(6)} | ${String(row.friends).padStart(7)} | ${String(row.strong).padStart(6)} | ${row.romance.padEnd(7)} | ${String(row.children).padStart(4)} | ${String(row.avgBond).padStart(7)} | ${String(row.happiness).padStart(9)} | ${String(row.netWorth).padStart(8)}`,
        );
      }
    }

    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      fs.writeFileSync(
        process.env.DUMP,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(results).map(([k, r]) => [
              k,
              { died: r.died, deathWeek: r.deathWeek, deathReason: r.deathReason, rows: r.rows },
            ]),
          ),
          null,
          1,
        ),
      );
    }
    expect(Object.keys(results).length).toBe(Object.keys(SOCIAL_PERSONAS).length);
  });
});
