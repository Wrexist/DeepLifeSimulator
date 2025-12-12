/**
 * Stats Actions
 */
import { GameState, GameStats } from '../types';
import { logger } from '@/utils/logger';
import { clampStatByKey } from '@/utils/statUtils';

const log = logger.scope('StatsActions');

export const updateStats = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  newStats: Partial<GameStats>,
  updateDailySummary: boolean = true
) => {
  setGameState(prev => {
    const updatedStats = { ...prev.stats };
    const actualChanges: Partial<GameStats> = {};

    Object.entries(newStats).forEach(([key, value]) => {
      const k = key as keyof GameStats;
      if (typeof value === 'number' && !isNaN(value)) {
        const currentVal = prev.stats[k];
        const newVal = clampStatByKey(k, currentVal + value);
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


