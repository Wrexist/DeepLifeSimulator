/**
 * Legal paper — the crime axis finally produces documents.
 *
 * Crime, heat and jail already exist and produce stat changes, a wanted level
 * and a jail counter. What they never produced was a piece of paper: no fine,
 * no summons, no settlement offer. So the consequences of the riskiest system
 * in the game arrived as numbers moving, and the player had nothing to hold.
 *
 * ## Why these are EVENTS rather than a fifth system
 *
 * Every one of them is delivered to the mail app (see
 * `lib/events/routing.ts`), where they present as letters with a deadline. But
 * they are authored here, as ordinary `EventTemplate`s, so they inherit the
 * existing selection weights, conditions, and — most importantly — the one
 * resolver. `resolveEvent` already knows how to charge money it can afford,
 * apply karma, refuse an unaffordable choice and chain a follow-up. A bespoke
 * "legal" system would have needed all of that again, and the two would have
 * disagreed the first time either changed.
 *
 * ## The shape of the choices
 *
 * Each one is pay-now versus risk-more, which is the decision the crime system
 * has always implied and never asked. Contesting is cheaper when it works and
 * worse when it does not; paying is dull and safe. Ignoring is always available
 * and is what happens on its own if the letter is left to expire — the lapse
 * choice is the LAST one, by the convention `letterFromEvent` relies on.
 */

import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';

/** Liquid wealth, for gating letters that only make sense above a floor. */
function liquid(state: GameState): number {
  return Math.max(0, state.stats?.money ?? 0) + Math.max(0, state.bankSavings ?? 0);
}

/** Someone the authorities have a reason to write to. */
function hasRecord(state: GameState): boolean {
  return (state.wantedLevel ?? 0) > 0 || (state.criminalXp ?? 0) > 0;
}

function ownsVehicle(state: GameState): boolean {
  const vehicles = Array.isArray(state.vehicles) ? state.vehicles : [];
  return vehicles.some((v) => v && (v as { sold?: boolean }).sold !== true);
}

const parkingFine: EventTemplate = {
  id: 'legal_parking_fine',
  category: 'economy',
  weight: 0.35,
  condition: (state) => ownsVehicle(state),
  generate: () => ({
    id: 'legal_parking_fine',
    description:
      'A penalty charge notice has been issued against your vehicle. The photograph ' +
      'is time-stamped and the bay was, on the evidence, a loading bay.\n\n' +
      'The discounted rate applies for fourteen days. After that it doubles, and ' +
      'after twenty-eight it is registered as a debt.',
    choices: [
      {
        id: 'pay_discounted',
        text: 'Pay at the discounted rate ($60)',
        effects: { money: -60 },
      },
      {
        id: 'appeal',
        text: 'Appeal it - you were loading ($0 now, $120 if refused)',
        effects: { money: -120, stats: { happiness: -2 } },
      },
      {
        id: 'ignore',
        text: 'Bin it',
        effects: { money: -160, stats: { happiness: -4 } },
      },
    ],
  }),
};

const speedingNotice: EventTemplate = {
  id: 'legal_speeding_notice',
  category: 'economy',
  weight: 0.3,
  condition: (state) => ownsVehicle(state),
  generate: () => ({
    id: 'legal_speeding_notice',
    description:
      'A notice of intended prosecution has been served. You were recorded at ' +
      'thirty-eight in a thirty.\n\n' +
      'You may accept a fixed penalty and a short awareness course, or elect to ' +
      'have the matter heard. The court can impose considerably more than the ' +
      'fixed penalty, and usually does.',
    choices: [
      {
        id: 'course',
        text: 'Take the awareness course ($120, a lost afternoon)',
        effects: { money: -120, stats: { energy: -5 } },
      },
      {
        id: 'court',
        text: 'Elect court - you say the limit was unposted ($400 if it goes badly)',
        effects: { money: -400, stats: { happiness: -6 } },
      },
      {
        id: 'ignore',
        text: 'Do nothing and let it escalate',
        effects: { money: -300, stats: { reputation: -3, happiness: -5 } },
      },
    ],
  }),
};

const smallClaim: EventTemplate = {
  id: 'legal_small_claim',
  category: 'economy',
  weight: 0.22,
  condition: (state) => liquid(state) > 20_000,
  generate: () => ({
    id: 'legal_small_claim',
    description:
      'A claim has been filed against you in the small claims registry. The ' +
      'particulars are thin and the sum is not large, but the hearing date is ' +
      'real and a judgment against you is recorded.\n\n' +
      'Defending it costs a day and a filing fee. Admitting it costs the claim.',
    choices: [
      {
        id: 'defend',
        text: 'File a defence and attend ($250 and a day)',
        effects: { money: -250, stats: { energy: -8, happiness: -3 } },
      },
      {
        id: 'admit',
        text: 'Admit the claim and pay ($900)',
        effects: { money: -900 },
      },
      {
        id: 'ignore',
        text: 'Do not respond - judgment in default',
        effects: {
          money: -1200,
          stats: { reputation: -6, happiness: -6 },
          karma: { dimension: 'honesty', amount: -2, reason: 'Ignored a court claim' },
        },
      },
    ],
  }),
};

const settlementOffer: EventTemplate = {
  id: 'legal_settlement_offer',
  category: 'economy',
  weight: 0.18,
  condition: (state) => hasRecord(state) && liquid(state) > 10_000,
  generate: () => ({
    id: 'legal_settlement_offer',
    description:
      'Our client is prepared to resolve this matter without proceedings. The ' +
      'offer below is open for four weeks and is made without admission.\n\n' +
      'You should understand that if it is refused and the matter is heard, our ' +
      'client will seek costs in addition to damages.',
    choices: [
      {
        id: 'settle',
        text: 'Settle now and be done ($3,000)',
        effects: { money: -3000, stats: { happiness: -4 } },
      },
      {
        id: 'counter',
        text: 'Counter-offer at half ($1,500 if accepted, $6,000 if not)',
        effects: { money: -6000, stats: { happiness: -8 } },
      },
      {
        id: 'refuse',
        text: 'Refuse and take your chances',
        effects: {
          money: -8000,
          stats: { happiness: -10, reputation: -4 },
        },
      },
    ],
  }),
};

export const legalEventTemplates: EventTemplate[] = [
  parkingFine,
  speedingNotice,
  smallClaim,
  settlementOffer,
];
