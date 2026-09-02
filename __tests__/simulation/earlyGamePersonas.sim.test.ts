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
import {
  runPersona,
  formatRun,
  takeFirstJob,
  promoteIfReady,
  doFree,
  rentIfPossible,
  type SimPolicy,
  type SimResult,
} from '../helpers/earlyGameSim';

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

// ── Personas ────────────────────────────────────────────────────────────────

/** B — takes the first job, taps Next Week. Reads nothing. */
export const textSkipper: SimPolicy = async (ctx) => {
  await takeFirstJob(ctx);
};

/**
 * A — takes the first job; notices a vital once it is visibly low (<50 on the
 * ring) and does ONE free fix for it; rents the cheapest room a few weeks after
 * the "Nowhere to live" banner; takes the promotion when Work shows it.
 */
export const average: SimPolicy = async (ctx) => {
  await takeFirstJob(ctx);
  await promoteIfReady(ctx);
  const s = ctx.state();
  if (ctx.week >= 4 && !s.rental && s.stats.money >= 300) await rentIfPossible(ctx, 'shared-room');
  if (s.stats.happiness < 50) await doFree(ctx, 'meditation', 1);
  if (s.stats.health < 50) await doFree(ctx, 'walk', 1);
};

/**
 * C — reads the recap line: one walk and one meditation every week from week
 * 1, rents the shared room as soon as the banner names it, promotes on time,
 * eats when energy is low.
 */
export const careful: SimPolicy = async (ctx) => {
  await takeFirstJob(ctx);
  await promoteIfReady(ctx);
  const s = ctx.state();
  if (ctx.week >= 1 && !s.rental) await rentIfPossible(ctx, 'shared-room');
  if (ctx.week >= 1) {
    await doFree(ctx, 'walk', 1);
    await doFree(ctx, 'meditation', 1);
  }
  if (ctx.state().stats.energy < 30 && ctx.state().stats.money > 100) {
    const r = await ctx.actions.buyFood('sandwich');
    if (r?.success) ctx.note('sandwich');
  }
};

/**
 * D — struggling: misses the job for three weeks (panhandles instead), buys a
 * steak every week for energy, never rents, only reacts at the critical tip
 * (a vital ≤ 20) and then with one free fix.
 */
export const struggling: SimPolicy = async (ctx) => {
  const s = ctx.state();
  if (ctx.week < 3 && !s.currentJob) {
    for (let i = 0; i < 2; i++) {
      const r = await ctx.actions.performStreetJob('panhandle');
      if (!r?.success) break;
      ctx.note('panhandle');
    }
  } else if (!s.currentJob) {
    await takeFirstJob(ctx);
  }
  if (ctx.state().stats.money >= 40) {
    const r = await ctx.actions.buyFood('steak');
    if (r?.success) ctx.note('steak');
  }
  if (ctx.state().stats.happiness <= 20) await doFree(ctx, 'meditation', 1);
  if (ctx.state().stats.health <= 20) await doFree(ctx, 'walk', 1);
};

/**
 * E — strategic: picks the musician (the only positive happiness toll) if it
 * is on the board, rents the bedsit on day one, does two walks and two
 * meditations a week, cycles deliveries with the spare energy, promotes on
 * time.
 */
export const strategic: SimPolicy = async (ctx) => {
  await takeFirstJob(ctx, ['musician', 'farmer', 'chef']);
  await promoteIfReady(ctx);
  const s = ctx.state();
  if (!s.rental) {
    if (!(await rentIfPossible(ctx, 'bedsit'))) await rentIfPossible(ctx, 'shared-room');
  }
  await doFree(ctx, 'walk', 2);
  await doFree(ctx, 'meditation', 2);
  for (let i = 0; i < 2; i++) {
    if (ctx.state().stats.energy < 40) break;
    const r = await ctx.actions.performStreetJob('delivery');
    if (!r?.success) break;
    ctx.note('delivery');
  }
};

/**
 * R — recovery: plays like the text-skipper until the first CRITICAL tip
 * (health or happiness ≤ 20), then does everything the Health tab offers for
 * free, rents a room and sees the doctor when it can afford to.
 */
export const recovery: SimPolicy = async (ctx) => {
  await takeFirstJob(ctx);
  const s = ctx.state();
  const critical = s.stats.health <= 20 || s.stats.happiness <= 20;
  const started = (ctx as any).__recovering ?? false;
  if (!critical && !started) return;
  (ctx as any).__recovering = true;
  await promoteIfReady(ctx);
  if (!s.rental) await rentIfPossible(ctx, 'shared-room');
  await doFree(ctx, 'walk', 4);
  await doFree(ctx, 'meditation', 4);
  if (ctx.state().stats.health < 30 && ctx.state().stats.money >= 500) {
    const before = ctx.state().stats.money;
    await ctx.actions.performHealthActivity('doctor');
    if (ctx.state().stats.money < before) ctx.note('doctor');
  }
};

export const PERSONAS: Record<string, SimPolicy> = {
  'B text skipper': textSkipper,
  'A average': average,
  'C careful': careful,
  'D struggling': struggling,
  'E strategic': strategic,
  'R recovery': recovery,
};

const describeSim = process.env.RUN_EARLY_GAME_SIM ? describe : describe.skip;

describeSim('Early-game persona soak (manual)', () => {
  jest.setTimeout(3_600_000);

  it('prints the first 20 weeks of every persona', async () => {
    const seeds = (process.env.SEEDS ?? '1,2,3').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    const scenarioId = process.env.SCENARIO ?? 'food_courier';
    const weeks = Number(process.env.WEEKS ?? 20);
    const results: SimResult[] = [];
    const only = (process.env.PERSONAS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const [name, policy] of Object.entries(PERSONAS)) {
      if (only.length && !only.includes(name[0])) continue;
      for (const seed of seeds) {
        // A recovery persona carries its trigger flag across weeks on the ctx
        // object; a fresh closure per run keeps runs independent.
        let recovering = false;
        const wrapped: SimPolicy = async (ctx) => {
          (ctx as any).__recovering = recovering;
          await policy(ctx);
          recovering = (ctx as any).__recovering ?? false;
        };
        const fitness = process.env.FITNESS ? Number(process.env.FITNESS) : undefined;
        results.push(await runPersona({
          name,
          policy: wrapped,
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
