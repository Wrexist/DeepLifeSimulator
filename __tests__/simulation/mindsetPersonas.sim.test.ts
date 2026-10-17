/**
 * No Mindset dominates - measured on the real tick.
 *
 * Each Mindset is one upside and one downside (lib/mindset/effects.ts). This
 * soak runs the same economic personas over the same seeds with no Mindset and
 * with each of the eleven, and reports net worth, average happiness, minimum
 * health and career level at the end, so a Mindset that is strictly better
 * than having none (or than every other) shows up as a number, not a guess.
 *
 *   RUN_MINDSET_SIM=1 npx jest mindsetPersonas --silent=false
 *   RUN_MINDSET_SIM=1 DUMP=out.json npx jest mindsetPersonas
 *
 * Gated like the other soaks (CLAUDE.md §4.3): 72 lives of 100 weeks.
 */

/* eslint-disable import/first -- jest.mock goes above the imports, matching the stress suites. */

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

import fs from 'fs';
import { runPersona } from '../helpers/earlyGameSim';
import { ECONOMY_PERSONAS } from '../helpers/economyPersonas';
import { MINDSET_TRAITS, type MindsetId } from '@/lib/mindset/config';
import { netWorth } from '@/lib/progress/achievements';

const RUN = process.env.RUN_MINDSET_SIM === '1';
const d = RUN ? describe : describe.skip;

const PERSONAS = ['CAREER CLIMBER', 'HIGH-SPENDER'] as const;
const SEEDS = [1, 2, 3];
const WEEKS = 100;

interface Row {
  mindset: MindsetId | 'none';
  persona: string;
  netWorth: number;
  avgHappiness: number;
  minHealth: number;
  careerLevel: number;
  died: boolean;
}

d('Mindset personas (100 weeks, real tick)', () => {
  jest.setTimeout(30 * 60 * 1000);

  it('reports every Mindset against no Mindset', async () => {
    const rows: Row[] = [];
    const mindsets: (MindsetId | 'none')[] = ['none', ...MINDSET_TRAITS.map((t) => t.id)];
    for (const persona of PERSONAS) {
      const spec = ECONOMY_PERSONAS[persona];
      for (const mindset of mindsets) {
        // Keep NUMBERS only: each run's final state and weekly rows are large,
        // and holding 72 of them exhausted the heap.
        const summaries: { netWorth: number; avgHappiness: number; minHealth: number; careerLevel: number; died: boolean }[] = [];
        for (const seed of SEEDS) {
          const r = await runPersona({
            name: `${persona}/${mindset}`,
            scenarioId: spec.scenarioId,
            seed,
            weeks: WEEKS,
            policy: spec.make(),
            mutateSeed: (s) => ({
              ...s,
              mindset: mindset === 'none' ? { activeTraitId: undefined, traits: [] } : { activeTraitId: mindset, traits: [mindset] },
            }),
          });
          const job = r.finalState.careers.find((c) => c.id === r.finalState.currentJob);
          summaries.push({
            netWorth: netWorth(r.finalState),
            avgHappiness: r.rows.reduce((a, row) => a + row.happiness, 0) / Math.max(1, r.rows.length),
            minHealth: r.minHealth,
            careerLevel: job?.level ?? 0,
            died: r.died,
          });
        }
        const mean = (f: (x: (typeof summaries)[number]) => number) => summaries.reduce((a, x) => a + f(x), 0) / summaries.length;
        rows.push({
          mindset,
          persona,
          netWorth: Math.round(mean((x) => x.netWorth)),
          avgHappiness: Math.round(mean((x) => x.avgHappiness) * 10) / 10,
          minHealth: Math.round(mean((x) => x.minHealth) * 10) / 10,
          careerLevel: Math.round(mean((x) => x.careerLevel) * 10) / 10,
          died: summaries.some((x) => x.died),
        });
        if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(rows, null, 2));
      }
    }

    console.table(rows);
    if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(rows, null, 2));

    // The design claim: no Mindset is strictly better than having none on BOTH
    // money and happiness for a persona by a wide margin, and none kills a life
    // that survives without it.
    for (const persona of PERSONAS) {
      const base = rows.find((r) => r.persona === persona && r.mindset === 'none')!;
      for (const r of rows.filter((x) => x.persona === persona && x.mindset !== 'none')) {
        const muchRicher = r.netWorth > base.netWorth * 1.25;
        const happier = r.avgHappiness > base.avgHappiness + 5;
        expect(`${persona}/${r.mindset}: dominant=${muchRicher && happier}`).toBe(`${persona}/${r.mindset}: dominant=false`);
        if (!base.died) expect(`${persona}/${r.mindset}: died=${r.died}`).toBe(`${persona}/${r.mindset}: died=false`);
      }
    }
  });
});
