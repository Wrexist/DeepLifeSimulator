/**
 * Correspondence worth opening.
 *
 * ## The gap this closes
 *
 * The mail app shipped with two kinds of message: documents that tell you
 * something already true (payslips, statements, invoices) and fraud that tries
 * to take money from you. Everything with a DECISION on it was either a bill,
 * a summons or a scam — so opening the inbox was, in feel, a chore with a
 * hazard in it. The owner's report of "too many scam mails" is really a report
 * about that ratio: the scams were not especially frequent in absolute terms,
 * they were most of what the inbox had to say.
 *
 * These are the other half. Every one is a letter a person would actually be
 * pleased to find: an invitation, a parcel, a reward, something from your own
 * past. Several of them PAY, which no decision letter previously did.
 *
 * ## Why they are EVENTS, like the legal pack
 *
 * Same argument as `legalEvents.ts`, and it is worth repeating because it is
 * the reason this file is short. Authored as ordinary `EventTemplate`s, they
 * inherit selection weights, conditions, and — the part that matters —
 * `resolveEvent`, which already knows how to charge money the player can
 * afford, apply karma, refuse an unaffordable choice, and chain a follow-up.
 * Delivery to the inbox is one entry per id in `lib/events/routing.ts`.
 *
 * ## The shape of the choices
 *
 * Not pay-now-versus-risk-more, which is what the legal pack already covers.
 * These trade one axis against another — money for happiness, energy for
 * reputation, cash for karma — so the interesting answer is rarely the free
 * one. The passive option is LAST in every list, because that is the choice
 * `letterFromEvent` takes when a letter is left to expire.
 */

import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';

/** Liquid wealth, for gating letters that only make sense above a floor. */
function liquid(state: GameState): number {
  const money = state.stats?.money ?? 0;
  const savings = state.bankSavings ?? 0;
  const moneySafe = Number.isFinite(money) ? money : 0;
  const savingsSafe = Number.isFinite(savings) ? savings : 0;
  return Math.max(0, moneySafe) + Math.max(0, savingsSafe);
}

function age(state: GameState): number {
  const ageValue = state.date?.age ?? 18;
  return Number.isFinite(ageValue) ? Math.floor(ageValue) : 18;
}

function reputation(state: GameState): number {
  const rep = state.stats?.reputation ?? 0;
  return Number.isFinite(rep) ? Math.max(0, rep) : 0;
}

/**
 * The school reunion.
 *
 * The first choice costs money AND energy and is still the good one — that is
 * the point of putting it against a "regrets" option that costs nothing but
 * happiness. A letter where doing nothing is optimal is not a decision.
 */
const reunionInvite: EventTemplate = {
  id: 'inbox_reunion_invite',
  category: 'relationship',
  weight: 0.3,
  condition: (state) => age(state) >= 27,
  generate: () => ({
    id: 'inbox_reunion_invite',
    description:
      'The organising committee — which is to say one relentlessly cheerful ' +
      'former classmate — is holding a reunion. There is a venue, a fixed menu, ' +
      'and a form asking what you are doing now.\n\n' +
      'Everyone you have not thought about in years will be there, having ' +
      'thought about you exactly as little.',
    choices: [
      {
        id: 'attend',
        text: 'Go, and enjoy it ($180 and a late night)',
        // Deliberately above BIG_STAKES_THRESHOLD (see
        // scripts/lib/contentQualityRatchet.js). A reunion you actually enjoyed
        // is a night people describe years later — if the top branch of this
        // letter were worth +14 it would decay away inside four weeks and the
        // whole decision would have been about $180.
        effects: { money: -180, stats: { happiness: 22, energy: -12, reputation: 4 } },
      },
      {
        id: 'attend_briefly',
        text: 'Show your face for an hour ($60)',
        effects: { money: -60, stats: { happiness: 5, energy: -4, reputation: 2 } },
      },
      {
        id: 'regrets',
        text: 'Send your regrets',
        effects: { stats: { happiness: -3 } },
      },
    ],
  }),
};

/**
 * A parcel nobody will admit to sending.
 *
 * The only letter here with a genuine gamble in it, and the karma split is the
 * substance: handing it in pays nothing and is worth something anyway.
 */
const mysteryParcel: EventTemplate = {
  id: 'inbox_mystery_parcel',
  category: 'general',
  weight: 0.26,
  generate: () => ({
    id: 'inbox_mystery_parcel',
    description:
      'A parcel has been left for you. Your address, correctly spelled, and no ' +
      'sender. It is heavier than it looks and something inside it shifts when ' +
      'you tilt it.\n\n' +
      'The delivery slip has a reference number and a courier who does not ' +
      'answer the phone.',
    choices: [
      {
        id: 'open',
        text: 'Open it',
        effects: { money: 400, stats: { happiness: 6 } },
      },
      {
        id: 'hand_in',
        text: 'Hand it in to the depot',
        effects: {
          stats: { happiness: 2, reputation: 3 },
          karma: { dimension: 'honesty', amount: 2, reason: 'Handed in a misdelivered parcel' },
        },
      },
      {
        id: 'leave_it',
        text: 'Leave it in the hall and forget about it',
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

/**
 * A letter from the player, to the player.
 *
 * Costs nothing and decides nothing material — deliberately. Not every piece of
 * post needs to be a transaction, and an inbox in which every message wants
 * something is an inbox you learn to dread.
 */
const timeCapsule: EventTemplate = {
  id: 'inbox_time_capsule',
  category: 'general',
  weight: 0.2,
  condition: (state) => age(state) >= 30,
  generate: () => ({
    id: 'inbox_time_capsule',
    description:
      'A school scheme from decades ago has finally posted the letters back. ' +
      'This one is in your own handwriting, addressed to you, and it is very ' +
      'confident about how things were going to go.\n\n' +
      'It asks four questions. You can answer two of them honestly.',
    choices: [
      {
        id: 'reply',
        text: 'Write back to yourself and keep it',
        // The most emotionally loaded thing in the pack, and the only letter
        // whose best outcome costs nothing but an evening. Sized to match.
        effects: { stats: { happiness: 24, energy: -3 } },
      },
      {
        id: 'read',
        text: 'Read it twice and put it in a drawer',
        effects: { stats: { happiness: 4 } },
      },
      {
        id: 'bin',
        text: 'Not today',
        effects: { stats: { happiness: -1 } },
      },
    ],
  }),
};

/**
 * The appeal that names a number.
 *
 * `moneyPct` on the large option so it stays a real decision for a millionaire
 * instead of a rounding error — the same scaling the wealth events use.
 */
const charityAppeal: EventTemplate = {
  id: 'inbox_charity_appeal',
  category: 'general',
  weight: 0.24,
  condition: (state) => liquid(state) > 2_000,
  generate: () => ({
    id: 'inbox_charity_appeal',
    description:
      'A local appeal has written to you by name. The letter is specific about ' +
      'what the money does, which is rarer than it should be, and it does not ' +
      'pretend the problem will be solved by your contribution alone.\n\n' +
      'There is a slip at the bottom and a freepost envelope.',
    choices: [
      {
        id: 'give_generously',
        text: 'Give properly (1% of net worth, minimum $250)',
        effects: {
          money: -250,
          moneyPct: 0.01,
          stats: { happiness: 8, reputation: 6 },
          karma: { dimension: 'generosity', amount: 3, reason: 'Gave generously to a local appeal' },
        },
      },
      {
        id: 'give_token',
        text: 'Send what you can spare ($40)',
        effects: {
          money: -40,
          stats: { happiness: 3, reputation: 1 },
          karma: { dimension: 'generosity', amount: 1, reason: 'Gave to a local appeal' },
        },
      },
      {
        id: 'decline',
        text: 'Leave the envelope on the side',
        effects: {},
      },
    ],
  }),
};

/**
 * Someone found your wallet.
 *
 * The inverse of the parcel: here the honest party is the OTHER person, and the
 * decision is what you do about that. Refusing to thank them is free and reads
 * as free, which is what makes taking the cheap option feel like something.
 */
const walletReturned: EventTemplate = {
  id: 'inbox_wallet_returned',
  category: 'general',
  weight: 0.22,
  generate: () => ({
    id: 'inbox_wallet_returned',
    description:
      'Your wallet is in the envelope. So is a note, on the back of a receipt, ' +
      'explaining where it was found and apologising for the state of it.\n\n' +
      'Nothing is missing. There is a phone number at the bottom.',
    choices: [
      {
        id: 'reward',
        text: 'Call them and insist on a reward ($120)',
        effects: {
          money: -120,
          stats: { happiness: 8, reputation: 3 },
          karma: { dimension: 'generosity', amount: 2, reason: 'Rewarded an honest stranger' },
        },
      },
      {
        id: 'thank',
        text: 'Send a card and a thank you',
        effects: { money: -8, stats: { happiness: 4 } },
      },
      {
        id: 'nothing',
        text: 'Say nothing — you got it back, after all',
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

/**
 * A casting call, gated on being known for something.
 *
 * The one letter here that can PAY meaningfully, and it costs energy and a real
 * chance of embarrassment to collect. Gated on reputation so it arrives as a
 * consequence of how the life has gone rather than at random.
 */
const gameShowCasting: EventTemplate = {
  id: 'inbox_game_show_casting',
  category: 'general',
  weight: 0.2,
  condition: (state) => reputation(state) >= 25,
  generate: () => ({
    id: 'inbox_game_show_casting',
    description:
      'A casting producer has written. The show is a general-knowledge format ' +
      'with a modest prize and an enormous amount of standing under lights ' +
      'while someone counts down.\n\n' +
      'They need an answer this month. Filming is a full day and the fee is ' +
      'paid whether or not you win anything.',
    choices: [
      {
        id: 'audition',
        text: 'Go for it — a full day, and you might actually win',
        // Being on television is the biggest single thing that happens in this
        // pack, and it costs most of a week's energy to collect.
        effects: { money: 1200, stats: { energy: -18, happiness: 20, reputation: 8 } },
      },
      {
        id: 'audience',
        text: 'Sit in the audience instead (appearance fee $60)',
        effects: { money: 60, stats: { energy: -6, happiness: 3 } },
      },
      {
        id: 'decline',
        text: 'Not for you',
        effects: {},
      },
    ],
  }),
};

/**
 * The neighbourly dispute, in writing.
 *
 * Three genuinely different positions rather than yes / no / ignore — the
 * middle option costs the most effort and is the only one nobody resents.
 */
const neighbourPetition: EventTemplate = {
  id: 'inbox_neighbour_petition',
  category: 'relationship',
  weight: 0.24,
  generate: () => ({
    id: 'inbox_neighbour_petition',
    description:
      'A petition has come round about the extension at number 14. It is ' +
      'printed, it is annotated, and it has been through several hands before ' +
      'yours.\n\n' +
      'The objection is mostly about light. Some of it is about a hedge, and a ' +
      'little of it is about something that happened in 2019.',
    choices: [
      {
        id: 'sign',
        text: 'Sign it — the extension really is too big',
        effects: { stats: { reputation: 2, happiness: -2 } },
      },
      {
        id: 'mediate',
        text: 'Get both sides talking instead (an evening of it)',
        effects: {
          stats: { energy: -8, happiness: 6, reputation: 6 },
          karma: { dimension: 'generosity', amount: 2, reason: 'Defused a neighbourhood dispute' },
        },
      },
      {
        id: 'stay_out',
        text: 'Post it back through the door unsigned',
        effects: {},
      },
    ],
  }),
};

export const inboxEventTemplates: EventTemplate[] = [
  reunionInvite,
  mysteryParcel,
  timeCapsule,
  charityAppeal,
  walletReturned,
  gameShowCasting,
  neighbourPetition,
];
