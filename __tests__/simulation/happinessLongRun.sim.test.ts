/**
 * HAPPINESS LONG-RUN DISTRIBUTION - Master Program 15 (release audit), Phase 5.
 *
 * Manual: `RUN_HAPPINESS_LONGRUN=1 npx jest happinessLongRun --silent=false`
 * (`WEEKS=150,250,500`, `SEEDS=1,2,3`, `DUMP=<file>`).
 *
 * Program 14 measured six personas to 150 weeks and recorded, honestly, that
 * 250 and 500 were not run. This harness runs them, plus controlled starts at
 * happiness 20 / 50 / 80 / 100 and the same policy across several lineages, and
 * prints the distribution numbers a balance decision needs: mean, p10, median,
 * p90, weeks at 95+, weeks below 50, FLAT weeks (the tick moved happiness by
 * exactly zero), recovery time from 20, persona separation and cross-life
 * variance. It measures; it does not tune.
 */
import { runPersona, type SimResult } from '../helpers/earlyGameSim';
import { SOCIAL_PERSONAS } from '../helpers/socialPersonas';
import type { GameState } from '@/contexts/game/types';
import * as fs from 'fs';

const RUN = process.env.RUN_HAPPINESS_LONGRUN === '1';
const d = RUN ? describe : describe.skip;
jest.setTimeout(4 * 60 * 60 * 1000);

const WEEKS = (process.env.WEEKS ?? '150,250').split(',').map(Number);
const SEEDS = (process.env.SEEDS ?? '1').split(',').map(Number);
const PERSONAS = (process.env.PERSONAS ?? 'LONER,CASUAL SOCIAL,FRIENDSHIP-FOCUSED,ROMANCE-FOCUSED,CAREER-OBSESSED,WEALTH MAXIMIZER').split(',');

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

export interface HappinessStats {
  weeks: number; mean: number; p10: number; median: number; p90: number;
  at95: number; below50: number; flat: number; min: number; died: boolean;
}

function stats(r: SimResult): HappinessStats {
  const h = r.rows.map((row) => row.happiness);
  const sorted = [...h].sort((a, b) => a - b);
  let flat = 0;
  for (let i = 1; i < h.length; i++) if (h[i] === h[i - 1]) flat++;
  return {
    weeks: h.length,
    mean: +(h.reduce((a, b) => a + b, 0) / h.length).toFixed(1),
    p10: +pct(sorted, 10).toFixed(1), median: +pct(sorted, 50).toFixed(1), p90: +pct(sorted, 90).toFixed(1),
    at95: h.filter((x) => x >= 95).length, below50: h.filter((x) => x < 50).length, flat,
    min: +sorted[0].toFixed(1), died: r.died,
  };
}

function fmt(name: string, s: HappinessStats): string {
  return `${name.padEnd(22)} | ${String(s.weeks).padStart(4)} | ${String(s.mean).padStart(5)} | ${String(s.p10).padStart(5)} | ${String(s.median).padStart(5)} | ${String(s.p90).padStart(5)} | ${String(s.at95).padStart(4)} | ${String(s.below50).padStart(4)} | ${String(s.flat).padStart(4)} | ${String(s.min).padStart(5)} | ${s.died ? 'DIED' : ''}`;
}
const HEADER = 'persona                | wks  | mean  | p10   | med   | p90   | >=95 | <50  | flat | min   |';

async function run(name: string, weeks: number, seed: number, startHappiness?: number): Promise<SimResult> {
  const spec = SOCIAL_PERSONAS[name];
  return runPersona({
    name, scenarioId: spec.scenarioId, seed, weeks, policy: spec.make(),
    mutateSeed: startHappiness === undefined ? undefined : (s: GameState) => ({ ...s, stats: { ...s.stats, happiness: startHappiness } }),
  });
}

d('happiness long-run distribution', () => {
  const dump: Record<string, unknown> = {};
  // Written after EVERY test, so a filtered run (`-t "six personas"`) still
  // leaves its numbers on disk - jest swallows console output from a
  // backgrounded run, and the dump is the record.
  const flush = () => { if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(dump, null, 2)); };

  it('six personas over the requested horizons', async () => {
    for (const weeks of WEEKS) {
      const lines: string[] = [HEADER];
      const medians: number[] = []; const means: number[] = [];
      for (const name of PERSONAS) {
        const s = stats(await run(name, weeks, SEEDS[0]));
        medians.push(s.median); means.push(s.mean);
        lines.push(fmt(name, s));
        dump[`${name}@${weeks}`] = s;
      }
      const spread = (xs: number[]) => +(Math.max(...xs) - Math.min(...xs)).toFixed(2);
      lines.push(`separation: median spread ${spread(medians)}, mean spread ${spread(means)}`);
      console.log(`\n=== ${weeks} weeks (seed ${SEEDS[0]}) ===\n` + lines.join('\n'));
    }
    flush();
  });

  it('controlled starts at 20 / 50 / 80 / 100 (150 weeks)', async () => {
    const lines: string[] = [HEADER + ' recover>=80 | recover>=90'];
    for (const start of [20, 50, 80, 100]) {
      for (const name of ['LONER', 'CASUAL SOCIAL', 'ROMANCE-FOCUSED']) {
        const r = await run(name, 150, SEEDS[0], start);
        const s = stats(r);
        const first = (t: number) => { const i = r.rows.findIndex((row) => row.happiness >= t); return i < 0 ? 'never' : String(i); };
        lines.push(fmt(`${name}@${start}`, s) + ` ${first(80).padStart(11)} | ${first(90).padStart(11)}`);
        dump[`start${start}:${name}`] = { ...s, recover80: first(80), recover90: first(90) };
      }
    }
    console.log('\n=== controlled starts ===\n' + lines.join('\n'));
    flush();
  });

  it('same policy across lineages', async () => {
    const seeds = SEEDS.length > 1 ? SEEDS : [1, 2, 3, 4, 5];
    const lines: string[] = [HEADER];
    for (const name of ['CASUAL SOCIAL', 'CAREER-OBSESSED']) {
      const meansAcross: number[] = [];
      for (const seed of seeds) {
        const s = stats(await run(name, 150, seed));
        meansAcross.push(s.mean);
        lines.push(fmt(`${name} s${seed}`, s));
      }
      const mu = meansAcross.reduce((a, b) => a + b, 0) / meansAcross.length;
      const sd = Math.sqrt(meansAcross.reduce((a, b) => a + (b - mu) ** 2, 0) / meansAcross.length);
      lines.push(`${name}: cross-life mean sd ${sd.toFixed(2)} over ${seeds.length} lives`);
      dump[`lineages:${name}`] = { means: meansAcross, sd: +sd.toFixed(2) };
    }
    console.log('\n=== lineages ===\n' + lines.join('\n'));
    flush();
  });
});
