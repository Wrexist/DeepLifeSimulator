import type { GameState } from '@/contexts/game/types';
import type { AchievementProgress } from '@/lib/progress/achievements';
import { ACHIEVEMENTS } from '@/lib/progress/achievements';

/**
 * Achievement analytics result
 */
export interface AchievementAnalyticsResult {
  totalAchievements: number;
  unlockedAchievements: number;
  completionRate: number;
  averageTimeToComplete: number;
  fastestCompletion: number;
  categoryBreakdown: {
    category: string;
    total: number;
    unlocked: number;
  }[];
  incompleteAchievements: AchievementProgress[];
  recommendations: string[];
}

/**
 * Calculate achievement analytics
 */
export function calculateAchievementAnalytics(state: GameState): AchievementAnalyticsResult {
  const allAchievements = ACHIEVEMENTS;
  const unlockedAchievements = state.progress?.achievements || [];
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));
  
  const totalAchievements = allAchievements.length;
  const unlockedCount = unlockedIds.size;
  const completionRate = totalAchievements > 0 
    ? (unlockedCount / totalAchievements) * 100 
    : 0;
  
  // Calculate average time to complete (simplified - would need to track unlock times)
  const averageTimeToComplete = unlockedCount > 0 
    ? (state.weeksLived || 0) / unlockedCount 
    : 0;
  
  // Fastest completion (placeholder - would need to track individual times)
  const fastestCompletion = averageTimeToComplete;
  
  // Category breakdown (simplified - achievements don't have categories yet)
  const categoryBreakdown = [
    {
      category: 'All',
      total: totalAchievements,
      unlocked: unlockedCount,
    },
  ];
  
  // Incomplete achievements
  const incompleteAchievements = allAchievements.filter(
    achievement => !unlockedIds.has(achievement.id)
  );
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (completionRate < 50) {
    recommendations.push('Focus on completing more achievements to increase your completion rate');
  }
  if (incompleteAchievements.length > 0) {
    const easiest = incompleteAchievements[0];
    recommendations.push(`Try working towards: ${easiest.name}`);
  }
  if (completionRate >= 90) {
    recommendations.push('Excellent progress! You\'re close to completing all achievements');
  }
  
  return {
    totalAchievements,
    unlockedAchievements: unlockedCount,
    completionRate: Math.round(completionRate * 10) / 10,
    averageTimeToComplete: Math.round(averageTimeToComplete * 10) / 10,
    fastestCompletion: Math.round(fastestCompletion * 10) / 10,
    categoryBreakdown,
    incompleteAchievements,
    recommendations,
  };
}

