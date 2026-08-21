/**
 * Weekly politics tick — scandal exposure rolls, scandal severity decay,
 * approval drift, forced-resignation handling.
 *
 * Pure function. Caller threads the result into the giant GameState return
 * in GameActionsContext.nextWeek.
 */

import { PoliticsState } from '@/contexts/game/types';
import {
  driftApproval,
  ensurePoliticsHasNewFields,
  rollScandal,
  tickScandals,
} from './operations';
import { getNextElectionWeek, OfficeLevel } from './elections';
import { decayHeat, embezzlementScandalPressureUSD, readEmbezzlement } from './embezzlement';
import {
  driftPartySupport,
  electionSupportModifier,
  hasPartyMachine,
  readPartySupport,
  weeklyPartyFunding,
} from './parties';
import { findAppointment } from './appointments';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Office rank (1-based) → display title. Rank 0 is Citizen (no office). */
const OFFICE_TITLES: Record<number, string> = {
  1: 'Council Member',
  2: 'Mayor',
  3: 'State Representative',
  4: 'Governor',
  5: 'Senator',
  6: 'President',
};

export interface PoliticsWeeklyTickInput {
  politics: PoliticsState;
  /** Current dark-web heat 0..100. Feeds scandal probability. */
  darkWebHeat?: number;
  /** Karma in -100..100. Negative feeds scandal probability. */
  karma?: number;
  /** Count of contentious policies enacted recently. Feeds scandal probability. */
  contentiousPolicies?: number;
  currentWeek: number;
  rollFor: (key: string) => number;
}

export interface PoliticsWeeklyTickResult {
  politics: PoliticsState;
  /** True if the scandal tick triggered a forced resignation — caller resets careerLevel. */
  forcedResignation: boolean;
  /** True if the player left office this tick (scandal resignation OR lost re-election) — caller resets the political career (accepted:false, currentJob). */
  lostOffice: boolean;
  notifications: { id: string; title: string; message: string }[];
}

export function runPoliticsWeeklyTick(input: PoliticsWeeklyTickInput): PoliticsWeeklyTickResult {
  const careerLevel = safe(input.politics.careerLevel, 0);

  // Out of office is no longer the same as out of politics: an appointed
  // Ambassador, a retired Senator on a pension and a party member all have
  // state that must keep moving. Scandals and approval drift still belong to
  // office-holders only, so those stay behind the `careerLevel` gate below.
  if (careerLevel === 0) {
    return {
      politics: tickOutOfOffice(input),
      forcedResignation: false,
      lostOffice: false,
      notifications: [],
    };
  }

  let politics = ensurePoliticsHasNewFields(input.politics);
  const notifications: PoliticsWeeklyTickResult['notifications'] = [];

  // 1) Roll for a fresh scandal.
  const lastCheck = safe(politics.lastScandalCheckWeek, 0);
  if (input.currentWeek > lastCheck) {
    const newScandal = rollScandal(
      politics,
      {
        darkWebHeat: input.darkWebHeat,
        // Money taken OUT of the war chest is corruption risk the same way
        // dirty money coming IN is, so it is expressed in the same currency and
        // added to the same driver rather than given a second probability curve
        // that would have to be kept in step with this one.
        pacDirtyUSD:
          safe(politics.pac?.lifetimeDirtyUSD, 0)
          + embezzlementScandalPressureUSD(readEmbezzlement(politics.embezzlement)),
        karma: input.karma,
        contentiousPolicies: input.contentiousPolicies,
        careerLevel,
      },
      input.currentWeek,
      {
        fire: input.rollFor('politics.scandal.fire'),
        severity: input.rollFor('politics.scandal.severity'),
        category: input.rollFor('politics.scandal.category'),
        headline: input.rollFor('politics.scandal.headline'),
      }
    );
    if (newScandal) {
      politics = { ...newScandal.politics, lastScandalCheckWeek: input.currentWeek };
      notifications.push({
        id: `scandal-new-${newScandal.scandal.id}`,
        title: '🚨 Scandal Erupts',
        message: `${newScandal.scandal.headline}. (${newScandal.scandal.severity})`,
      });
    } else {
      politics = { ...politics, lastScandalCheckWeek: input.currentWeek };
    }
  }

  // 2) Tick existing scandals (drain approval, decay severity).
  const tick = tickScandals(politics, input.currentWeek);
  politics = tick.politics;
  notifications.push(...tick.notifications);
  const approvalAfterScandals = Math.max(0, Math.min(100, safe(politics.approvalRating) - tick.approvalDamage));
  politics = { ...politics, approvalRating: approvalAfterScandals };

  // 3) Natural drift toward 50.
  politics = driftApproval(politics);

  // 3b) Party standing, embezzlement cool-down and the party's weekly campaign
  // contribution. All three are pure bookkeeping and cannot throw, but they run
  // BEFORE the election block so a seat defended this week is defended with the
  // standing the player actually has going in.
  politics = tickPoliticalLife(politics, input.currentWeek);

  // 4) Re-election when the term ends. Previously the UI counted down to a date
  // that nothing resolved. Now the incumbent faces the voters: heavily favored,
  // but a low approval rating can cost the seat — which is what finally gives
  // approval (and campaign spending / scandals) real stakes.
  let lostOffice = tick.forcedResignation;
  const currentCareerLevel = safe(politics.careerLevel, 0);
  const nextElectionWeek = politics.nextElectionWeek;
  if (
    !tick.forcedResignation &&
    currentCareerLevel > 0 &&
    typeof nextElectionWeek === 'number' &&
    input.currentWeek >= nextElectionWeek
  ) {
    const approval = safe(politics.approvalRating, 50);
    const electionsWon = safe(politics.electionsWon, 0);
    // Incumbent advantage: base 45 + approval weight + small tenure bonus, clamped.
    // The party's endorsement (or its absence) moves the race. Bounded to
    // ±12 points by `electionSupportModifier`, so it tilts a close election
    // without ever deciding one on its own — and the whole expression is still
    // clamped to [25, 92], so no combination guarantees a seat.
    const partyModifier = electionSupportModifier(politics.party, politics.partySupport);
    const successChance = Math.max(
      25,
      Math.min(92, 45 + approval * 0.45 + Math.min(10, electionsWon) + partyModifier),
    );
    const won = input.rollFor('politics.reelection.outcome') * 100 < successChance;
    const officeTitle = OFFICE_TITLES[currentCareerLevel] ?? 'office';
    if (won) {
      const officeIndex = (currentCareerLevel - 1) as OfficeLevel;
      const scheduled = getNextElectionWeek(input.currentWeek, officeIndex, input.currentWeek);
      politics = {
        ...politics,
        electionsWon: electionsWon + 1,
        approvalRating: Math.min(100, approval + 5),
        lastElectionWeek: input.currentWeek,
        nextElectionWeek: scheduled,
      };
      notifications.push({
        id: `politics-reelect-win-${input.currentWeek}`,
        title: '🗳️ Re-elected',
        message: `Voters returned you to office as ${officeTitle}. Approval +5.`,
      });
    } else {
      politics = {
        ...politics,
        careerLevel: 0,
        approvalRating: Math.max(0, approval - 10),
        nextElectionWeek: undefined,
      };
      lostOffice = true;
      notifications.push({
        id: `politics-reelect-loss-${input.currentWeek}`,
        title: '🗳️ Voted Out of Office',
        message: `You lost the ${officeTitle} election. Your term is over — win back the seat by running again.`,
      });
    }
  }

  return { politics, forcedResignation: tick.forcedResignation, lostOffice, notifications };
}

/**
 * Party standing, embezzlement cool-down and the party's weekly contribution.
 *
 * Pure bookkeeping, shared by the in-office and out-of-office paths so the two
 * cannot drift apart. Every read degrades a missing or malformed value to the
 * empty answer rather than throwing — this runs inside the week loop, where a
 * throw costs the whole week (§4.3).
 */
function tickPoliticalLife(politics: PoliticsState, currentWeek: number): PoliticsState {
  let next = politics;

  // Party standing: natural drift toward neutral, dragged down by live
  // scandals, nudged by whatever appointment is being served.
  if (hasPartyMachine(next.party)) {
    const activeScandals = (next.scandals ?? []).filter((s) => s && s.active).length;
    const drifted = driftPartySupport({
      party: next.party,
      support: readPartySupport(next.party, next.partySupport),
      activeScandals,
    });
    const perWeek = safe(findAppointment(next.appointment?.id)?.partySupportPerWeek, 0);
    next = { ...next, partySupport: Math.max(0, Math.min(100, drifted + perWeek)) };
  }

  // Embezzlement heat only cools in a week the player kept their hands out of
  // the pot — `decayHeat` enforces that against `lastWeek`.
  if (next.embezzlement) {
    const cooled = decayHeat(readEmbezzlement(next.embezzlement), currentWeek);
    next = { ...next, embezzlement: cooled };
  }

  // The machine's weekly contribution. Lands in `campaignFunds`, not cash, so
  // it can only be spent on politics — or skimmed, which is the point.
  const funding = weeklyPartyFunding({
    party: next.party,
    support: next.partySupport,
    careerLevel: next.careerLevel,
  });
  if (funding > 0) {
    next = { ...next, campaignFunds: Math.round(safe(next.campaignFunds, 0) + funding) };
  }

  return next;
}

/**
 * The tick for someone who holds no elected seat.
 *
 * Before the Political Life expansion this was a hard early return: no office,
 * nothing to do. That is no longer true — an appointed Ambassador, a retired
 * Senator drawing a pension and a rank-and-file party member all carry state
 * that has to keep moving between offices. What stays behind the office gate is
 * what genuinely belongs to office-holders: scandal rolls and approval drift.
 */
function tickOutOfOffice(input: PoliticsWeeklyTickInput): PoliticsState {
  const politics = input.politics;
  const hasLifeToTick =
    hasPartyMachine(politics.party) || Boolean(politics.appointment) || Boolean(politics.embezzlement);
  if (!hasLifeToTick) return politics;
  return tickPoliticalLife(politics, input.currentWeek);
}
