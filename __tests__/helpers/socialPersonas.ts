/**
 * The seven social personas from the Master Program 11 brief, as weekly
 * policies over the real action functions (the Program 7/10 persona pattern).
 *
 * Each persona is a THUMB. It reacts to what the screen actually offers at the
 * tier it has reached: a locked Spark app cannot be swiped, a friend has no
 * date sheet, a partner has no "Bond" chip. Nothing here reaches past the UI.
 *
 * The point of the set is CHOICE. LONER never opens a social surface and must
 * still be able to live a full life; FRIENDSHIP-FOCUSED and ROMANCE-FOCUSED
 * spend real weeks on people; CAREER-OBSESSED spends none by preference rather
 * than by blockage. If the loner's numbers and the socialite's numbers look the
 * same, the social systems are not doing anything.
 *
 * Shared by the soak (`socialPersonas.sim.test.ts`, which prints the tables)
 * and the Phase-11 gates, so the report's numbers and CI's numbers come from
 * the same players.
 */
import {
  takeFirstJob,
  promoteIfReady,
  doFree,
  rentIfPossible,
  answerPendingEvents,
  answerLifeMoment,
  swipeForMatches,
  befriendMatches,
  meetIfOffered,
  keepInTouch,
  courtMatches,
  courtPartner,
  type SimPolicy,
  type SimWeekContext,
} from './earlyGameSim';
import { unlockTier } from '@/lib/progress/featureUnlocks';
import { ENGAGEMENT_RINGS } from '@/lib/dating/engagementRings';

/**
 * The survival reflexes every persona shares, lifted from the economic
 * baseline: take a job, take a promotion, answer what the game raises, get a
 * roof, rest when low, see a doctor when sick. None of it is social — so any
 * social difference between personas below is caused by the social policy and
 * not by one of them simply living longer.
 */
async function baseline(ctx: SimWeekContext) {
  await takeFirstJob(ctx);
  await promoteIfReady(ctx);
  await answerPendingEvents(ctx);
  await answerLifeMoment(ctx);
  const s = ctx.state();
  if (ctx.week >= 4 && !s.rental && s.stats.money >= 300) await rentIfPossible(ctx, 'shared-room');
  if (s.stats.happiness < 50) await doFree(ctx, 'meditation', 1);
  if (s.stats.health < 50) await doFree(ctx, 'walk', 1);
  await seeDoctorIfSick(ctx);
}

/** The Program 10 doctor reflex — without it every persona dies of the same untreated injury. */
async function seeDoctorIfSick(ctx: SimWeekContext) {
  const s = ctx.state();
  if ((s.diseases ?? []).length === 0 || s.stats.health >= 60) return;
  if (s.stats.money < 500 && (s.bankSavings ?? 0) >= 500) {
    await ctx.actions.withdraw(Math.min(s.bankSavings ?? 0, 600));
  }
  if (ctx.state().stats.money >= 500) {
    const before = ctx.state().stats.money;
    await ctx.actions.performHealthActivity('doctor');
    if (ctx.state().stats.money < before) ctx.note('doctor');
  }
}

/** Is Spark on the grid yet? Swiping before tier 2 is reaching past the UI. */
const sparkOpen = (ctx: SimWeekContext) => unlockTier(ctx.state()) >= 2;

/** Is the Contacts app on the grid yet? */
const contactsOpen = (ctx: SimWeekContext) => unlockTier(ctx.state()) >= 1;

/** 1. LONER — never opens a social surface. The control. */
export const loner: SimPolicy = async (ctx) => {
  await baseline(ctx);
};

/**
 * The tier-1 door, taken by anyone who opens Contacts (Program 11). A no-op on
 * the weeks nobody is around, which is most of them.
 */
async function meetIfSocial(ctx: SimWeekContext) {
  if (!contactsOpen(ctx)) return;
  await meetIfOffered(ctx);
}

/**
 * 2. CASUAL SOCIAL — rings the people already in the phone every few weeks,
 * and looks at Spark once it appears, but never makes it the week's plan.
 */
export const casualSocial: SimPolicy = async (ctx) => {
  await baseline(ctx);
  await meetIfSocial(ctx);
  if (contactsOpen(ctx) && ctx.week % 4 === 0) await keepInTouch(ctx, { hangOut: false });
  if (sparkOpen(ctx) && ctx.week % 8 === 0) {
    await swipeForMatches(ctx, 5);
    await befriendMatches(ctx, 1);
  }
};

/**
 * 3. FRIENDSHIP-FOCUSED — wants a circle. Swipes for people, promotes every
 * match to a friend, and keeps in touch weekly, paying for Hang Out and the
 * Bond gesture when there is money spare.
 */
export const friendshipFocused: SimPolicy = async (ctx) => {
  await baseline(ctx);
  await meetIfSocial(ctx);
  if (sparkOpen(ctx)) {
    await swipeForMatches(ctx, 10);
    await befriendMatches(ctx, 3);
  }
  if (contactsOpen(ctx)) {
    await keepInTouch(ctx, { hangOut: true, budget: 90 });
    // The paid gesture, but only out of genuinely spare cash — a persona that
    // spends the rent on bonding is measuring bankruptcy, not friendship.
    const s = ctx.state();
    if (s.stats.money > 5000) {
      const weakest = (s.relationships ?? [])
        .filter((r) => r?.type === 'friend' && (r.relationshipScore ?? 0) < 100)
        .sort((a, b) => (a.relationshipScore ?? 0) - (b.relationshipScore ?? 0))[0];
      if (weakest) await ctx.actions.bond(weakest.id);
    }
  }
};

/**
 * 4. ROMANCE-FOCUSED — swipes for a partner, plays the Spark chat toward
 * going steady, then dates and gifts, moves in, and proposes when the game
 * lets them. Everything through the surface a player taps.
 */
export function makeRomanceFocused(): SimPolicy {
  return async (ctx) => {
    await baseline(ctx);
    await meetIfSocial(ctx);
    if (!sparkOpen(ctx)) return;
    const s = ctx.state();
    const partner = (s.relationships ?? []).find((r) => r?.type === 'partner' || r?.type === 'spouse');
    if (!partner) {
      await swipeForMatches(ctx, 10);
      await courtMatches(ctx, 2);
      return;
    }
    // Keep the bond up with the tier the wallet supports, then the milestones.
    const money = s.stats.money;
    await courtPartner(ctx, money > 3000 ? 'romantic' : money > 400 ? 'dinner' : 'chat');
    if (money > 800) await ctx.actions.gift(partner.id, 'flowers');
    if (
      partner.type === 'partner' &&
      partner.livingTogether &&
      partner.engagementWeek == null &&
      (partner.relationshipScore ?? 0) >= 60 &&
      money > 6000
    ) {
      const ring = ENGAGEMENT_RINGS.find((r) => r.price <= money * 0.4) ?? ENGAGEMENT_RINGS[0];
      const r = await ctx.actions.propose(partner.id, ring.id);
      ctx.note(r?.success ? 'proposed' : `propose refused: ${(r?.message ?? '').slice(0, 32)}`);
    }
  };
}

/**
 * 5. CAREER-OBSESSED — every spare week goes to work. Social surfaces ignored
 * by CHOICE, which is the measurement: this persona and LONER are the control
 * for "is a life without relationships still a life?".
 */
export const careerObsessed: SimPolicy = async (ctx) => {
  await baseline(ctx);
  const s = ctx.state();
  if (s.stats.energy >= 40 && !s.currentJob) await ctx.actions.performStreetJob('wash_cars');
  if (s.stats.energy < 30 && s.stats.money > 100) await ctx.actions.buyFood('sandwich');
};

/**
 * 6. FAMILY-FOCUSED — the romance persona, plus the family moves: move in,
 * marry, and use the parenting actions on every child the game gives them.
 */
export function makeFamilyFocused(): SimPolicy {
  const romance = makeRomanceFocused();
  return async (ctx) => {
    await romance(ctx);
    const s = ctx.state();
    // Keep every family bond warm — parents and children both live in
    // `relationships`, so the same Call the Contacts app offers works here.
    if (contactsOpen(ctx) && ctx.week % 2 === 0) await keepInTouch(ctx, { hangOut: false });
    void s;
  };
}

/**
 * 7. RISK-TAKER — spends on people impulsively and drops them: swipes wide,
 * promotes everything, then stops calling. The persona that measures NEGLECT.
 */
export function makeRiskTaker(): SimPolicy {
  return async (ctx) => {
    await baseline(ctx);
    await meetIfSocial(ctx);
    if (!sparkOpen(ctx)) return;
    // A burst of people every ten weeks, and no maintenance in between.
    if (ctx.week % 10 === 0) {
      await swipeForMatches(ctx, 10);
      await befriendMatches(ctx, 3);
      await keepInTouch(ctx, { hangOut: false });
    }
  };
}

export interface SocialPersonaSpec {
  make: () => SimPolicy;
  scenarioId: string;
}

export const SOCIAL_PERSONAS: Record<string, SocialPersonaSpec> = {
  LONER: { make: () => loner, scenarioId: 'food_courier' },
  'CASUAL SOCIAL': { make: () => casualSocial, scenarioId: 'food_courier' },
  'FRIENDSHIP-FOCUSED': { make: () => friendshipFocused, scenarioId: 'food_courier' },
  'ROMANCE-FOCUSED': { make: makeRomanceFocused, scenarioId: 'food_courier' },
  'CAREER-OBSESSED': { make: () => careerObsessed, scenarioId: 'food_courier' },
  'FAMILY-FOCUSED': { make: makeFamilyFocused, scenarioId: 'food_courier' },
  'RISK-TAKER': { make: makeRiskTaker, scenarioId: 'food_courier' },
};
