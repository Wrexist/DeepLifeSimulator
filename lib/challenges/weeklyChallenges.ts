/**
 * Weekly Themed Challenges
 *
 * Multi-objective challenges that rotate every 7 real-time days.
 * Each challenge has 4-6 objectives that must ALL be met simultaneously.
 * Progress is checked against absolute game state each week.
 *
 * Rotation is deterministic based on UTC week number — all players
 * see the same challenge at the same time.
 */
import type { GameState } from '@/contexts/game/types';

export interface WeeklyChallengeObjective {
  id: string;
  description: string;
  target: number;
  checkCurrent: (state: GameState) => number;
}

export interface WeeklyChallengeDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  reward: number; // gems
  difficulty: 'normal' | 'hard' | 'extreme';
  objectives: WeeklyChallengeObjective[];
}

// Helper: rough net worth
function getNetWorth(s: GameState): number {
  const cash = s.stats?.money ?? 0;
  const bank = s.bankSavings ?? 0;
  const holdings = Array.isArray(s.stocks) ? s.stocks : (s.stocks?.holdings ?? []);
  const stocks = Array.isArray(holdings)
    ? holdings.reduce(
        (sum: number, st: any) => sum + (st.shares ?? 0) * (st.currentPrice ?? 0),
        0
      )
    : 0;
  const realEstate = Array.isArray(s.realEstate)
    ? s.realEstate.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0)
    : 0;
  return cash + bank + stocks + realEstate;
}

export const WEEKLY_CHALLENGES: WeeklyChallengeDefinition[] = [
  {
    id: 'wc_monopoly',
    name: 'The Monopoly Challenge',
    emoji: '🏢',
    description: 'Build a real estate empire with a family.',
    reward: 200,
    difficulty: 'hard',
    objectives: [
      {
        id: 'own_3_properties',
        description: 'Own 3+ properties',
        target: 3,
        checkCurrent: (s) => (s.realEstate ?? []).filter((r: any) => r.owned).length,
      },
      {
        id: 'net_worth_500k',
        description: 'Have $500K+ net worth',
        target: 1,
        checkCurrent: (s) => (getNetWorth(s) >= 500_000 ? 1 : 0),
      },
      {
        id: 'married',
        description: 'Be married',
        target: 1,
        checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
      },
      {
        id: 'reputation_50',
        description: 'Have 50+ reputation',
        target: 1,
        checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 50 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_scholar',
    name: 'The Scholar',
    emoji: '🎓',
    description: 'Become the most educated person in town.',
    reward: 150,
    difficulty: 'normal',
    objectives: [
      {
        id: 'education_2',
        description: 'Complete 2+ educations',
        target: 2,
        checkCurrent: (s) =>
          (s.educations ?? []).filter((e: any) => e?.completed).length,
      },
      {
        id: 'savings_10k',
        description: 'Have $10K+ in savings',
        target: 1,
        checkCurrent: (s) => ((s.stats?.money ?? 0) >= 10000 ? 1 : 0),
      },
      {
        id: 'reputation_40',
        description: 'Have 40+ reputation',
        target: 1,
        checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 40 ? 1 : 0),
      },
      {
        id: 'health_60',
        description: 'Maintain 60+ health',
        target: 1,
        checkCurrent: (s) => ((s.stats?.health ?? 0) >= 60 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_fitness_guru',
    name: 'Fitness Guru',
    emoji: '💪',
    description: 'Peak physical condition with a social following.',
    reward: 150,
    difficulty: 'normal',
    objectives: [
      {
        id: 'fitness_80',
        description: 'Have 80+ fitness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.fitness ?? 0) >= 80 ? 1 : 0),
      },
      {
        id: 'health_80',
        description: 'Have 80+ health',
        target: 1,
        checkCurrent: (s) => ((s.stats?.health ?? 0) >= 80 ? 1 : 0),
      },
      {
        id: 'happiness_70',
        description: 'Have 70+ happiness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 70 ? 1 : 0),
      },
      {
        id: 'followers_1k',
        description: 'Have 1K+ social followers',
        target: 1,
        checkCurrent: (s) => ((s.socialMedia?.followers ?? 0) >= 1000 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_social_butterfly',
    name: 'Social Butterfly',
    emoji: '🦋',
    description: 'Be the most connected person in your city.',
    reward: 175,
    difficulty: 'normal',
    objectives: [
      {
        id: 'relationships_5',
        description: 'Have 5+ relationships',
        target: 5,
        checkCurrent: (s) => (s.relationships ?? []).length,
      },
      {
        id: 'married',
        description: 'Be married',
        target: 1,
        checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
      },
      {
        id: 'happiness_80',
        description: 'Have 80+ happiness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 80 ? 1 : 0),
      },
      {
        id: 'followers_5k',
        description: 'Have 5K+ social followers',
        target: 1,
        checkCurrent: (s) => ((s.socialMedia?.followers ?? 0) >= 5000 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_tycoon',
    name: 'Business Tycoon',
    emoji: '💼',
    description: 'Build a corporate empire.',
    reward: 250,
    difficulty: 'hard',
    objectives: [
      {
        id: 'company_2',
        description: 'Own 2+ companies',
        target: 2,
        checkCurrent: (s) => (s.companies ?? []).filter((c: any) => c.owned).length,
      },
      {
        id: 'net_worth_1m',
        description: 'Have $1M+ net worth',
        target: 1,
        checkCurrent: (s) => (getNetWorth(s) >= 1_000_000 ? 1 : 0),
      },
      {
        id: 'employees_10',
        description: 'Employ 10+ people total',
        target: 10,
        checkCurrent: (s) =>
          (s.companies ?? []).reduce(
            (sum: number, c: any) => sum + (c.employees?.length ?? 0),
            0
          ),
      },
      {
        id: 'reputation_60',
        description: 'Have 60+ reputation',
        target: 1,
        checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 60 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_balanced_life',
    name: 'Balanced Life',
    emoji: '⚖️',
    description: 'Perfect balance across all areas of life.',
    reward: 200,
    difficulty: 'hard',
    objectives: [
      {
        id: 'all_stats_60',
        description: 'All stats above 60',
        target: 1,
        checkCurrent: (s) =>
          (s.stats?.health ?? 0) >= 60 &&
          (s.stats?.happiness ?? 0) >= 60 &&
          (s.stats?.energy ?? 0) >= 60
            ? 1
            : 0,
      },
      {
        id: 'employed',
        description: 'Be employed',
        target: 1,
        checkCurrent: (s) => (s.currentJob ? 1 : 0),
      },
      {
        id: 'married',
        description: 'Be married',
        target: 1,
        checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
      },
      {
        id: 'savings_50k',
        description: 'Have $50K+ in savings',
        target: 1,
        checkCurrent: (s) => ((s.stats?.money ?? 0) >= 50000 ? 1 : 0),
      },
      {
        id: 'fitness_50',
        description: 'Have 50+ fitness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.fitness ?? 0) >= 50 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_investor',
    name: 'Wall Street Wolf',
    emoji: '📈',
    description: 'Dominate the financial markets.',
    reward: 200,
    difficulty: 'hard',
    objectives: [
      {
        id: 'stocks_5',
        description: 'Own 5+ different stocks',
        target: 5,
        checkCurrent: (s) => {
          const holdings = s.stocks?.holdings ?? [];
          return holdings.filter(st => (st.shares ?? 0) > 0).length;
        },
      },
      {
        id: 'net_worth_250k',
        description: 'Have $250K+ net worth',
        target: 1,
        checkCurrent: (s) => (getNetWorth(s) >= 250_000 ? 1 : 0),
      },
      {
        id: 'property_1',
        description: 'Own at least 1 property',
        target: 1,
        checkCurrent: (s) =>
          (s.realEstate ?? []).filter((r: any) => r.owned).length >= 1 ? 1 : 0,
      },
    ],
  },
  {
    id: 'wc_family_values',
    name: 'Family Values',
    emoji: '👨‍👩‍👧‍👦',
    description: 'Build the perfect family life.',
    reward: 175,
    difficulty: 'normal',
    objectives: [
      {
        id: 'married',
        description: 'Be married',
        target: 1,
        checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
      },
      {
        id: 'children_2',
        description: 'Have 2+ children',
        target: 2,
        checkCurrent: (s) => (s.family?.children ?? []).length,
      },
      {
        id: 'property',
        description: 'Own a home',
        target: 1,
        checkCurrent: (s) =>
          (s.realEstate ?? []).filter((r: any) => r.owned).length >= 1 ? 1 : 0,
      },
      {
        id: 'happiness_75',
        description: 'Have 75+ happiness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 75 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_survivor',
    name: 'The Survivor',
    emoji: '🔥',
    description: 'Thrive despite impossible odds.',
    reward: 300,
    difficulty: 'extreme',
    objectives: [
      {
        id: 'age_60',
        description: 'Reach age 60+',
        target: 1,
        checkCurrent: (s) => (Math.floor(s.date?.age ?? 18) >= 60 ? 1 : 0),
      },
      {
        id: 'net_worth_100k',
        description: 'Have $100K+ net worth',
        target: 1,
        checkCurrent: (s) => (getNetWorth(s) >= 100_000 ? 1 : 0),
      },
      {
        id: 'all_stats_50',
        description: 'All stats above 50',
        target: 1,
        checkCurrent: (s) =>
          (s.stats?.health ?? 0) >= 50 &&
          (s.stats?.happiness ?? 0) >= 50 &&
          (s.stats?.energy ?? 0) >= 50
            ? 1
            : 0,
      },
      {
        id: 'achievements_10',
        description: 'Unlock 10+ achievements',
        target: 10,
        checkCurrent: (s) =>
          (s.achievements ?? []).filter((a: any) => a.completed).length,
      },
    ],
  },
  {
    id: 'wc_influencer',
    name: 'Influencer Life',
    emoji: '📱',
    description: 'Become the ultimate social media star.',
    reward: 200,
    difficulty: 'hard',
    objectives: [
      {
        id: 'followers_50k',
        description: 'Have 50K+ social followers',
        target: 1,
        checkCurrent: (s) => ((s.socialMedia?.followers ?? 0) >= 50000 ? 1 : 0),
      },
      {
        id: 'posts_20',
        description: 'Make 20+ social posts',
        target: 20,
        checkCurrent: (s) => s.socialMedia?.totalPosts ?? 0,
      },
      {
        id: 'reputation_70',
        description: 'Have 70+ reputation',
        target: 1,
        checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 70 ? 1 : 0),
      },
      {
        id: 'money_100k',
        description: 'Have $100K+ cash',
        target: 1,
        checkCurrent: (s) => ((s.stats?.money ?? 0) >= 100000 ? 1 : 0),
      },
    ],
  },
  {
    id: 'wc_pet_lover',
    name: 'Pet Paradise',
    emoji: '🐾',
    description: 'Build the happiest pet family.',
    reward: 125,
    difficulty: 'normal',
    objectives: [
      {
        id: 'pets_2',
        description: 'Own 2+ pets',
        target: 2,
        checkCurrent: (s) => (s.pets ?? []).length,
      },
      {
        id: 'happiness_80',
        description: 'Have 80+ happiness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 80 ? 1 : 0),
      },
      {
        id: 'home',
        description: 'Own a home',
        target: 1,
        checkCurrent: (s) =>
          (s.realEstate ?? []).filter((r: any) => r.owned).length >= 1 ? 1 : 0,
      },
    ],
  },
  {
    id: 'wc_globe_trotter',
    name: 'Globe Trotter',
    emoji: '✈️',
    description: 'See the world and build wealth.',
    reward: 175,
    difficulty: 'normal',
    objectives: [
      {
        id: 'countries_3',
        description: 'Visit 3+ countries',
        target: 3,
        checkCurrent: (s) => s.travel?.visitedDestinations?.length ?? 0,
      },
      {
        id: 'money_25k',
        description: 'Have $25K+ cash',
        target: 1,
        checkCurrent: (s) => ((s.stats?.money ?? 0) >= 25000 ? 1 : 0),
      },
      {
        id: 'happiness_70',
        description: 'Have 70+ happiness',
        target: 1,
        checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 70 ? 1 : 0),
      },
    ],
  },
];

/**
 * Get the active weekly challenge based on UTC week number.
 * All players see the same challenge at the same time.
 */
export function getActiveWeeklyChallengeId(timestamp: number = Date.now()): string {
  const weekNumber = Math.floor(timestamp / (7 * 24 * 60 * 60 * 1000));
  const index = weekNumber % WEEKLY_CHALLENGES.length;
  return WEEKLY_CHALLENGES[index].id;
}

export function getWeeklyChallengeDefinition(
  challengeId: string
): WeeklyChallengeDefinition | undefined {
  return WEEKLY_CHALLENGES.find((c) => c.id === challengeId);
}

/**
 * Evaluate progress for all objectives in a challenge.
 */
export function evaluateChallengeProgress(
  challengeId: string,
  state: GameState
): Array<{ id: string; description: string; target: number; current: number; completed: boolean }> {
  const def = getWeeklyChallengeDefinition(challengeId);
  if (!def) return [];

  return def.objectives.map((obj) => {
    const current = obj.checkCurrent(state);
    return {
      id: obj.id,
      description: obj.description,
      target: obj.target,
      current,
      completed: current >= obj.target,
    };
  });
}

/**
 * Check if all objectives in a challenge are completed.
 */
export function isChallengeComplete(challengeId: string, state: GameState): boolean {
  const progress = evaluateChallengeProgress(challengeId, state);
  return progress.length > 0 && progress.every((p) => p.completed);
}

/**
 * Initialize or rotate the weekly challenge.
 */
export function getOrRotateWeeklyChallenge(
  state: GameState
): GameState['weeklyChallenge'] {
  const now = Date.now();
  const existing = state.weeklyChallenge;

  // If existing challenge hasn't expired (within 7 days of startedAt), keep it
  if (existing && !needsRotation(existing)) {
    return existing;
  }

  // New challenge needed
  const challengeId = getActiveWeeklyChallengeId(now);
  const def = getWeeklyChallengeDefinition(challengeId);
  if (!def) return undefined;

  const progressResult = evaluateChallengeProgress(challengeId, state);

  return {
    challengeId,
    startedAt: now,
    progress: progressResult.map((p) => ({
      objectiveId: p.id,
      current: p.current,
      target: p.target,
      met: p.completed,
    })),
    completed: progressResult.every((p) => p.completed),
    rewardClaimed: false,
  };
}

function needsRotation(challenge: NonNullable<GameState['weeklyChallenge']>): boolean {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - challenge.startedAt > WEEK_MS;
}
