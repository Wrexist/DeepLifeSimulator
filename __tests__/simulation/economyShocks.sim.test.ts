/**
 * ECONOMIC SHOCK + RECOVERY — Master Program 10, Phase 9.
 *
 * The AVERAGE WORKER (plus the one reflex a shocked player has: see the
 * doctor when sick and $500 is on hand) lives 150 weeks on the REAL tick; at
 * week 60 one shock lands. Prints, per shock: cash and net worth before, the
 * trough after, weeks until cash and net worth are back to the pre-shock
 * level, peak arrears, and whether the life survived.
 *
 * Shocks: job loss (fired, no rehire for 8 weeks), illness (pneumonia),
 * low cash (wallet emptied to $50), major expense ($8,000 bill), bad
 * investment (an INVESTOR whose whole portfolio halves at week 80).
 *
 * RUN:  RUN_ECONOMY_SHOCKS=1 npx jest economyShocks --silent=false
 */
import { runPersona, type SimResult, type SimWeekContext, type SimPolicy } from '../helpers/earlyGameSim';
import { averageWorker, investor } from '../helpers/economyPersonas';
import { generateSpecificDisease } from '@/lib/diseases/diseaseGenerator';
import { adjustStockPrice } from '@/lib/economy/stockMarket';

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

const describeSim = process.env.RUN_ECONOMY_SHOCKS ? describe : describe.skip;
const SHOCK_WEEK = 60;

const k = (n: number | undefined) => {
  if (n === undefined) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
};

/** The average worker who also sees the doctor when a disease is on screen. */
const worker = async (ctx: SimWeekContext) => {
  await averageWorker(ctx);
  const s = ctx.state();
  if ((s.diseases ?? []).length > 0 && s.stats.money >= 500 && s.stats.health < 60) {
    const before = s.stats.money;
    await ctx.actions.performHealthActivity('doctor');
    if (ctx.state().stats.money < before) ctx.note('doctor');
  }
};

const SHOCKS: Record<string, () => SimPolicy> = {
  'no shock (control)': () => worker,
  'job loss (8 weeks no rehire)': () => {
    let lostAt = -1;
    return async (ctx) => {
      if (ctx.week === SHOCK_WEEK && ctx.state().currentJob) {
        await ctx.actions.quitJob();
        lostAt = ctx.week;
        ctx.note('FIRED');
      }
      if (lostAt >= 0 && ctx.week < lostAt + 8) {
        // Out of work: the same reflexes minus the job board.
        const s = ctx.state();
        if (s.stats.happiness < 50) await ctx.actions.performHealthActivity('meditation');
        if (s.stats.health < 50) await ctx.actions.performHealthActivity('walk');
        if (s.stats.energy >= 60 && s.stats.money < 500) {
          const r = await ctx.actions.performStreetJob('wash_cars');
          if (r?.success) ctx.note('wash cars');
        }
        return;
      }
      await worker(ctx);
    };
  },
  'illness (pneumonia)': () => async (ctx) => {
    if (ctx.week === SHOCK_WEEK) {
      await ctx.actions.setState((prev) => {
        const d = generateSpecificDisease('pneumonia', prev);
        return d ? { ...prev, diseases: [...(prev.diseases ?? []), d] } : prev;
      });
      ctx.note('PNEUMONIA');
    }
    await worker(ctx);
  },
  'low cash (wallet to $50)': () => async (ctx) => {
    if (ctx.week === SHOCK_WEEK) {
      await ctx.actions.setState((prev) => ({ ...prev, stats: { ...prev.stats, money: 50 } }));
      ctx.note('WALLET EMPTIED');
    }
    await worker(ctx);
  },
  'major expense ($8,000)': () => async (ctx) => {
    if (ctx.week === SHOCK_WEEK) {
      await ctx.actions.setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, money: Math.max(0, prev.stats.money - 8_000) },
      }));
      ctx.note('$8k BILL');
    }
    await worker(ctx);
  },
  'bad investment (portfolio halves at 80)': () => async (ctx) => {
    if (ctx.week === 80) {
      const held = new Set((ctx.state().stocks?.holdings ?? []).map((h) => h.symbol));
      for (const sym of held) adjustStockPrice(sym, 0.5);
      await ctx.actions.setState((prev) => ({
        ...prev,
        stocks: prev.stocks
          ? {
              ...prev.stocks,
              holdings: (prev.stocks.holdings ?? []).map((h) => ({ ...h, currentPrice: (h.currentPrice ?? 0) * 0.5 })),
            }
          : prev.stocks,
      }));
      ctx.note('CRASH -50%');
    }
    await investor(ctx);
  },
};

function summarize(r: SimResult, shockWeek: number) {
  // The policy runs BEFORE the tick, so a shock landed at `ctx.week === N`
  // first shows in the row labelled N + 1; the row labelled N is pre-shock.
  const before = r.rows.find((row) => row.week === shockWeek) ?? r.rows[0];
  const after = r.rows.filter((row) => row.week > shockWeek);
  const trough = after.reduce((m, row) => Math.min(m, row.cash), Infinity);
  const troughNW = after.reduce((m, row) => Math.min(m, row.netWorth), Infinity);
  const cashBack = after.find((row) => row.cash >= before.cash)?.week;
  const nwBack = after.find((row) => row.netWorth >= before.netWorth)?.week;
  const peakOverdue = after.reduce((m, row) => Math.max(m, row.overdue), 0);
  const minHealth = after.reduce((m, row) => Math.min(m, row.health), 100);
  const last = r.rows[r.rows.length - 1];
  return { before, trough, troughNW, cashBack, nwBack, peakOverdue, minHealth, last };
}

describeSim('Economic shocks and recovery (manual)', () => {
  jest.setTimeout(3_600_000 * 3);

  it('lands one shock at week 60 and measures the recovery', async () => {
    const weeks = Number(process.env.WEEKS ?? 150);
    const seed = Number(process.env.SEED ?? 1);
    const out: string[] = [];
    out.push(`===== SHOCKS (average worker, shock at week ${SHOCK_WEEK}, ${weeks} weeks) =====`);
    out.push(
      'shock                                   | cash@60 | netW@60 | trough cash | trough netW | cash back wk | netW back wk | peak arrears | min hp | final cash | final netW | status',
    );
    for (const [name, make] of Object.entries(SHOCKS)) {
      const r = await runPersona({ name, seed, weeks, policy: make() });
      const sw = name.startsWith('bad investment') ? 80 : SHOCK_WEEK;
      const s = summarize(r, sw);
      out.push(
        `${name.padEnd(39)} | ${k(s.before.cash).padStart(7)} | ${k(s.before.netWorth).padStart(7)} | ${k(s.trough).padStart(11)} | ${k(s.troughNW).padStart(11)} | ${String(s.cashBack ?? 'never').padStart(12)} | ${String(s.nwBack ?? 'never').padStart(12)} | ${k(s.peakOverdue).padStart(12)} | ${String(s.minHealth).padStart(6)} | ${k(s.last.cash).padStart(10)} | ${k(s.last.netWorth).padStart(10)} | ${r.died ? `DIED ${r.deathWeek} (${r.deathReason})` : 'alive'}`,
      );
    }
    process.stdout.write(`\n\n${out.join('\n')}\n=====\n\n`);
    expect(true).toBe(true);
  });
});
