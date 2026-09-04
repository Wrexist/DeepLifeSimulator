/**
 * Stats Actions
 */
import React from 'react';
import { GameState, GameStats } from '../types';
import { logger } from '@/utils/logger';
import { clampStatByKey } from '@/utils/statUtils';
import { scaledHappinessGain } from '@/lib/economy/happinessGain';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';

const log = logger.scope('StatsActions');

/**
 * Pure stat helper for atomic "gate + grant" updaters — the stats counterpart of
 * `applyMoneyDelta`.
 *
 * Returns the new `stats`/`dailySummary` slice so a caller can fold a stat
 * change INTO an existing `setGameState` updater instead of queueing a second
 * one. Never returns null: a stat delta has no affordability to fail, and
 * invalid entries are dropped individually (matching `updateStats`).
 *
 * ── Why this exists (2026-08-15) ──────────────────────────────────────────
 *
 * `returnFromTrip` cleared the trip in one guarded updater and then applied the
 * trip's stat and money rewards through SEPARATE `updateStats` / `updateMoney`
 * calls, gated on a `let applied` flag read after the first `setGameState`.
 * React only runs the first functional update of a batch eagerly, so on any
 * deferred dispatch that flag read `false` — and the player's trip was cleared
 * while every reward was silently skipped. Without a pure helper there was no
 * way to put the rewards in the same transition as the guard.
 *
 *   setGameState((prev) => {
 *     if (!canDoTheThing(prev)) return prev;
 *     return { ...prev, ...applyStatsDelta(prev, { happiness: 5 }) };
 *   });
 */
export function applyStatsDelta(
  prev: GameState,
  newStats: Partial<GameStats>,
  updateDailySummary: boolean = true
): Pick<GameState, 'stats' | 'dailySummary'> {
  const updatedStats = { ...prev.stats };
  const actualChanges: Partial<GameStats> = {};
  // Life Skills: Peak Performance (+15% gym efficiency) amplifies POSITIVE
  // fitness gains from player actions (workouts, sports, gym). Bounded mult.
  const fitnessGainMult = getLifeSkillModifiers(prev).fitnessGainMult;

  Object.entries(newStats).forEach(([key, value]) => {
    const k = key as keyof GameStats;
    // P2-2: money & gems MUST go through updateMoney/applyMoneyDelta (overdraft
    // reject + transaction/daily-summary tracking), not this stats path which
    // just clamps and adds. Two money-mutation paths with different guarantees
    // is a double-spend / accounting-drift vector, so reject them here.
    if (k === 'money' || k === 'gems') {
      log.warn(`updateStats ignored "${k}" - route money/gems through updateMoney, not updateStats.`);
      return;
    }
    if (typeof value === 'number' && !isNaN(value)) {
      // Apply the gym-efficiency multiplier to positive fitness gains only.
      let effectiveValue = (k === 'fitness' && value > 0 && fitnessGainMult > 1)
        ? value * fitnessGainMult
        : value;
      // Diminishing returns on happiness GAINS (Program 14). A point is worth
      // less the happier you already are, so the top of the scale has to be
      // earned continuously instead of arrived at and held. Negative deltas
      // pass through untouched - this makes the good times harder to bank,
      // never the bad times worse. See `lib/economy/happinessGain.ts` for the
      // measurement that produced it.
      if (k === 'happiness' && effectiveValue > 0) {
        effectiveValue = scaledHappinessGain(prev.stats?.happiness ?? 0, effectiveValue);
      }
      const currentVal = prev.stats[k];
      const newVal = clampStatByKey(k, currentVal + effectiveValue);
      updatedStats[k] = newVal;
      actualChanges[k] = newVal - currentVal;
    } else {
      log.warn(`Invalid stat update for key ${key}: ${value}`);
    }
  });

  // Update daily summary if needed
  let dailySummary = prev.dailySummary;
  if (updateDailySummary) {
    const existingStatsChange = prev.dailySummary?.statsChange || {};
    const mergedStatsChange = { ...existingStatsChange };

    Object.entries(actualChanges).forEach(([key, value]) => {
      const k = key as keyof GameStats;
      mergedStatsChange[k] = (mergedStatsChange[k] || 0) + (value || 0);
    });

    dailySummary = {
      ...prev.dailySummary,
      moneyChange: prev.dailySummary?.moneyChange || 0,
      statsChange: mergedStatsChange,
      events: prev.dailySummary?.events || [],
    };
  }

  return { stats: updatedStats, dailySummary };
}

export const updateStats = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  newStats: Partial<GameStats>,
  updateDailySummary: boolean = true
) => {
  setGameState(prev => ({ ...prev, ...applyStatsDelta(prev, newStats, updateDailySummary) }));
};


