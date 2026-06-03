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

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

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
  notifications: { id: string; title: string; message: string }[];
}

export function runPoliticsWeeklyTick(input: PoliticsWeeklyTickInput): PoliticsWeeklyTickResult {
  // Holders without an office get a quiet tick — no scandals, no drift.
  // Citizens building credibility before running can still skip this.
  const careerLevel = safe(input.politics.careerLevel, 0);
  if (careerLevel === 0) {
    return { politics: input.politics, forcedResignation: false, notifications: [] };
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

  return { politics, forcedResignation: tick.forcedResignation, notifications };
}
