/**
 * LIFE VARIATION + LONG-RUN SOAK — Master Program 8 (manual).
 *
 * Prints, on the real tick with the game's own RNG:
 *   - 20 runs of ONE life (same lineage, same actions): must be identical;
 *   - 50 lives (50 lineage ids, same actions) at age 20 and at age 40: the
 *     distribution of first-illness week and type, deaths, cash at week 20;
 *   - 100-week runs of the careful persona at ages 20 / 40 / 60 and the
 *     text-skipper to death: vitals, fitness, wealth, illness, chapters.
 *
 * RUN:  RUN_LIFE_SIM=1 npx jest lifeVariation --silent=false
 */
import { runPersona, withStartingAge, type SimResult } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';

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

const describeSim = process.env.RUN_LIFE_SIM ? describe : describe.skip;
jest.setTimeout(3_600_000);

const fingerprint = (r: SimResult): string =>
  r.rows.map((row) => `${row.week}|${row.cash}|${row.health}|${row.happiness}|${row.fitness}|${row.diseases.join(',')}`).join(';') + (r.died ? `|died@${r.deathWeek}` : '');

const firstIllness = (r: SimResult): { week: number; name: string } | null => {
  for (const row of r.rows) if (row.diseases.length) return { week: row.week, name: row.diseases[0] };
  return null;
};

const w = (s: string) => process.stdout.write(s + '\n');

describeSim('life variation soak', () => {
  it('20 runs of one life are identical', async () => {
    const prints = new Set<string>();
    for (let i = 0; i < 20; i++) {
      prints.add(fingerprint(await runPersona({ name: 'B', policy: PERSONAS['B text skipper'](), scenarioId: 'food_courier', seed: 1, weeks: 20, seedMathRandom: false, mutateSeed: (s) => ({ ...s, lineageId: 'life_same' }) })));
    }
    w(`\nSAME LIFE x20: ${prints.size} distinct fingerprint(s)`);
    expect(prints.size).toBe(1);
  });

  it.each([20, 40])('50 lives at age %i', async (age) => {
    const firsts: string[] = [];
    const weeks: number[] = [];
    let deaths = 0;
    const cash: number[] = [];
    const prints = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = await runPersona({ name: 'A', policy: PERSONAS['A average'](), scenarioId: 'food_courier', seed: 1, weeks: 20, seedMathRandom: false, mutateSeed: (s) => ({ ...withStartingAge(s, age), lineageId: `life_${age}_${i}` }) });
      prints.add(fingerprint(r));
      const f = firstIllness(r);
      if (f) { firsts.push(f.name); weeks.push(f.week); }
      if (r.died) { deaths++; w(`  death: wk ${r.deathWeek} (${r.deathReason}) with ${r.rows[r.rows.length - 1].diseases.join(',') || 'no illness'}`); }
      cash.push(r.rows[r.rows.length - 1].cash);
    }
    const count = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ');
    const hist = (xs: number[]) => { const m: Record<number, number> = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return Object.entries(m).map(([k, v]) => `wk${k}×${v}`).join(' '); };
    w(`\n50 LIVES, AGE ${age}, average persona, 20 weeks: ${prints.size} distinct lives · ${firsts.length} fell ill · deaths ${deaths} · cash min ${Math.min(...cash)} max ${Math.max(...cash)}`);
    w(`  first illness weeks: ${hist(weeks)}`);
    w(`  first illness types: ${count(firsts)}`);
    expect(prints.size).toBe(50);
  });

  it.each([20, 40, 60])('100 weeks, careful, age %i', async (age) => {
    const r = await runPersona({ name: 'C', policy: PERSONAS['C careful'](), scenarioId: 'food_courier', seed: 1, weeks: 100, seedMathRandom: false, mutateSeed: (s) => ({ ...withStartingAge(s, age), lineageId: `life_long_${age}` }) });
    const at = (wk: number) => r.rows.find((x) => x.week === wk) ?? r.rows[r.rows.length - 1];
    const ill = r.rows.filter((x) => x.diseases.length).length;
    const bundles = r.rows.filter((x) => x.tickDelta >= 800).map((x) => `wk${x.week}:+${x.tickDelta}`);
    const onsets: string[] = []; let prev: string[] = [];
    for (const x of r.rows) { for (const d of x.diseases) if (!prev.includes(d)) onsets.push(`${x.week}:${d}`); prev = x.diseases; }
    w(`  illnesses: ${onsets.join(' ')}`);
    w(`\n100 WEEKS, CAREFUL, AGE ${age}: ${r.died ? `DIED wk ${r.deathWeek}` : 'alive'} · ill ${ill}/${r.rows.length} · min hp ${r.minHealth} / ha ${r.minHappiness} · chapters ${r.rows[r.rows.length - 1].chapters.join(',')}`);
    for (const wk of [20, 50, 100]) { const x = at(wk); w(`  wk${x.week}: cash ${x.cash} nw ${x.netWorth} hp ${x.health} ha ${x.happiness} fit ${x.fitness} ${x.housing} ${x.job}/${x.level}`); }
    w(`  windfalls ≥ $800: ${bundles.join(' ')}`);
  });

  it('100 weeks, text-skipper', async () => {
    const r = await runPersona({ name: 'B', policy: PERSONAS['B text skipper'](), scenarioId: 'food_courier', seed: 1, weeks: 100, seedMathRandom: false, mutateSeed: (s) => ({ ...s, lineageId: 'life_long_B' }) });
    w(`\n100 WEEKS, TEXT-SKIPPER: ${r.died ? `DIED wk ${r.deathWeek} (${r.deathReason})` : 'alive'} · cash ${r.rows[r.rows.length - 1].cash}`);
  });
});
