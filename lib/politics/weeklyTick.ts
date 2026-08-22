/**
 * Weekly politics tick — scandal exposure rolls, scandal severity decay,
 * approval drift, forced-resignation handling.
 *
 * Pure function. Caller threads the result into the giant GameState return
 * in GameActionsContext.nextWeek.
 */

import { PoliticsState } from '@/contexts/game/types';
import {
  applyOfficeExit,
  driftApproval,
  ensurePoliticsHasNewFields,
  rollScandal,
  tickScandals,
} from './operations';
import { getNextElectionWeek, OfficeLevel } from './elections';

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
  // Holders without an office get a quiet tick — no scandals, no drift.
  // Citizens building credibility before running can still skip this.
  const careerLevel = safe(input.politics.careerLevel, 0);
  if (careerLevel === 0) {
    return { politics: input.politics, forcedResignation: false, lostOffice: false, notifications: [] };
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
        pacDirtyUSD: politics.pac?.lifetimeDirtyUSD,
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
    const successChance = Math.max(25, Math.min(92, 45 + approval * 0.45 + Math.min(10, electionsWon)));
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
      // Voted out. Everything that belonged to the office is settled here —
      // active scandals leave the news cycle and lobbyists are deactivated —
      // via `applyOfficeExit`. Without it both froze forever: the citizen
      // early-return at the top of this tick stops processing them, so the
      // Politics app showed a permanent "active" scandal and the Contacts app
      // kept the lobbyist cards for the rest of the life.
      politics = applyOfficeExit({
        ...politics,
        careerLevel: 0,
        approvalRating: Math.max(0, approval - 10),
        nextElectionWeek: undefined,
      });
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
