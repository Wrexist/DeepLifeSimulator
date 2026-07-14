/**
 * Stats Actions
 */
import React from 'react';
import { GameState, GameStats } from '../types';
import { logger } from '@/utils/logger';
import { clampStatByKey } from '@/utils/statUtils';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';

const log = logger.scope('StatsActions');

export const updateStats = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  newStats: Partial<GameStats>,
  updateDailySummary: boolean = true
) => {
  setGameState(prev => {
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
        log.warn(`updateStats ignored "${k}" — route money/gems through updateMoney, not updateStats.`);
        return;
      }
      if (typeof value === 'number' && !isNaN(value)) {
        // Apply the gym-efficiency multiplier to positive fitness gains only.
        const effectiveValue = (k === 'fitness' && value > 0 && fitnessGainMult > 1)
          ? value * fitnessGainMult
          : value;
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

    return {
      ...prev,
      stats: updatedStats,
      dailySummary,
    };
  });
};


