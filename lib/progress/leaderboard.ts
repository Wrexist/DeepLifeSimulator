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
  // BUGFIX: Every branch must be nil-safe — partial states from cloud
  // download, prestige resets, or onboarding flows can have any of these
  // fields missing. NaN scores corrupt the leaderboard rankings.
  const safe = (n: number | undefined | null): number =>
    typeof n === 'number' && Number.isFinite(n) ? n : 0;
  switch (category) {
    case 'wealth':
      return safe(gameState.stats?.money);
    case 'netWorth':
      return safe(netWorth(gameState));
    case 'career': {
      const topCareer = (gameState.careers ?? []).reduce(
        (max, c) => Math.max(max, safe(c?.level)),
        0,
      );
      return topCareer;
    }
    case 'skills': {
      const topSkill = (gameState.hobbies ?? []).reduce(
        (max, h) => Math.max(max, safe(h?.skill)),
        0,
      );
      return topSkill;
    }
    case 'age':
      return Math.floor(safe(gameState.date?.age));
    case 'achievements':
      return gameState.achievements?.length ?? 0;
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

