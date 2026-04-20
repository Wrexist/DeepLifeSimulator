import { GameState } from '@/contexts/GameContext';
import { netWorth } from './achievements';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
  avatar?: string;
  metadata?: {
    age?: number;
    careerLevel?: number;
    achievements?: number;
  };
}

export type LeaderboardCategory = 'wealth' | 'career' | 'skills' | 'age' | 'achievements' | 'netWorth';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'allTime';

export interface Leaderboard {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  myRank?: number;
  myScore?: number;
  updatedAt: number;
}

/**
 * Calculate score for a leaderboard category
 */
export function calculateLeaderboardScore(
  gameState: GameState,
  category: LeaderboardCategory
): number {
  switch (category) {
    case 'wealth':
      return gameState.stats.money;
    case 'netWorth':
      return netWorth(gameState);
    case 'career':
      const topCareer = gameState.careers.reduce((max, c) => Math.max(max, c.level), 0);
      return topCareer;
    case 'skills':
      const topSkill = gameState.hobbies.reduce((max, h) => Math.max(max, h.skill), 0);
      return topSkill;
    case 'age':
      return Math.floor(gameState.date.age);
    case 'achievements':
      return gameState.achievements?.length || 0;
    default:
      return 0;
  }
}

/**
 * Sort leaderboard entries by score (descending)
 */
export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie-breaker: sort by name alphabetically
    return a.name.localeCompare(b.name);
  });
}

/**
 * Assign ranks to leaderboard entries
 */
export function assignRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = sortLeaderboardEntries(entries);
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Get leaderboard for friends only
 */
export function filterFriendsLeaderboard(
  leaderboard: Leaderboard,
  friendIds: string[]
): Leaderboard {
  return {
    ...leaderboard,
    entries: leaderboard.entries.filter(entry => friendIds.includes(entry.userId)),
  };
}

/**
 * Get top N entries from leaderboard
 */
export function getTopEntries(leaderboard: Leaderboard, count: number): LeaderboardEntry[] {
  return leaderboard.entries.slice(0, count);
}

/**
 * Find user's rank in leaderboard
 */
export function findUserRank(
  leaderboard: Leaderboard,
  userId: string
): number | undefined {
  const entry = leaderboard.entries.find(e => e.userId === userId);
  return entry?.rank;
}

