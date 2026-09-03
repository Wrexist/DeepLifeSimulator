/**
 * MID-GAME STRATEGY COMPARISON — Master Program 10, Phase 8 (dominant
 * strategy / opportunity cost).
 *
 * Same life, same job (software L0, $1,100/wk), same $30,000 of capital at
 * week 0, five ways to deploy it, 150 weeks on the REAL tick. Everything
 * else about the player is the AVERAGE WORKER reflex set. Prints the
 * net-worth trajectory of each strategy and what it converted the capital
 * into, so "is there one right answer at $30k?" is a measurement.
 *
 * RUN:  RUN_ECONOMY_STRATEGIES=1 npx jest economyStrategies --silent=false
 * CAPITAL=30000 WEEKS=150 SEEDS=1
 */
import { runPersona, rowAt, type SimResult, type SimWeekContext, type SimPolicy } from '../helpers/earlyGameSim';
import { averageWorker } from '../helpers/economyPersonas';
import type { GameState } from '@/contexts/game/types';

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

const describeSim = process.env.RUN_ECONOMY_STRATEGIES ? describe : describe.skip;

const k = (n: number | undefined) => {
  if (n === undefined) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
};

/** A software developer with `capital` in cash, otherwise the scenario's fresh life. */
function withSoftwareJobAndCapital(capital: number) {
  return (prev: GameState): GameState => ({
    ...prev,
    currentJob: 'software',
    careers: prev.careers.map((c) =>
      c.id === 'software'
        ? { ...c, accepted: true, applied: true, level: 0, currentLevel: 0, performance: 75, startedWeeksLived: prev.weeksLived }
        : c,
    ),
    items: prev.items.map((i) => (i.id === 'computer' ? { ...i, owned: true } : i)),
    stats: { ...prev.stats, money: capital },
    // The Stocks / Real Estate / Education apps open at tier 2; the strategies
    // are about what to DO with capital, not about the unlock ladder.
    completedChapters: ['ch1_fresh_start', 'ch2_settling_in'],
  });
}

const STRATEGIES: Record<string, (capital: number) => SimPolicy> = {
  'hold cash': () => averageWorker,
  'savings 3%': (capital) => async (ctx: SimWeekContext) => {
    await averageWorker(ctx);
    if (ctx.week === 0) {
      await ctx.actions.deposit(capital - 1_000);
      ctx.note('deposit');
    }
  },
  'blue-chip stocks': (capital) => async (ctx: SimWeekContext) => {
    await averageWorker(ctx);
    if (ctx.week === 0) {
      const each = Math.floor((capital - 1_000) / 4 / 1.02);
      for (const sym of ['JNJ', 'JPM', 'KO', 'PG']) await ctx.actions.buyStock(sym, each);
      ctx.note('buy 4 blue chips');
    }
  },
  'studio, 20% down, live in it': (capital) => async (ctx: SimWeekContext) => {
    await averageWorker(ctx);
    if (ctx.week === 0) {
      const r = await ctx.actions.buyProperty('studio-apt', 'standard', '30y', true);
      ctx.note(r?.success ? 'bought studio' : `studio refused: ${r?.message ?? ''}`);
    }
    void capital;
  },
  'studio, 20% down, let it': (capital) => async (ctx: SimWeekContext) => {
    await averageWorker(ctx);
    if (ctx.week === 0) {
      const r = await ctx.actions.buyProperty('studio-apt', 'standard', '30y', false);
      ctx.note(r?.success ? 'bought studio (let)' : `studio refused: ${r?.message ?? ''}`);
    }
    void capital;
  },
  'entrepreneurship → factory': (capital) => async (ctx: SimWeekContext) => {
    await averageWorker(ctx);
    const s = ctx.state();
    const done = (id: string) => (s.educations ?? []).some((e) => e?.id === id && e.completed);
    const active = (s.educations ?? []).some((e) => e && !e.completed && (e.weeksRemaining ?? 0) > 0);
    if (ctx.week === 0) {
      await ctx.actions.enroll('entrepreneurship', 'cash');
      ctx.note('enrol entrepreneurship (cash)');
    }
    if (done('entrepreneurship') && !active && (s.companies ?? []).length === 0 && s.stats.money >= 52_000) {
      const r = await ctx.actions.createCompany('factory');
      ctx.note(r?.success ? 'founded factory' : `factory refused: ${r?.message ?? ''}`);
    }
    if ((s.companies ?? []).length > 0 && s.stats.money >= 15_000) {
      const r = await ctx.actions.buyCompanyUpgrade('machinery', 'factory');
      if (r?.success) ctx.note('machinery+1');
    }
    void capital;
  },
};

describeSim('Mid-game strategy comparison (manual)', () => {
  jest.setTimeout(3_600_000 * 3);

  it('deploys the same $30k five ways for 150 weeks', async () => {
    const capital = Number(process.env.CAPITAL ?? 30_000);
    const weeks = Number(process.env.WEEKS ?? 150);
    const seeds = (process.env.SEEDS ?? '1').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    const results: SimResult[] = [];
    for (const [name, make] of Object.entries(STRATEGIES)) {
      for (const seed of seeds) {
        results.push(
          await runPersona({
            name,
            seed,
            weeks,
            policy: make(capital),
            mutateSeed: withSoftwareJobAndCapital(capital),
          }),
        );
      }
    }
    const out: string[] = [];
    out.push(`===== STRATEGIES ($${capital} + software L0, ${weeks} weeks) =====`);
    const horizons = [26, 52, 104, weeks];
    out.push(`strategy                        | seed | ${horizons.map((h) => `netW@${h}`.padStart(9)).join(' | ')} | cash | save | invest | prop | debt | passive | status | notes`);
    for (const r of results) {
      const last = r.rows[r.rows.length - 1];
      const notes = r.rows.flatMap((row) => row.notes.filter((n) => /bought|refused|founded|machinery|deposit|buy 4|enrol/.test(n))).slice(0, 4).join('; ');
      out.push(
        `${r.name.padEnd(31)} | ${String(r.seed).padStart(4)} | ${horizons.map((h) => k(rowAt(r, h)?.netWorth).padStart(9)).join(' | ')} | ${k(last.cash).padStart(4)} | ${k(last.savings).padStart(4)} | ${k(last.invested).padStart(6)} | ${k(last.property).padStart(4)} | ${k(last.debt).padStart(4)} | ${k(last.passive).padStart(7)} | ${r.died ? `DIED ${r.deathWeek}` : 'alive'} | ${notes}`,
      );
    }
    process.stdout.write(`\n\n${out.join('\n')}\n=====\n\n`);
    expect(results.length).toBeGreaterThan(0);
  });
});
