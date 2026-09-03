/**
 * ECONOMIC PERSONA SOAK — Master Program 10 (economy + progression).
 *
 * Runs the nine economic personas from the brief through a life on the REAL
 * tick and prints (a) a sampled week-by-week economy table per persona and
 * (b) horizon tables at weeks 20 / 50 / 100 / 250: cash, net worth, income,
 * bills, savings, investments, property, debt, housing, career level,
 * education, unlock tier, and where the money went. The economic GATES live
 * in `economyBoundaries.test.ts`; this file is the measurement behind them.
 *
 * RUN:  RUN_ECONOMY_PERSONAS=1 npx jest economyPersonas --silent=false
 * PERSONAS=SAVER,INVESTOR filters; SEEDS=1,2; WEEKS=250; EVERY=10 (row sampling).
 */
import { runPersona, formatEconomyRun, rowAt, type SimResult } from '../helpers/earlyGameSim';
import { ECONOMY_PERSONAS } from '../helpers/economyPersonas';

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

const describeSim = process.env.RUN_ECONOMY_PERSONAS ? describe : describe.skip;

const k = (n: number | undefined) => {
  if (n === undefined) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
};

describeSim('Economic persona soak (manual)', () => {
  jest.setTimeout(3_600_000 * 3);

  it('prints the economy of every persona at 20 / 50 / 100 / 250 weeks', async () => {
    const seeds = (process.env.SEEDS ?? '1').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    const weeks = Number(process.env.WEEKS ?? 250);
    const every = Number(process.env.EVERY ?? 10);
    const filter = process.env.PERSONAS?.split(',').map((s) => s.trim().toUpperCase());
    const horizons = [20, 50, 100, 250].filter((h) => h <= weeks);
    const results: SimResult[] = [];
    const out: string[] = [];

    for (const [name, spec] of Object.entries(ECONOMY_PERSONAS)) {
      if (filter && !filter.some((f) => name.toUpperCase().includes(f))) continue;
      for (const seed of seeds) {
        const r = await runPersona({
          name,
          scenarioId: spec.scenarioId,
          seed,
          weeks,
          policy: spec.make(),
        });
        results.push(r);
        out.push(formatEconomyRun(r, every));
        out.push('');
      }
    }

    for (const h of horizons) {
      out.push(`=== HORIZON week ${h} ===`);
      out.push(
        'persona          | seed |   cash |  netW | salary | pass. | bills |  save | invest |  prop |  debt | T | housing         | job/lvl          | edu        | hp/ha | status',
      );
      for (const r of results) {
        const row = rowAt(r, h);
        if (!row) continue;
        const status = r.died && (r.deathWeek ?? 0) <= h ? `DIED wk ${r.deathWeek}` : 'alive';
        out.push(
          `${r.name.padEnd(16)} | ${String(r.seed).padStart(4)} | ${k(row.cash).padStart(6)} | ${k(row.netWorth).padStart(5)} | ${k(row.salary).padStart(6)} | ${k(row.passive).padStart(5)} | ${k(row.expenses).padStart(5)} | ${k(row.savings).padStart(5)} | ${k(row.invested).padStart(6)} | ${k(row.property).padStart(5)} | ${k(row.debt).padStart(5)} | ${row.tier} | ${row.housing.padEnd(15)} | ${`${row.job}/${row.level}`.padEnd(16)} | ${row.education.padEnd(10)} | ${String(row.health).padStart(2)}/${String(row.happiness).padStart(2)} | ${status}`,
        );
      }
      out.push('');
    }

    // Lifetime spend by category - what each persona's money actually bought.
    out.push('=== SPEND BY CATEGORY (whole run) ===');
    for (const r of results) {
      const totals: Record<string, number> = {};
      for (const row of r.rows) for (const [c, v] of Object.entries(row.spentBy)) totals[c] = (totals[c] ?? 0) + (v ?? 0);
      const line = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `${c}:${k(v)}`)
        .join('  ');
      out.push(`${r.name.padEnd(16)} | ${line}`);
    }

    process.stdout.write(`\n\n===== ECONOMY PERSONAS (${weeks} weeks) =====\n${out.join('\n')}\n=====\n\n`);
    // DUMP=<path> writes every row of every run as JSON for offline analysis.
    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      fs.writeFileSync(
        process.env.DUMP,
        JSON.stringify(
          results.map((r) => ({ name: r.name, seed: r.seed, scenarioId: r.scenarioId, died: r.died, deathWeek: r.deathWeek, deathReason: r.deathReason, rows: r.rows })),
        ),
      );
    }
    expect(results.length).toBeGreaterThan(0);
  });
});
