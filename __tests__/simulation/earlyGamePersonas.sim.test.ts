/**
 * EARLY-GAME PERSONA SOAK — Master Program 7 (new-life balance).
 *
 * Runs the five reasonable-player personas from the brief through the first
 * 20 weeks of a fresh life on the REAL tick, and prints week-by-week tables:
 * cash, the tick's cash delta, what the persona spent, vitals, housing, job,
 * diseases and the persona's own actions. The survivability GATES live in
 * `earlyGameSurvivability.test.ts`; this file is the measurement behind them.
 *
 * RUN:  RUN_EARLY_GAME_SIM=1 npx jest earlyGamePersonas --silent=false
 * SEEDS=1,2,3 runs more seeds per persona (default 1,2,3); PERSONAS=B,A filters
 * by the persona's letter; SCENARIO=<id> picks the onboarding scenario; WEEKS=N;
 * FITNESS=N overrides the seeded starting fitness (to isolate the fitness → disease link).
 */
import { runPersona, formatRun, type SimResult } from '../helpers/earlyGameSim';
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

const describeSim = process.env.RUN_EARLY_GAME_SIM ? describe : describe.skip;

describeSim('Early-game persona soak (manual)', () => {
  jest.setTimeout(3_600_000);

  it('prints the first 20 weeks of every persona', async () => {
    const seeds = (process.env.SEEDS ?? '1,2,3').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    const scenarioId = process.env.SCENARIO ?? 'food_courier';
    const weeks = Number(process.env.WEEKS ?? 20);
    const results: SimResult[] = [];
    const only = (process.env.PERSONAS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const [name, makePolicy] of Object.entries(PERSONAS)) {
      if (only.length && !only.includes(name[0])) continue;
      for (const seed of seeds) {
        const fitness = process.env.FITNESS ? Number(process.env.FITNESS) : undefined;
        results.push(await runPersona({
          name,
          policy: makePolicy(),
          seed,
          scenarioId,
          weeks,
          mutateSeed: fitness === undefined ? undefined : (st) => ({ ...st, stats: { ...st.stats, fitness } }),
        }));
      }
    }
    process.stdout.write(`\n\n===== EARLY-GAME PERSONAS (${scenarioId}, ${weeks} weeks) =====\n`);
    for (const r of results) process.stdout.write(`\n${formatRun(r)}\n`);
    process.stdout.write('\nSUMMARY\n');
    for (const r of results) {
      const last = r.rows[r.rows.length - 1];
      process.stdout.write(
        `${r.name.padEnd(16)} seed ${r.seed}: ${r.died ? `DIED wk ${r.deathWeek} (${r.deathReason})` : `alive wk ${last.week}`} · end hp ${last.health} ha ${last.happiness} en ${last.energy} cash $${last.cash} · min hp ${r.minHealth} / ha ${r.minHappiness} · ${last.housing} · ${last.job}/${last.level}\n`,
      );
    }
    process.stdout.write('=============================================================\n\n');
    for (const r of results) {
      for (const row of r.rows) expect(Number.isFinite(row.cash)).toBe(true);
    }
  });
});
