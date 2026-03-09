import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  playerName: string;
  value: number;
  week?: number; // Week when achieved
  timestamp: number; // When the entry was recorded
  prestigeCount?: number; // Number of prestiges at time of entry
}

/**
 * Leaderboard categories
 */
export type LeaderboardCategory = 
  | 'networth_at_prestige'
  | 'fastest_prestige'
  | 'prestige_points_earned'
  | 'total_prestiges'
  | 'legacy_wealth'
  | 'generations_completed';

/**
 * Leaderboard data structure
 */
export interface LeaderboardData {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  lastUpdated: number;
}

/**
 * All leaderboards
 */
const LEADERBOARD_KEYS: Record<LeaderboardCategory, string> = {
  networth_at_prestige: 'prestige_leaderboard_networth',
  fastest_prestige: 'prestige_leaderboard_speed',
  prestige_points_earned: 'prestige_leaderboard_points',
  total_prestiges: 'prestige_leaderboard_total',
  legacy_wealth: 'prestige_leaderboard_legacy',
  generations_completed: 'prestige_leaderboard_generations',
};

const MAX_ENTRIES_PER_LEADERBOARD = 100;

/**
 * Get leaderboard data from storage
 */
export async function getLeaderboard(
  category: LeaderboardCategory
): Promise<LeaderboardEntry[]> {
  try {
    const key = LEADERBOARD_KEYS[category];
    const data = await AsyncStorage.getItem(key);
    if (!data) return [];
    
    const leaderboard: LeaderboardData = JSON.parse(data);
    return leaderboard.entries || [];
  } catch (error) {
    logger.error('Failed to get leaderboard:', { category, error });
    return [];
  }
}

/**
 * Add entry to leaderboard
 */
export async function addLeaderboardEntry(
  category: LeaderboardCategory,
  entry: LeaderboardEntry
): Promise<void> {
  try {
    const key = LEADERBOARD_KEYS[category];
    const existing = await getLeaderboard(category);
    
    // Add new entry
    const updated = [...existing, entry];
    
    // Sort based on category
    updated.sort((a, b) => {
      switch (category) {
        case 'fastest_prestige':
          // Lower is better (fewer weeks)
          return (a.week || 0) - (b.week || 0);
        case 'networth_at_prestige':
        case 'prestige_points_earned':
        case 'total_prestiges':
        case 'legacy_wealth':
        case 'generations_completed':
          // Higher is better
          return b.value - a.value;
        default:
          return b.value - a.value;
      }
    });
    
    // Keep only top entries
    const trimmed = updated.slice(0, MAX_ENTRIES_PER_LEADERBOARD);
    
    // Save to storage
    const leaderboard: LeaderboardData = {
      category,
      entries: trimmed,
      lastUpdated: Date.now(),
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(leaderboard));
  } catch (error) {
    logger.error('Failed to add leaderboard entry:', { category, error });
  }
}

/**
 * Get top N entries from a leaderboard
 */
export async function getTopLeaderboardEntries(
  category: LeaderboardCategory,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const entries = await getLeaderboard(category);
  return entries.slice(0, limit);
}

/**
 * Get player's rank in a leaderboard
 */
export async function getPlayerRank(
  category: LeaderboardCategory,
  playerName: string
): Promise<number | null> {
  const entries = await getLeaderboard(category);
  const index = entries.findIndex(entry => entry.playerName === playerName);
  return index >= 0 ? index + 1 : null;
}

/**
 * Check if a value qualifies for leaderboard
 */
export async function qualifiesForLeaderboard(
  category: LeaderboardCategory,
  value: number,
  week?: number
): Promise<boolean> {
  const topEntries = await getTopLeaderboardEntries(category, 1);
  
  if (topEntries.length === 0) return true; // Empty leaderboard
  
  switch (category) {
    case 'fastest_prestige':
      // Qualifies if faster (lower week count)
      return !week || topEntries[0].week === undefined || week < topEntries[0].week;
    case 'networth_at_prestige':
    case 'prestige_points_earned':
    case 'total_prestiges':
    case 'legacy_wealth':
    case 'generations_completed':
      // Qualifies if higher value
      return value > topEntries[0].value;
    default:
      return value > topEntries[0].value;
  }
}

/**
 * Submit prestige data to leaderboards
 */
export async function submitPrestigeToLeaderboards(
  playerName: string,
  data: {
    netWorth: number;
    weeksToPrestige: number;
    prestigePointsEarned: number;
    totalPrestiges: number;
    legacyWealth?: number;
    generations?: number;
  }
): Promise<void> {
  try {
    // Net worth at prestige
    if (await qualifiesForLeaderboard('networth_at_prestige', data.netWorth)) {
      await addLeaderboardEntry('networth_at_prestige', {
        playerName,
        value: data.netWorth,
        week: data.weeksToPrestige,
        timestamp: Date.now(),
        prestigeCount: data.totalPrestiges,
      });
    }
    
    // Fastest prestige
    if (await qualifiesForLeaderboard('fastest_prestige', 0, data.weeksToPrestige)) {
      await addLeaderboardEntry('fastest_prestige', {
        playerName,
        value: data.weeksToPrestige,
        week: data.weeksToPrestige,
        timestamp: Date.now(),
        prestigeCount: data.totalPrestiges,
      });
    }
    
    // Prestige points earned
    if (await qualifiesForLeaderboard('prestige_points_earned', data.prestigePointsEarned)) {
      await addLeaderboardEntry('prestige_points_earned', {
        playerName,
        value: data.prestigePointsEarned,
        timestamp: Date.now(),
        prestigeCount: data.totalPrestiges,
      });
    }
    
    // Total prestiges
    if (await qualifiesForLeaderboard('total_prestiges', data.totalPrestiges)) {
      await addLeaderboardEntry('total_prestiges', {
        playerName,
        value: data.totalPrestiges,
        timestamp: Date.now(),
        prestigeCount: data.totalPrestiges,
      });
    }
    
    // Legacy wealth (if provided)
    if (data.legacyWealth !== undefined && 
        await qualifiesForLeaderboard('legacy_wealth', data.legacyWealth)) {
      await addLeaderboardEntry('legacy_wealth', {
        playerName,
        value: data.legacyWealth,
        timestamp: Date.now(),
        prestigeCount: data.totalPrestiges,
      });
    }
    
    // Generations completed (if provided)
    if (data.generations !== undefined && 
        await qualifiesForLeaderboard('generations_completed', data.generations)) {
      await addLeaderboardEntry('generations_completed', {
        playerName,
        value: data.generations,
        timestamp: Date.now(),
        prestigeCount: data.totalPrestiges,
      });
    }
  } catch (error) {
    logger.error('Failed to submit prestige to leaderboards:', error);
  }
}

/**
 * Clear all leaderboards (for testing/reset)
 */
export async function clearAllLeaderboards(): Promise<void> {
  try {
    await Promise.all(
      Object.values(LEADERBOARD_KEYS).map(key => AsyncStorage.removeItem(key))
    );
  } catch (error) {
    logger.error('Failed to clear leaderboards:', error);
  }
}

/**
 * Get all leaderboard categories
 */
export function getAllLeaderboardCategories(): LeaderboardCategory[] {
  return Object.keys(LEADERBOARD_KEYS) as LeaderboardCategory[];
}

/**
 * Get leaderboard display name
 */
export function getLeaderboardDisplayName(category: LeaderboardCategory): string {
  switch (category) {
    case 'networth_at_prestige':
      return 'Highest Net Worth at Prestige';
    case 'fastest_prestige':
      return 'Fastest to Prestige';
    case 'prestige_points_earned':
      return 'Most Prestige Points Earned';
    case 'total_prestiges':
      return 'Total Prestiges Completed';
    case 'legacy_wealth':
      return 'Largest Legacy Wealth';
    case 'generations_completed':
      return 'Most Generations';
    default:
      return category;
  }
}

