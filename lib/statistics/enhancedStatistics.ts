/**
 * Enhanced Statistics Engine
 * Extends existing statistics with system-level analytics
 */

import { GameState, LifetimeStatistics } from '@/contexts/game/types';
import { SystemInterconnection } from '@/lib/depth/systemInterconnections';
import { DiscoveredSystem } from '@/lib/depth/discoverySystem';

export interface SystemStatistics {
  systemId: string;
  systemName: string;
  totalInteractions: number;
  totalTimeSpent: number; // in weeks
  peakPerformance: number;
  averagePerformance: number;
  trend: 'improving' | 'declining' | 'stable';
  interconnections: {
    affects: string[];
    affectedBy: string[];
  };
  lastActivity: number; // timestamp
  firstActivity: number; // timestamp
}

export interface EnhancedLifetimeStatistics extends LifetimeStatistics {
  systemStats?: Record<string, SystemStatistics>;
  interconnectionHistory?: SystemInterconnection[];
  discoveryTimeline?: DiscoveredSystem[];
  depthMetrics?: {
    systemsEngaged: number;
    averageDepthScore: number;
    peakDepthScore: number;
    depthScoreHistory: Array<{ week: number; score: number }>;
  };
  weeklySystemEngagement?: Array<{
    week: number;
    systems: string[];
    depthScore: number;
  }>;
}

/**
 * Calculate system statistics from game state
 */
export function calculateSystemStatistics(gameState: GameState): Record<string, SystemStatistics> {
  const systemStats: Record<string, SystemStatistics> = {};
  const discoveredSystems = gameState.discoveredSystems || [];
  const lifetimeStats = gameState.lifetimeStatistics;

  discoveredSystems.forEach(discovered => {
    const stats = calculateSystemStats(discovered.systemId, gameState, lifetimeStats);
    if (stats) {
      systemStats[discovered.systemId] = stats;
    }
  });

  return systemStats;
}

/**
 * Calculate statistics for a specific system
 */
function calculateSystemStats(
  systemId: string,
  gameState: GameState,
  _lifetimeStats?: LifetimeStatistics
): SystemStatistics | null {
  const discoveredSystem = gameState.discoveredSystems?.find(s => s.systemId === systemId);
  if (!discoveredSystem) {
    return null;
  }

  const systemName = discoveredSystem.systemName;
  const totalInteractions = discoveredSystem.timesUsed;
  const totalTimeSpent = calculateTimeSpent(systemId, gameState);
  const peakPerformance = calculatePeakPerformance(systemId, gameState);
  const averagePerformance = calculateAveragePerformance(systemId, gameState);
  const trend = calculateTrend(systemId, gameState);
  const interconnections = getSystemInterconnections(systemId, gameState);

  return {
    systemId,
    systemName,
    totalInteractions,
    totalTimeSpent,
    peakPerformance,
    averagePerformance,
    trend,
    interconnections,
    lastActivity: discoveredSystem.lastUsed,
    firstActivity: discoveredSystem.discoveredAt,
  };
}

/**
 * Get enhanced lifetime statistics
 */
export function getEnhancedLifetimeStatistics(gameState: GameState): EnhancedLifetimeStatistics {
  const baseStats = gameState.lifetimeStatistics || {
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

  const systemStats = calculateSystemStatistics(gameState);
  const interconnectionHistory = getInterconnectionHistory(gameState);
  const discoveryTimeline = gameState.discoveredSystems || [];
  const depthMetrics = calculateDepthMetrics(gameState);
  const weeklySystemEngagement = getWeeklySystemEngagement(gameState);

  return {
    ...baseStats,
    systemStats,
    interconnectionHistory,
    discoveryTimeline,
    depthMetrics,
    weeklySystemEngagement,
  };
}

/**
 * Calculate depth metrics
 */
function calculateDepthMetrics(gameState: GameState): EnhancedLifetimeStatistics['depthMetrics'] {
  const { calculateDepthScore } = require('@/lib/depth/discoverySystem');
  const currentScore = calculateDepthScore(gameState);
  const _discoveredSystems = gameState.discoveredSystems || [];
  const activeSystems = getActiveSystems(gameState);

  // Calculate depth score history (simplified - can be enhanced with actual tracking)
  const depthScoreHistory: Array<{ week: number; score: number }> = [];
  const weeksLived = gameState.weeksLived || 0;
  
  // Sample every 10 weeks
  for (let week = 10; week <= weeksLived; week += 10) {
    // Estimate score based on progression
    const estimatedScore = Math.min(100, (week / 100) * currentScore);
    depthScoreHistory.push({ week, score: estimatedScore });
  }

  // Add current score
  if (weeksLived > 0) {
    depthScoreHistory.push({ week: weeksLived, score: currentScore });
  }

  const peakScore = Math.max(...depthScoreHistory.map(d => d.score), currentScore);
  const avgScore = depthScoreHistory.length > 0
    ? depthScoreHistory.reduce((sum, d) => sum + d.score, 0) / depthScoreHistory.length
    : currentScore;

  return {
    systemsEngaged: activeSystems.length,
    averageDepthScore: Math.round(avgScore),
    peakDepthScore: Math.round(peakScore),
    depthScoreHistory,
  };
}

/**
 * Get interconnection history
 */
function getInterconnectionHistory(gameState: GameState): SystemInterconnection[] {
  const { getSystemInterconnections } = require('@/lib/depth/systemInterconnections');
  return getSystemInterconnections(gameState);
}

/**
 * Get weekly system engagement
 */
function getWeeklySystemEngagement(gameState: GameState): Array<{
  week: number;
  systems: string[];
  depthScore: number;
}> {
  const engagement: Array<{ week: number; systems: string[]; depthScore: number }> = [];
  const weeksLived = gameState.weeksLived || 0;
  const { calculateDepthScore } = require('@/lib/depth/discoverySystem');

  // Sample every 4 weeks (monthly)
  for (let week = 4; week <= weeksLived; week += 4) {
    // Estimate systems active at that week (simplified)
    const estimatedSystems = estimateActiveSystemsAtWeek(week, gameState);
    const estimatedScore = Math.min(100, (week / 100) * calculateDepthScore(gameState));
    
    engagement.push({
      week,
      systems: estimatedSystems,
      depthScore: estimatedScore,
    });
  }

  // Add current week
  if (weeksLived > 0) {
    const currentSystems = getActiveSystems(gameState);
    engagement.push({
      week: weeksLived,
      systems: currentSystems,
      depthScore: calculateDepthScore(gameState),
    });
  }

  return engagement;
}

// Helper functions

function calculateTimeSpent(systemId: string, gameState: GameState): number {
  const discoveredSystem = gameState.discoveredSystems?.find(s => s.systemId === systemId);
  if (!discoveredSystem) {
    return 0;
  }

  const weeksSinceDiscovery = Math.floor((Date.now() - discoveredSystem.discoveredAt) / (1000 * 60 * 60 * 24 * 7));
  return Math.min(weeksSinceDiscovery, gameState.weeksLived || 0);
}

function calculatePeakPerformance(systemId: string, gameState: GameState): number {
  // Calculate peak performance based on system state
  switch (systemId) {
    case 'career':
      const career = gameState.careers?.find(c => c.id === gameState.currentJob);
      if (career) {
        return Math.min(100, (career.level / (career.levels?.length || 10)) * 100);
      }
      return 0;
    case 'relationships':
      const maxRelationship = gameState.relationships?.reduce((max, r) => 
        Math.max(max, r.relationshipScore || 0), 0
      ) || 0;
      return maxRelationship;
    case 'health':
      return gameState.stats.health;
    case 'hobbies':
      const maxHobbySkill = gameState.hobbies?.reduce((max, h) => 
        Math.max(max, h.skill || 0), 0
      ) || 0;
      return Math.min(100, maxHobbySkill);
    default:
      return 50;
  }
}

function calculateAveragePerformance(systemId: string, gameState: GameState): number {
  // Calculate average performance
  switch (systemId) {
    case 'career':
      const careers = gameState.careers || [];
      if (careers.length === 0) return 0;
      const avgLevel = careers.reduce((sum, c) => sum + c.level, 0) / careers.length;
      return Math.min(100, (avgLevel / 10) * 100);
    case 'relationships':
      const relationships = gameState.relationships || [];
      if (relationships.length === 0) return 0;
      const avgRelationship = relationships.reduce((sum, r) => sum + (r.relationshipScore || 0), 0) / relationships.length;
      return avgRelationship;
    case 'health':
      return gameState.stats.health;
    case 'hobbies':
      const hobbies = gameState.hobbies || [];
      if (hobbies.length === 0) return 0;
      const avgHobbySkill = hobbies.reduce((sum, h) => sum + (h.skill || 0), 0) / hobbies.length;
      return Math.min(100, avgHobbySkill);
    default:
      return 50;
  }
}

function calculateTrend(systemId: string, gameState: GameState): 'improving' | 'declining' | 'stable' {
  const currentPerformance = calculateAveragePerformance(systemId, gameState);
  
  // Simple trend calculation - can be enhanced with historical data
  if (currentPerformance > 70) return 'improving';
  if (currentPerformance < 40) return 'declining';
  return 'stable';
}

function getSystemInterconnections(systemId: string, _gameState: GameState): {
  affects: string[];
  affectedBy: string[];
} {
  const { SYSTEM_DEFINITIONS } = require('@/lib/depth/systemInterconnections');
  const systemDef = SYSTEM_DEFINITIONS[systemId];
  
  if (!systemDef) {
    return { affects: [], affectedBy: [] };
  }

  return {
    affects: systemDef.affects.map((a: any) => a.system),
    affectedBy: systemDef.affectedBy || [],
  };
}

function getActiveSystems(gameState: GameState): string[] {
  const systems: string[] = [];

  if (gameState.careers && gameState.careers.length > 0) systems.push('career');
  if (gameState.relationships && gameState.relationships.length > 0) systems.push('relationships');
  if (gameState.healthActivities && gameState.healthActivities.length > 0) systems.push('health');
  if (gameState.hobbies && gameState.hobbies.length > 0) systems.push('hobbies');
  if (gameState.educations && gameState.educations.length > 0) systems.push('education');
  if (gameState.travel) systems.push('travel');
  if (gameState.politics) systems.push('politics');
  if (gameState.company?.rdLab) systems.push('rd');
  if (gameState.company) systems.push('company');
  if (gameState.realEstate && gameState.realEstate.length > 0) systems.push('realEstate');
  if (gameState.stocks && gameState.stocks.holdings && gameState.stocks.holdings.length > 0) systems.push('stocks');
  if (gameState.socialMedia) systems.push('socialMedia');

  return systems;
}

function estimateActiveSystemsAtWeek(week: number, gameState: GameState): string[] {
  // Simplified estimation - assumes systems unlock progressively
  const systems: string[] = [];
  const currentAge = gameState.date.age - (gameState.weeksLived || 0) + week;

  // Core systems always available
  systems.push('career', 'relationships', 'health', 'hobbies', 'education');

  // Advanced systems unlock based on progression
  if (week >= 20) systems.push('travel');
  if (week >= 40) systems.push('stocks');
  if (week >= 60) systems.push('realEstate');
  if (week >= 80 && currentAge >= 25) systems.push('company', 'politics');
  if (week >= 100) systems.push('socialMedia');

  return systems;
}

