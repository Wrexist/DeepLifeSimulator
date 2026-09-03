/**
 * The nine economic personas from the Master Program 10 brief, as weekly
 * policies over the real action functions (the Program 7 persona pattern).
 *
 * Each persona is a THUMB, not a solver: it reacts to what the screen shows
 * (a low ring, a "Nowhere to live" banner, an unlocked tab, a balance that
 * clears a price tag) and does the one thing that surface invites. Nothing
 * here reads a formula the player cannot see.
 *
 * Shared by the soak (`economyPersonas.sim.test.ts`, which prints the
 * 20/50/100/250-week tables) and the economic gates, so the report's numbers
 * and CI's numbers come from the same players.
 */
import {
  takeFirstJob,
  promoteIfReady,
  doFree,
  rentIfPossible,
  answerPendingEvents,
  answerLifeMoment,
  type SimPolicy,
  type SimWeekContext,
} from './earlyGameSim';
import { RENTAL_TIERS } from '@/lib/realEstate/rentals';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';
import { unlockTier } from '@/lib/progress/featureUnlocks';

/** The Program 7 "average" reflexes every economic persona shares. */
async function baseline(ctx: SimWeekContext, opts: { rentFrom?: number; rentFloor?: number } = {}) {
  await takeFirstJob(ctx);
  await promoteIfReady(ctx);
  await answerPendingEvents(ctx);
  await answerLifeMoment(ctx);
  const s = ctx.state();
  const rentFrom = opts.rentFrom ?? 4;
  const rentFloor = opts.rentFloor ?? 300;
  if (ctx.week >= rentFrom && !s.rental && s.stats.money >= rentFloor) await rentIfPossible(ctx, 'shared-room');
  if (s.stats.happiness < 50) await doFree(ctx, 'meditation', 1);
  if (s.stats.health < 50) await doFree(ctx, 'walk', 1);
  await seeDoctorIfSick(ctx);
}

/**
 * The sickness modal names the doctor; a player with $500 on hand (or in
 * savings) goes. Without this every seed-1 persona died at week 32-34 of a
 * critical back injury caught at fitness 0 while sitting on $6k-$16k.
 */
async function seeDoctorIfSick(ctx: SimWeekContext) {
  const s = ctx.state();
  if ((s.diseases ?? []).length === 0 || s.stats.health >= 60) return;
  if (s.stats.money < 500 && (s.bankSavings ?? 0) >= 500) {
    await ctx.actions.withdraw(Math.min(s.bankSavings ?? 0, 600));
    ctx.note('withdraw for doctor');
  }
  if (ctx.state().stats.money >= 500) {
    const before = ctx.state().stats.money;
    await ctx.actions.performHealthActivity('doctor');
    if (ctx.state().stats.money < before) ctx.note('doctor');
  }
}

/** Move up the rental ladder when income clears the tier and cash covers `weeksOfRent` weeks. */
async function upgradeRentIfComfortable(ctx: SimWeekContext, weeksOfRent: number, maxTier = 'rented-penthouse') {
  const s = ctx.state();
  const income = weeklyCareerSalary(s);
  const current = RENTAL_TIERS.findIndex((t) => t.id === s.rental?.tierId);
  const maxIdx = RENTAL_TIERS.findIndex((t) => t.id === maxTier);
  for (let i = Math.min(maxIdx, RENTAL_TIERS.length - 1); i > current; i--) {
    const tier = RENTAL_TIERS[i];
    if (income >= tier.incomeRequirement && s.stats.money >= tier.weeklyRent * weeksOfRent) {
      await rentIfPossible(ctx, tier.id);
      return;
    }
  }
}

async function eatIfHungry(ctx: SimWeekContext, threshold: number, foodId: 'sandwich' | 'steak' = 'sandwich') {
  const s = ctx.state();
  if (s.stats.energy < threshold && s.stats.money > 100) {
    const r = await ctx.actions.buyFood(foodId);
    if (r?.success) ctx.note(foodId);
  }
}

/** 1. POOR START - $200, age 25, no items. Hustles until the first paycheck, rents late. */
export const poorStart: SimPolicy = async (ctx) => {
  await baseline(ctx, { rentFrom: 2, rentFloor: 500 });
  const s = ctx.state();
  if (s.stats.money < 200 && s.stats.energy >= 60) {
    const r = await ctx.actions.performStreetJob('wash_cars');
    if (r?.success) ctx.note('wash cars');
  }
  await eatIfHungry(ctx, 25);
};

/** 2. AVERAGE WORKER - the Program 7 average persona plus "move somewhere nicer when it is comfortable". */
export const averageWorker: SimPolicy = async (ctx) => {
  await baseline(ctx);
  if (ctx.week >= 8 && ctx.week % 4 === 0) await upgradeRentIfComfortable(ctx, 10, 'rented-apartment');
  await eatIfHungry(ctx, 30);
};

/**
 * 3. CAREER CLIMBER - saves toward a degree once the Education app unlocks,
 * takes the student loan the enrol screen offers when cash is short, and
 * moves to the degree career the moment the diploma lands.
 */
export function makeCareerClimber(): SimPolicy {
  let target: 'business_degree' | 'masters_degree' | null = 'business_degree';
  return async (ctx) => {
    await baseline(ctx);
    const s = ctx.state();
    const tier = unlockTier(s);
    const active = (s.educations ?? []).find((e) => e && !e.completed && (e.weeksRemaining ?? 0) > 0);
    const done = (id: string) => (s.educations ?? []).some((e) => e?.id === id && e.completed);
    if (tier >= 2 && !active && target && !done(target) && s.currentJob) {
      // Enrol when the loan the screen quotes is serviceable on this salary.
      if (weeklyCareerSalary(s) >= 130) {
        await ctx.actions.enroll(target, s.stats.money >= 48_000 ? 'cash' : 'loan');
        const now = ctx.state();
        if ((now.educations ?? []).some((e) => e?.id === target)) ctx.note(`enrolled ${target}`);
      }
    }
    if (done('business_degree') && target === 'business_degree') target = 'masters_degree';
    // Diploma in hand and still on the entry ladder → switch to the degree career.
    const degreeJobs = done('masters_degree') ? ['therapist', 'veterinarian', 'teacher'] : ['teacher', 'nurse'];
    const onDegreeJob = degreeJobs.includes(s.currentJob ?? '');
    if (done('business_degree') && !onDegreeJob && s.currentJob) {
      await ctx.actions.quitJob();
      ctx.note('quit for degree job');
    }
    if (done('business_degree') && !ctx.state().currentJob) {
      for (const id of degreeJobs) {
        const r = await ctx.actions.applyForJob(id);
        if (r?.success) {
          ctx.note(`apply ${id}`);
          break;
        }
      }
    }
    if (ctx.week % 4 === 0) await upgradeRentIfComfortable(ctx, 8, 'rented-house');
    await eatIfHungry(ctx, 30);
  };
}

/**
 * 4. HIGH-SPENDER - eats steak when tired, moves up the moment rent is
 * affordable for a month, buys the fun items, a car at the first $20k, a pet
 * when the app opens, a massage when sad.
 */
export const highSpender: SimPolicy = async (ctx) => {
  await baseline(ctx);
  await upgradeRentIfComfortable(ctx, 4);
  const s = ctx.state();
  await eatIfHungry(ctx, 70, 'steak');
  for (const item of ['guitar', 'bike', 'smartphone']) {
    if (!(s.items ?? []).find((i) => i.id === item)?.owned && s.stats.money >= 1_500) {
      const r = await ctx.actions.buyItem(item);
      if (r !== undefined || ctx.state().stats.money < s.stats.money) ctx.note(`buy ${item}`);
      break;
    }
  }
  if (s.stats.happiness < 70 && s.stats.money >= 1_000) {
    await ctx.actions.performHealthActivity('massage');
    ctx.note('massage');
  }
  if (unlockTier(s) >= 3 && s.stats.money >= 20_000) {
    if (!s.hasDriversLicense) {
      const r = await ctx.actions.getLicense();
      if (r?.success) ctx.note('licence');
    } else if (!(s.vehicles ?? []).some((v) => v?.owned)) {
      const r = await ctx.actions.buyVehicle('economy_sedan');
      if (r?.success) ctx.note('buy sedan');
    }
  }
  if (unlockTier(s) >= 2 && s.stats.money >= 15_000 && (s.pets ?? []).length === 0) {
    const r = await ctx.actions.buyPet('cat_tabby');
    if (r?.success) ctx.note('adopt cat');
  }
};

/** 5. SAVER - shared room forever, sandwich only when starving, everything over a $300 float into savings. */
export const saver: SimPolicy = async (ctx) => {
  await baseline(ctx);
  await eatIfHungry(ctx, 20);
  const s = ctx.state();
  const surplus = Math.floor(s.stats.money - 300);
  if (surplus >= 50) {
    await ctx.actions.deposit(surplus);
    ctx.note(`save ${surplus}`);
  }
};

/** 6. INVESTOR - from the Stocks unlock, every dollar over a $500 float goes into a dividend blue-chip. */
export const investor: SimPolicy = async (ctx) => {
  await baseline(ctx);
  await eatIfHungry(ctx, 30);
  const s = ctx.state();
  if (unlockTier(s) < 2) return;
  const surplus = Math.floor(s.stats.money - 500);
  if (surplus >= 100) {
    const picks = ['JNJ', 'JPM', 'KO', 'PG'];
    const symbol = picks[ctx.week % picks.length];
    await ctx.actions.buyStock(symbol, Math.floor(surplus / 1.02));
    ctx.note(`buy ${symbol} ${Math.floor(surplus / 1.02)}`);
  }
};

/**
 * 7. RISK-TAKER - the same float, but into TSLA/NVDA at tier 2 and into
 * crypto once the Crypto app opens; borrows $3k the week the bank will lend it.
 */
export function makeRiskTaker(): SimPolicy {
  let borrowed = false;
  return async (ctx) => {
    await baseline(ctx);
    await eatIfHungry(ctx, 30);
    const s = ctx.state();
    const tier = unlockTier(s);
    if (tier >= 1 && !borrowed && ctx.week >= 10 && s.currentJob) {
      const before = s.stats.money;
      await ctx.actions.takeLoan(3_000, 52, 'personal');
      if (ctx.state().stats.money > before) {
        borrowed = true;
        ctx.note('loan 3k');
      }
    }
    const surplus = Math.floor(ctx.state().stats.money - 300);
    if (surplus < 100) return;
    if (tier >= 3) {
      const coin = ctx.week % 2 === 0 ? 'btc' : 'sol';
      await ctx.actions.buyCrypto(coin, surplus);
      ctx.note(`buy ${coin} ${surplus}`);
    } else if (tier >= 2) {
      const symbol = ctx.week % 2 === 0 ? 'TSLA' : 'NVDA';
      await ctx.actions.buyStock(symbol, Math.floor(surplus / 1.02));
      ctx.note(`buy ${symbol} ${Math.floor(surplus / 1.02)}`);
    }
  };
}

/**
 * 8. OPTIMIZER - the Program 7 strategic player grown up: musician if offered,
 * bedsit on day one, walks and meditations, deliveries with spare energy,
 * Computer Science on a loan as soon as it is offered, buys the computer and
 * moves to software, invests the surplus, buys the studio with a small
 * deposit once the mortgage is affordable.
 */
export function makeOptimizer(): SimPolicy {
  return async (ctx) => {
    await takeFirstJob(ctx, ['musician', 'farmer', 'chef']);
    await promoteIfReady(ctx);
    await answerPendingEvents(ctx);
    await answerLifeMoment(ctx);
    let s = ctx.state();
    if (!s.rental) {
      if (!(await rentIfPossible(ctx, 'bedsit'))) await rentIfPossible(ctx, 'shared-room');
    }
    await doFree(ctx, 'walk', 2);
    await doFree(ctx, 'meditation', 2);
    await seeDoctorIfSick(ctx);
    for (let i = 0; i < 2; i++) {
      if (ctx.state().stats.energy < 40) break;
      const r = await ctx.actions.performStreetJob('delivery');
      if (!r?.success) break;
      ctx.note('delivery');
    }
    await eatIfHungry(ctx, 35);
    s = ctx.state();
    const tier = unlockTier(s);
    const done = (id: string) => (s.educations ?? []).some((e) => e?.id === id && e.completed);
    const active = (s.educations ?? []).find((e) => e && !e.completed && (e.weeksRemaining ?? 0) > 0);
    if (tier >= 2 && !active && !done('computer_science') && s.currentJob && weeklyCareerSalary(s) >= 130) {
      await ctx.actions.enroll('computer_science', 'loan');
      if ((ctx.state().educations ?? []).some((e) => e?.id === 'computer_science')) ctx.note('enrolled CS (loan)');
    }
    if (done('computer_science')) {
      const hasComputer = (s.items ?? []).find((i) => i.id === 'computer')?.owned;
      if (!hasComputer && s.stats.money >= 5_500) {
        await ctx.actions.buyItem('computer');
        ctx.note('buy computer');
      }
      if (ctx.state().items.find((i) => i.id === 'computer')?.owned && s.currentJob !== 'software') {
        if (s.currentJob) {
          await ctx.actions.quitJob();
          ctx.note('quit for software');
        }
        const r = await ctx.actions.applyForJob('software');
        if (r?.success) ctx.note('apply software');
      }
    }
    s = ctx.state();
    if (ctx.week % 4 === 0) await upgradeRentIfComfortable(ctx, 10, 'rented-apartment');
    s = ctx.state();
    const ownsHome = (s.realEstate ?? []).some((p) => p?.owned);
    if (tier >= 2 && !ownsHome && s.currentJob === 'software' && s.stats.money >= 25_000) {
      const r = await ctx.actions.buyProperty('studio-apt', 'low', '30y', true);
      ctx.note(r?.success ? 'buy studio (10% down)' : `studio refused: ${r?.message ?? ''}`.slice(0, 50));
    }
    s = ctx.state();
    const float = ownsHome ? 2_000 : 1_000;
    const surplus = Math.floor(s.stats.money - float);
    if (tier >= 2 && surplus >= 200 && (ownsHome || s.currentJob === 'software' || s.stats.money >= 30_000)) {
      const picks = ['MSFT', 'AAPL', 'JPM', 'V'];
      const symbol = picks[ctx.week % picks.length];
      await ctx.actions.buyStock(symbol, Math.floor(surplus / 1.02));
      ctx.note(`buy ${symbol} ${Math.floor(surplus / 1.02)}`);
    }
  };
}

/** 9. TEXT-SKIPPER - takes the first job, taps Next Week, reads nothing. */
export const textSkipper: SimPolicy = async (ctx) => {
  await takeFirstJob(ctx);
};

export interface EconomyPersonaSpec {
  make: () => SimPolicy;
  scenarioId: string;
}

export const ECONOMY_PERSONAS: Record<string, EconomyPersonaSpec> = {
  'POOR START': { make: () => poorStart, scenarioId: 'immigrant_story' },
  'AVERAGE WORKER': { make: () => averageWorker, scenarioId: 'food_courier' },
  'CAREER CLIMBER': { make: makeCareerClimber, scenarioId: 'food_courier' },
  'HIGH-SPENDER': { make: () => highSpender, scenarioId: 'food_courier' },
  SAVER: { make: () => saver, scenarioId: 'food_courier' },
  INVESTOR: { make: () => investor, scenarioId: 'food_courier' },
  'RISK-TAKER': { make: makeRiskTaker, scenarioId: 'food_courier' },
  OPTIMIZER: { make: makeOptimizer, scenarioId: 'food_courier' },
  'TEXT-SKIPPER': { make: () => textSkipper, scenarioId: 'food_courier' },
};
