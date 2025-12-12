/**
 * Statistics Tracker
 * Functions to track and update lifetime statistics throughout the game
 */

import type { GameState, LifetimeStatistics, CareerHistoryEntry, NetWorthSnapshot } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';

// Maximum history entries to keep
const MAX_NET_WORTH_HISTORY = 100;
const MAX_EARNINGS_HISTORY = 100;
const MAX_CAREER_HISTORY = 50;

// Sample net worth every N weeks
const NET_WORTH_SAMPLE_INTERVAL = 10;

/**
 * Calculate current net worth from game state
 */
export function calculateNetWorth(state: GameState): number {
  return netWorth(state);
}

/**
 * Track money earned (positive income)
 */
export function trackMoneyEarned(
  stats: LifetimeStatistics,
  amount: number
): LifetimeStatistics {
  if (amount <= 0) return stats;
  
  return {
    ...stats,
    totalMoneyEarned: stats.totalMoneyEarned + amount,
  };
}

/**
 * Track money spent (negative transactions)
 */
export function trackMoneySpent(
  stats: LifetimeStatistics,
  amount: number
): LifetimeStatistics {
  if (amount >= 0) return stats;
  
  return {
    ...stats,
    totalMoneySpent: stats.totalMoneySpent + Math.abs(amount),
  };
}

/**
 * Update peak net worth if current is higher
 */
export function updatePeakNetWorth(
  stats: LifetimeStatistics,
  currentNetWorth: number,
  currentWeek: number
): LifetimeStatistics {
  if (currentNetWorth > stats.peakNetWorth) {
    return {
      ...stats,
      peakNetWorth: currentNetWorth,
      peakNetWorthWeek: currentWeek,
    };
  }
  return stats;
}

/**
 * Track weekly net worth snapshot (called every 10 weeks)
 */
export function addNetWorthSnapshot(
  stats: LifetimeStatistics,
  week: number,
  value: number
): LifetimeStatistics {
  // Only add snapshot at intervals
  if (week % NET_WORTH_SAMPLE_INTERVAL !== 0) return stats;
  
  const snapshot: NetWorthSnapshot = { week, value };
  const history = [...stats.netWorthHistory, snapshot];
  
  // Keep only the most recent entries
  if (history.length > MAX_NET_WORTH_HISTORY) {
    history.shift();
  }
  
  return {
    ...stats,
    netWorthHistory: history,
  };
}

/**
 * Track weekly earnings
 */
export function addWeeklyEarningsSnapshot(
  stats: LifetimeStatistics,
  week: number,
  earnings: number
): LifetimeStatistics {
  const snapshot: NetWorthSnapshot = { week, value: earnings };
  const history = [...stats.weeklyEarningsHistory, snapshot];
  
  // Keep only the most recent entries
  if (history.length > MAX_EARNINGS_HISTORY) {
    history.shift();
  }
  
  return {
    ...stats,
    weeklyEarningsHistory: history,
  };
}

/**
 * Start tracking a new job
 */
export function startJobTracking(
  stats: LifetimeStatistics,
  jobId: string,
  startWeek: number
): LifetimeStatistics {
  // Check if there's an existing entry for this job without an end date
  const existingIndex = stats.careerHistory.findIndex(
    entry => entry.job === jobId && !entry.endWeek
  );
  
  if (existingIndex !== -1) {
    // Job already being tracked
    return stats;
  }
  
  const newEntry: CareerHistoryEntry = {
    job: jobId,
    weeks: 0,
    earnings: 0,
    startWeek,
    endWeek: undefined,
  };
  
  const history = [...stats.careerHistory, newEntry];
  
  // Keep only the most recent entries
  if (history.length > MAX_CAREER_HISTORY) {
    history.shift();
  }
  
  return {
    ...stats,
    careerHistory: history,
  };
}

/**
 * End tracking a job
 */
export function endJobTracking(
  stats: LifetimeStatistics,
  jobId: string,
  endWeek: number
): LifetimeStatistics {
  const history = stats.careerHistory.map(entry => {
    if (entry.job === jobId && !entry.endWeek) {
      return {
        ...entry,
        endWeek,
        weeks: endWeek - entry.startWeek,
      };
    }
    return entry;
  });
  
  return {
    ...stats,
    careerHistory: history,
    totalWeeksWorked: stats.totalWeeksWorked + 1,
  };
}

/**
 * Update current job earnings and weeks
 */
export function updateJobStats(
  stats: LifetimeStatistics,
  jobId: string,
  weeklyEarnings: number
): LifetimeStatistics {
  const history = stats.careerHistory.map(entry => {
    if (entry.job === jobId && !entry.endWeek) {
      return {
        ...entry,
        weeks: entry.weeks + 1,
        earnings: entry.earnings + weeklyEarnings,
      };
    }
    return entry;
  });
  
  return {
    ...stats,
    careerHistory: history,
    totalWeeksWorked: stats.totalWeeksWorked + 1,
    highestSalary: Math.max(stats.highestSalary, weeklyEarnings * 52), // Annualized
  };
}

/**
 * Increment relationship count
 */
export function trackNewRelationship(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalRelationships: stats.totalRelationships + 1,
  };
}

/**
 * Increment children count
 */
export function trackNewChild(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalChildren: stats.totalChildren + 1,
  };
}

/**
 * Increment company count
 */
export function trackNewCompany(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalCompaniesOwned: stats.totalCompaniesOwned + 1,
  };
}

/**
 * Increment property count
 */
export function trackNewProperty(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalPropertiesOwned: stats.totalPropertiesOwned + 1,
  };
}

/**
 * Track crime committed
 */
export function trackCrime(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalCrimesCommitted: stats.totalCrimesCommitted + 1,
  };
}

/**
 * Track jail time
 */
export function trackJailTime(stats: LifetimeStatistics, weeks: number): LifetimeStatistics {
  return {
    ...stats,
    totalJailTime: stats.totalJailTime + weeks,
  };
}

/**
 * Track travel destination visited
 */
export function trackTravelDestination(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalTravelDestinations: stats.totalTravelDestinations + 1,
  };
}

/**
 * Track social media post
 */
export function trackPost(stats: LifetimeStatistics, isViral: boolean): LifetimeStatistics {
  return {
    ...stats,
    totalPostsMade: stats.totalPostsMade + 1,
    totalViralPosts: isViral ? stats.totalViralPosts + 1 : stats.totalViralPosts,
  };
}

/**
 * Track hobby learned (skill level increased)
 */
export function trackHobbyLearned(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalHobbiesLearned: stats.totalHobbiesLearned + 1,
  };
}

/**
 * Track achievement unlocked
 */
export function trackAchievement(stats: LifetimeStatistics): LifetimeStatistics {
  return {
    ...stats,
    totalAchievementsUnlocked: stats.totalAchievementsUnlocked + 1,
  };
}

/**
 * Comprehensive weekly update - call this at the end of each week
 */
export function updateWeeklyStatistics(
  state: GameState,
  weeklyIncome: number
): LifetimeStatistics {
  let stats = state.lifetimeStatistics || getDefaultStatistics();
  const currentWeek = state.week || 1;
  const currentNetWorth = calculateNetWorth(state);
  
  // Update peak net worth
  stats = updatePeakNetWorth(stats, currentNetWorth, currentWeek);
  
  // Add net worth snapshot every 10 weeks
  stats = addNetWorthSnapshot(stats, currentWeek, currentNetWorth);
  
  // Add weekly earnings
  if (weeklyIncome > 0) {
    stats = addWeeklyEarningsSnapshot(stats, currentWeek, weeklyIncome);
    stats = trackMoneyEarned(stats, weeklyIncome);
  }
  
  // Track current job
  if (state.currentJob) {
    const career = state.careers?.find(c => c.id === state.currentJob);
    if (career) {
      stats = updateJobStats(stats, state.currentJob, career.salary || 0);
    }
  }
  
  return stats;
}

/**
 * Get default statistics object
 */
export function getDefaultStatistics(): LifetimeStatistics {
  return {
    totalMoneyEarned: 0,
    totalMoneySpent: 0,
    peakNetWorth: 0,
    peakNetWorthWeek: 0,
    totalWeeksWorked: 0,
    totalRelationships: 0,
    totalChildren: 0,
    totalCompaniesOwned: 0,
    totalPropertiesOwned: 0,
    totalCrimesCommitted: 0,
    totalJailTime: 0,
    totalTravelDestinations: 0,
    totalPostsMade: 0,
    totalViralPosts: 0,
    careerHistory: [],
    netWorthHistory: [],
    weeklyEarningsHistory: [],
    highestSalary: 0,
    totalHobbiesLearned: 0,
    totalAchievementsUnlocked: 0,
  };
}

/**
 * Format number for display (with suffixes)
 */
export function formatStatNumber(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format money for display
 */
export function formatStatMoney(value: number): string {
  return `$${formatStatNumber(value)}`;
}

/**
 * Get career summary for display
 */
export function getCareerSummary(stats: LifetimeStatistics): {
  totalJobs: number;
  totalWeeks: number;
  totalEarnings: number;
  longestJob: { job: string; weeks: number } | null;
  highestPaying: { job: string; earnings: number } | null;
} {
  const history = stats.careerHistory;
  
  if (history.length === 0) {
    return {
      totalJobs: 0,
      totalWeeks: stats.totalWeeksWorked,
      totalEarnings: 0,
      longestJob: null,
      highestPaying: null,
    };
  }
  
  const totalEarnings = history.reduce((sum, entry) => sum + entry.earnings, 0);
  const longestJob = history.reduce((max, entry) => 
    entry.weeks > (max?.weeks || 0) ? entry : max, history[0]);
  const highestPaying = history.reduce((max, entry) => 
    entry.earnings > (max?.earnings || 0) ? entry : max, history[0]);
  
  return {
    totalJobs: history.length,
    totalWeeks: stats.totalWeeksWorked,
    totalEarnings,
    longestJob: longestJob ? { job: longestJob.job, weeks: longestJob.weeks } : null,
    highestPaying: highestPaying ? { job: highestPaying.job, earnings: highestPaying.earnings } : null,
  };
}

/**
 * Calculate achievement completion percentage
 */
export function getAchievementProgress(state: GameState): {
  unlocked: number;
  total: number;
  percentage: number;
} {
  const achievements = state.achievements || [];
  const unlocked = achievements.filter(a => a.unlocked).length;
  const total = achievements.length;
  
  return {
    unlocked,
    total,
    percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
  };
}

