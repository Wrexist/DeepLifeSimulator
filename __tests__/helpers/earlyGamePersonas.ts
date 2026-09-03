/**
 * The five reasonable-player personas from the Master Program 7 brief, plus
 * the recovery player - as weekly policies over the real action functions.
 *
 * Shared by the manual soak (`earlyGamePersonas.sim.test.ts`, which prints
 * the tables) and the CI gates (`earlyGameSurvivability.test.ts`, which pin
 * the outcomes), so the numbers in the report and the numbers CI enforces
 * come from the same players.
 *
 * Each persona is deliberately NOT optimal. A policy is what a thumb does,
 * not what a solver would do: "average" reacts to a ring that reads Low,
 * "careful" reads the recap line and does the two free things it names,
 * "struggling" misses the job, eats steak and never rents.
 */
import {
  takeFirstJob,
  promoteIfReady,
  doFree,
  rentIfPossible,
  type SimPolicy,
} from './earlyGameSim';

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
 * free, rents a room and sees the doctor when it can afford to. A factory,
 * because the trigger is remembered across weeks.
 */
export function makeRecovery(): SimPolicy {
  let recovering = false;
  return async (ctx) => {
    await takeFirstJob(ctx);
    const s = ctx.state();
    const critical = s.stats.health <= 20 || s.stats.happiness <= 20;
    if (!critical && !recovering) return;
    if (!recovering) ctx.note('RECOVERY STARTS');
    recovering = true;
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
}

/** Persona factories - a fresh policy per run, so stateful ones start clean. */
export const PERSONAS: Record<string, () => SimPolicy> = {
  'B text skipper': () => textSkipper,
  'A average': () => average,
  'C careful': () => careful,
  'D struggling': () => struggling,
  'E strategic': () => strategic,
  'R recovery': makeRecovery,
};
