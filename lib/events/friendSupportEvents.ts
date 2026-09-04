/**
 * Somebody shows up — Master Program 12.
 *
 * ## Why these exist
 *
 * The game had exactly one "support" event, and it ran the wrong way: the
 * player supporting a PARTNER through job loss (`lifeMilestoneEvents`). Nothing
 * in ~400 templates ever supported the player. Combined with the measurement in
 * `lib/social/closeness.ts` — happiness, health and energy byte-identical
 * whether a life held nobody, one soulmate or fifty acquaintances — that is the
 * whole reason a relationship could not answer "why does this person matter?"
 * with anything except a number.
 *
 * These are the answer. Each one fires only when TWO things are true at once:
 * the player is genuinely in trouble, and there is somebody they have actually
 * built something with (`BOND.close`, 60). Neither alone is enough, which is
 * exactly what makes the bond worth having and what keeps the loner's life
 * intact — a player with no close bonds simply never sees these, and loses
 * nothing they had.
 *
 * ## Why there are three and not thirty
 *
 * §13 of the brief: prefer small reusable structures with state-aware outcomes
 * over hundreds of bespoke events. One shape — crisis + a named friend + a
 * choice between leaning on them and not — instantiated against the three
 * crises the game actually produces and has measured players dying in:
 * untreated illness, unemployment, and arrears.
 *
 * ## Why accepting costs something
 *
 * Every "accept" branch spends relationship score. That is the tradeoff (§17)
 * and it is also the anti-farm guard (§31): help is bounded to the crisis, and
 * taking it drops the bond far enough that a player has to put real weeks back
 * in before the same friend can show up again. A friendship you only call on
 * when you need something stops being one — which is both true and testable.
 *
 * `relationId` binds every effect to the ACTUAL person, so the bond that pays
 * for the help is theirs, and the story the journal records has a name in it.
 */

import type { GameState } from '@/contexts/game/types';
import type { EventTemplate } from './engine';
import { supportCircle } from '@/lib/social/closeness';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';

/**
 * The inert event a template returns if it is ever generated without a helper.
 * One dismissible line and no effects - strictly better than throwing inside
 * the week loop, and it can never actually be seen because every `condition`
 * above requires the helper it degrades for.
 */
const NOBODY_HOME = (id: string) => ({
  id,
  description: 'A quiet week.',
  choices: [{ id: 'continue', text: 'Continue', effects: {} }],
});

/** Bond spent by leaning on somebody. Four weeks of Calls to earn back. */
export const SUPPORT_BOND_COST = -12;

/** Bond gained by not leaning on them — you were there, they noticed. */
export const SUPPORT_DECLINE_BOND = 4;

/** Ceiling on the cash a friend will ever cover, whatever the arrears are. */
export const SUPPORT_CASH_CAP = 400;

/**
 * The closest person who would actually show up, or `undefined`.
 *
 * `supportCircle` is the TRUSTED band (80), not merely close (60). A bond of 60
 * is somebody your life is better for having; 80 is somebody who drives across
 * town at eleven at night. Keeping the two apart is what gives the upper half
 * of the scale a job — before Program 12, 60, 75, 90 and 100 were measurably
 * identical on every axis.
 */
function helper(state: GameState) {
  return supportCircle(state)[0];
}

/** How they are described when the copy needs a word for them. */
function relationWord(type: string | undefined): string {
  if (type === 'parent') return 'your mother';
  if (type === 'spouse' || type === 'partner') return 'your partner';
  return 'your friend';
}

/**
 * Properly unwell — a disease the player has been carrying, with health low
 * enough that it shows.
 *
 * Measured rather than guessed: across the twelve Program 12 personas over 250
 * weeks, `ill && health < 45` occurs 3-10 weeks in EVERY life, so this is a
 * state a played life actually reaches. An earlier cut also required the player
 * to be broke, and that combination occurred in 0 weeks for ten of the twelve —
 * an event gated on a state nobody reaches is decoration, which is the exact
 * defect Program 11 catalogued in `networking_opportunity`.
 *
 * Dropping the money gate is also the better sentence: somebody who notices you
 * have been ill for weeks is not checking your balance first. The thing this
 * addresses is the failure mode three programs have now measured — players who
 * are ill and do not act — not players who cannot pay.
 */
const ill = (state: GameState): boolean =>
  (state.diseases ?? []).length > 0 && (state.stats?.health ?? 100) < 45;

const brokeFor = (state: GameState, need: number): boolean =>
  (state.stats?.money ?? 0) < need && (state.bankSavings ?? 0) < need;

/**
 * ILL AND BROKE — the crisis the simulator kills personas with.
 *
 * Program 10 and 11 both measured personas dying at weeks 32-80 of an untreated
 * illness, and Program 10's fix was to teach the persona to tap the doctor. The
 * ones that still died were the ones who could not afford it. This is what a
 * close friend is for, and it pays in the currency the crisis is actually
 * denominated in — health, not cash, so it can never be converted into money.
 */
const friendGetsYouSeen: EventTemplate = {
  id: 'friend_gets_you_seen',
  category: 'relationship',
  weight: (state) => (ill(state) && helper(state) ? 3.5 : 0),
  condition: (state) => ill(state) && !!helper(state),
  generate: (state) => {
    const friend = helper(state);
    // `generate` must never throw: a template that does turns one subsystem's
    // fault into a lost week for the whole save (CLAUDE.md 4.3). The condition
    // above already guarantees a helper; this is the belt for the engine paths
    // that call `generate` without re-checking.
    if (!friend) return NOBODY_HOME('friend_gets_you_seen');
    return {
      id: 'friend_gets_you_seen',
      relationId: friend.id,
      description: `You have been ill for weeks and have not done anything about it. ${friend.name} turns up at the door, having heard from somebody, and says they are driving you to a clinic and will not be arguing about it.`,
      choices: [
        {
          id: 'go',
          text: 'Let them take you',
          effects: {
            stats: { health: 22, happiness: 6, energy: -4 },
            relationship: SUPPORT_BOND_COST,
            karma: { dimension: 'loyalty', amount: 2, reason: 'Let someone help when it was needed' },
          },
        },
        {
          id: 'refuse',
          text: 'Tell them you are fine',
          effects: {
            stats: { happiness: -4 },
            relationship: SUPPORT_DECLINE_BOND,
          },
        },
      ],
    };
  },
};

/**
 * OUT OF WORK — the friend who knows somebody.
 *
 * Pays in reputation, which is what the job board actually reads
 * (`calculateMatchProbability`, the promotion gates and the application
 * pipeline all key off it), so this is a leg-up into the system the player is
 * already trying to re-enter rather than a cash gift.
 */
const friendHasALead: EventTemplate = {
  id: 'friend_has_a_lead',
  category: 'relationship',
  weight: (state) => (!state.currentJob && helper(state) ? 3 : 0),
  condition: (state) =>
    !state.currentJob
    && ((state.lifetimeStatistics?.totalWeeksWorked ?? 0) > 0
      || (state.lifetimeStatistics?.careerHistory?.length ?? 0) > 0)
    && !!helper(state),
  generate: (state) => {
    const friend = helper(state);
    if (!friend) return NOBODY_HOME('friend_has_a_lead');
    return {
      id: 'friend_has_a_lead',
      relationId: friend.id,
      description: `${friend.name} has been asking around since you lost the job. "It is not much," they say, "but they know your name now, and they are expecting a call."`,
      choices: [
        {
          id: 'call',
          text: 'Make the call',
          effects: {
            stats: { reputation: 14, happiness: 6, energy: -5 },
            relationship: SUPPORT_BOND_COST,
            karma: { dimension: 'loyalty', amount: 2, reason: 'Took a hand up from a friend' },
          },
        },
        {
          id: 'own_way',
          text: 'Thank them, but do it on your own',
          effects: {
            stats: { reputation: 4, happiness: -2 },
            relationship: SUPPORT_DECLINE_BOND,
          },
        },
      ],
    };
  },
};

/**
 * BEHIND ON EVERYTHING — somebody covers one bill.
 *
 * The only branch here that pays cash, and it is bounded three ways: it needs
 * real arrears (`overdueBalance`, v31) or no home, it pays at most
 * `SUPPORT_CASH_CAP`, and taking it spends 12 points of a bond that must sit at
 * 60 for the event to exist at all. A player who leans on the same person twice
 * drops them out of the close circle and the event stops firing until the
 * friendship is genuinely rebuilt.
 */
const friendCoversABill: EventTemplate = {
  id: 'friend_covers_a_bill',
  category: 'relationship',
  weight: (state) => {
    const inTrouble = (state.overdueBalance ?? 0) > 0 || computeHousingWellbeing(state).homeless;
    return inTrouble && brokeFor(state, 200) && helper(state) ? 2.5 : 0;
  },
  condition: (state) => {
    const inTrouble = (state.overdueBalance ?? 0) > 0 || computeHousingWellbeing(state).homeless;
    return inTrouble && brokeFor(state, 200) && !!helper(state);
  },
  generate: (state) => {
    const friend = helper(state);
    if (!friend) return NOBODY_HOME('friend_covers_a_bill');
    const owed = Math.max(0, Math.round(state.overdueBalance ?? 0));
    const covered = Math.max(120, Math.min(SUPPORT_CASH_CAP, owed || SUPPORT_CASH_CAP));
    return {
      id: 'friend_covers_a_bill',
      relationId: friend.id,
      description: `${friend.name} notices you have stopped mentioning money at all. Without making anything of it, they offer to cover $${covered} of what you are behind on - "pay me back when it is boring to."`,
      choices: [
        {
          id: 'accept',
          text: `Take the $${covered}`,
          effects: {
            money: covered,
            stats: { happiness: 5 },
            relationship: SUPPORT_BOND_COST,
            karma: { dimension: 'honesty', amount: 1, reason: 'Was honest with a friend about money' },
          },
        },
        {
          id: 'decline',
          text: 'Say no - you will manage',
          effects: {
            stats: { happiness: -3, reputation: 2 },
            relationship: SUPPORT_DECLINE_BOND,
          },
        },
      ],
    };
  },
};

/**
 * The other direction, so support is not a one-way faucet: somebody close is in
 * trouble, and the player decides whether to be the one who shows up. Same
 * shape, opposite sign — and it is the branch that makes the bond a
 * RELATIONSHIP rather than an insurance policy.
 */
const theyNeedYou: EventTemplate = {
  id: 'close_friend_needs_you',
  category: 'relationship',
  /**
   * 1.6 — mid-pool, which is where a recurring-but-not-constant beat belongs.
   *
   * Worth recording what happened when this was tuned, because the result is a
   * finding about the ENGINE rather than about this event. In a mid-game week
   * the eligible pool totals ~24 weight across ~83 templates and a 250-week
   * life answers 42-48 events, so a share of 1.6/24 predicts three or four
   * occurrences. Measured: exactly ONE, in week 591, in all four probe lives.
   * Doubling the weight to 3.0 changed nothing at all - same single occurrence,
   * same week, all four lives.
   *
   * That is not variance. The weekly pick is deterministic in the WEEK and is
   * not salted per life on this path, so every life draws the same event on the
   * same week whatever the weights say (`tasks/relationship-depth-2026-09-03.md`
   * §14). It is the same class Program 8 fixed for the disease and pre-roll
   * streams and evidently did not reach here, it affects all ~400 templates
   * rather than these four, and fixing it needs its own measurement. So the
   * weight is left at a value justified by the pool it sits in, rather than one
   * tuned against an experiment that demonstrably did not respond.
   */
  weight: (state) => (helper(state) && (state.stats?.money ?? 0) > 400 ? 1.6 : 0),
  condition: (state) => !!helper(state),
  generate: (state) => {
    const friend = helper(state);
    if (!friend) return NOBODY_HOME('close_friend_needs_you');
    return {
      id: 'close_friend_needs_you',
      relationId: friend.id,
      description: `${friend.name} calls late and takes a while to get to it. Things have gone wrong - ${relationWord(friend.type)} is short, behind, and out of people to ask.`,
      choices: [
        {
          id: 'help',
          text: 'Cover them ($300)',
          effects: {
            money: -300,
            stats: { happiness: 8 },
            relationship: 10,
            karma: { dimension: 'generosity', amount: 4, reason: 'Helped somebody close when it cost something' },
          },
        },
        {
          id: 'listen',
          text: 'You cannot spare it - stay on the phone',
          effects: {
            stats: { happiness: 2, energy: -3 },
            relationship: 3,
          },
        },
        {
          id: 'busy',
          text: 'Tell them you are swamped',
          effects: {
            stats: { happiness: -5 },
            relationship: -10,
            karma: { dimension: 'loyalty', amount: -3, reason: 'Was unavailable when somebody close needed help' },
          },
        },
      ],
    };
  },
};

/** Registered in `eventTemplates`; every one is weight-0 unless it applies. */
export const friendSupportEventTemplates: EventTemplate[] = [
  friendGetsYouSeen,
  friendHasALead,
  friendCoversABill,
  theyNeedYou,
];
