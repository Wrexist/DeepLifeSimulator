import { GameState } from '@/contexts/GameContext';
import { ImageSourcePropType } from 'react-native';

// Enhanced Achievement System with better engagement
export interface EnhancedAchievement {
  id: string;
  title: string;
  description: string;
  category: 'wealth' | 'career' | 'social' | 'health' | 'education' | 'family' | 'crypto' | 'real_estate' | 'special' | 'milestone';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  progressSpec:
    | { kind: 'boolean'; met: (gs: GameState) => boolean }
    | { kind: 'counter'; current: (gs: GameState) => number; goal: number }
    | { kind: 'streak'; current: (gs: GameState) => number; goal: number; resetCondition?: (gs: GameState) => boolean }
    | { kind: 'milestone'; milestones: number[]; current: (gs: GameState) => number };
  rewards: {
    gems: number;
    experience?: number;
    title?: string;
    badge?: string;
    specialEffect?: string;
  };
  icon?: ImageSourcePropType;
  group?: string;
  hidden?: boolean; // For secret achievements
  unlockHint?: string; // Hint for hidden achievements
  celebrationType?: 'fireworks' | 'confetti' | 'sparkles' | 'golden' | 'rainbow';
  soundEffect?: string;
  animationType?: 'bounce' | 'pulse' | 'glow' | 'scale' | 'rotate';
  prerequisites?: string[]; // Achievement IDs that must be unlocked first
  timeLimit?: number; // Time limit in weeks (optional)
  difficulty: 1 | 2 | 3 | 4 | 5; // 1 = easy, 5 = extremely hard
  estimatedTime?: string; // Estimated time to complete
  tips?: string[]; // Tips to help achieve this
}

export interface AchievementProgress {
  id: string;
  progress: number;
  completed: boolean;
  completedAt?: number;
  claimed: boolean;
  claimedAt?: number;
  streak?: number;
  bestStreak?: number;
  attempts?: number;
  hints?: number; // Number of hints used
}

export interface AchievementCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  totalAchievements: number;
  completedAchievements: number;
  totalRewards: {
    gems: number;
    experience: number;
  };
}

// Enhanced Achievement Data
export const ENHANCED_ACHIEVEMENTS: EnhancedAchievement[] = [
  // Wealth Achievements
  {
    id: 'wealth_first_thousand',
    title: 'First Thousand',
    description: 'Earn your first $1,000',
    category: 'wealth',
    rarity: 'common',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 1000 },
    rewards: { gems: 5, experience: 10 },
    difficulty: 1,
    estimatedTime: '1-2 weeks',
    tips: ['Complete street jobs', 'Save money instead of spending'],
    celebrationType: 'sparkles',
    animationType: 'bounce'
  },
  {
    id: 'wealth_first_million',
    title: 'Millionaire',
    description: 'Accumulate $1,000,000 in cash',
    category: 'wealth',
    rarity: 'uncommon',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 1_000_000 },
    rewards: { gems: 50, experience: 100, title: 'Millionaire' },
    difficulty: 3,
    estimatedTime: '2-4 months',
    tips: ['Invest in stocks', 'Start a business', 'Buy real estate'],
    celebrationType: 'golden',
    animationType: 'glow',
    prerequisites: ['wealth_first_thousand']
  },
  {
    id: 'wealth_billionaire',
    title: 'Billionaire',
    description: 'Accumulate $1,000,000,000 in cash',
    category: 'wealth',
    rarity: 'legendary',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.money ?? 0, goal: 1_000_000_000 },
    rewards: { gems: 500, experience: 1000, title: 'Billionaire', badge: 'golden_crown' },
    difficulty: 5,
    estimatedTime: '6-12 months',
    tips: ['Build multiple companies', 'Invest heavily in crypto', 'Buy premium real estate'],
    celebrationType: 'rainbow',
    animationType: 'rotate',
    prerequisites: ['wealth_first_million']
  },

  // Career Achievements
  {
    id: 'career_first_job',
    title: 'First Job',
    description: 'Get your first job',
    category: 'career',
    rarity: 'common',
    progressSpec: { kind: 'boolean', met: gs => !!gs.currentJob },
    rewards: { gems: 10, experience: 20 },
    difficulty: 1,
    estimatedTime: '1 week',
    tips: ['Apply for entry-level positions', 'Complete education first'],
    celebrationType: 'sparkles',
    animationType: 'bounce'
  },
  {
    id: 'career_ceo',
    title: 'CEO',
    description: 'Reach the highest level in any career',
    category: 'career',
    rarity: 'rare',
    progressSpec: { kind: 'boolean', met: gs => gs.careers.some(c => c.level >= c.levels.length) },
    rewards: { gems: 100, experience: 200, title: 'CEO' },
    difficulty: 4,
    estimatedTime: '3-6 months',
    tips: ['Focus on one career path', 'Complete relevant education', 'Build relationships'],
    celebrationType: 'fireworks',
    animationType: 'pulse'
  },

  // Social Achievements
  {
    id: 'social_first_friend',
    title: 'First Friend',
    description: 'Make your first friend',
    category: 'social',
    rarity: 'common',
    progressSpec: { kind: 'counter', current: gs => gs.relationships?.filter(r => r.type === 'friend').length ?? 0, goal: 1 },
    rewards: { gems: 5, experience: 10 },
    difficulty: 1,
    estimatedTime: '1-2 weeks',
    tips: ['Use social activities', 'Maintain relationships'],
    celebrationType: 'sparkles',
    animationType: 'bounce'
  },
  {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Have 25 friends',
    category: 'social',
    rarity: 'uncommon',
    progressSpec: { kind: 'counter', current: gs => gs.relationships?.filter(r => r.type === 'friend').length ?? 0, goal: 25 },
    rewards: { gems: 75, experience: 150, title: 'Social Butterfly' },
    difficulty: 3,
    estimatedTime: '2-4 months',
    tips: ['Regularly socialize', 'Use dating apps', 'Attend events'],
    celebrationType: 'confetti',
    animationType: 'glow',
    prerequisites: ['social_first_friend']
  },

  // Health Achievements
  {
    id: 'health_peak_condition',
    title: 'Peak Condition',
    description: 'Reach 200 fitness',
    category: 'health',
    rarity: 'rare',
    progressSpec: { kind: 'counter', current: gs => gs.stats?.fitness ?? 0, goal: 200 },
    rewards: { gems: 100, experience: 200, title: 'Fitness Guru' },
    difficulty: 4,
    estimatedTime: '3-6 months',
    tips: ['Exercise regularly', 'Eat healthy', 'Use gym equipment'],
    celebrationType: 'fireworks',
    animationType: 'pulse'
  },
  {
    id: 'health_centenarian',
    title: 'Centenarian',
    description: 'Live to age 100',
    category: 'health',
    rarity: 'epic',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 100 },
    rewards: { gems: 200, experience: 500, title: 'Centenarian', badge: 'longevity' },
    difficulty: 5,
    estimatedTime: '6-12 months',
    tips: ['Maintain high health', 'Avoid risky activities', 'Get regular checkups'],
    celebrationType: 'rainbow',
    animationType: 'rotate'
  },

  // Family Achievements
  {
    id: 'family_married',
    title: 'Tied the Knot',
    description: 'Get married',
    category: 'family',
    rarity: 'uncommon',
    progressSpec: { kind: 'boolean', met: gs => !!gs.family?.spouse },
    rewards: { gems: 50, experience: 100, title: 'Married' },
    difficulty: 2,
    estimatedTime: '1-3 months',
    tips: ['Build strong relationships', 'Use dating apps', 'Propose when ready'],
    celebrationType: 'confetti',
    animationType: 'glow'
  },
  {
    id: 'family_large_family',
    title: 'Large Family',
    description: 'Have 5 children',
    category: 'family',
    rarity: 'rare',
    progressSpec: { kind: 'counter', current: gs => gs.relationships?.filter(r => r.type === 'child').length ?? 0, goal: 5 },
    rewards: { gems: 150, experience: 300, title: 'Family Man/Woman' },
    difficulty: 4,
    estimatedTime: '4-8 months',
    tips: ['Get married first', 'Have children regularly', 'Maintain family relationships'],
    celebrationType: 'fireworks',
    animationType: 'pulse',
    prerequisites: ['family_married']
  },

  // Crypto Achievements
  {
    id: 'crypto_first_buy',
    title: 'Crypto Curious',
    description: 'Buy your first cryptocurrency',
    category: 'crypto',
    rarity: 'common',
    progressSpec: { kind: 'boolean', met: gs => gs.cryptos?.some(c => c.owned > 0) },
    rewards: { gems: 10, experience: 20 },
    difficulty: 1,
    estimatedTime: '1 week',
    tips: ['Start with small amounts', 'Research different coins'],
    celebrationType: 'sparkles',
    animationType: 'bounce'
  },
  {
    id: 'crypto_whale',
    title: 'Crypto Whale',
    description: 'Own $10,000,000 worth of cryptocurrency',
    category: 'crypto',
    rarity: 'epic',
    progressSpec: { kind: 'counter', current: gs => gs.cryptos?.reduce((t, c) => t + c.owned * c.price, 0) ?? 0, goal: 10_000_000 },
    rewards: { gems: 300, experience: 600, title: 'Crypto Whale' },
    difficulty: 5,
    estimatedTime: '6-12 months',
    tips: ['Diversify your portfolio', 'Buy during dips', 'Hold long-term'],
    celebrationType: 'rainbow',
    animationType: 'rotate',
    prerequisites: ['crypto_first_buy']
  },

  // Real Estate Achievements
  {
    id: 'real_estate_first_property',
    title: 'Property Owner',
    description: 'Buy your first property',
    category: 'real_estate',
    rarity: 'uncommon',
    progressSpec: { kind: 'counter', current: gs => gs.realEstate?.filter(r => r.owned).length ?? 0, goal: 1 },
    rewards: { gems: 50, experience: 100, title: 'Property Owner' },
    difficulty: 2,
    estimatedTime: '1-2 months',
    tips: ['Save money for down payment', 'Check real estate market'],
    celebrationType: 'confetti',
    animationType: 'glow'
  },
  {
    id: 'real_estate_mogul',
    title: 'Real Estate Mogul',
    description: 'Own 10 properties',
    category: 'real_estate',
    rarity: 'legendary',
    progressSpec: { kind: 'counter', current: gs => gs.realEstate?.filter(r => r.owned).length ?? 0, goal: 10 },
    rewards: { gems: 500, experience: 1000, title: 'Real Estate Mogul', badge: 'property_king' },
    difficulty: 5,
    estimatedTime: '8-15 months',
    tips: ['Buy properties regularly', 'Upgrade existing properties', 'Diversify property types'],
    celebrationType: 'rainbow',
    animationType: 'rotate',
    prerequisites: ['real_estate_first_property']
  },

  // Special Achievements
  {
    id: 'special_perfectionist',
    title: 'Perfectionist',
    description: 'Maintain all stats above 90 for 10 consecutive weeks',
    category: 'special',
    rarity: 'mythic',
    progressSpec: { kind: 'streak', current: gs => gs.perfectWeeks ?? 0, goal: 10 },
    rewards: { gems: 1000, experience: 2000, title: 'Perfectionist', badge: 'golden_star', specialEffect: 'golden_aura' },
    difficulty: 5,
    estimatedTime: '3-6 months',
    tips: ['Balance all activities', 'Monitor stats carefully', 'Use items strategically'],
    celebrationType: 'rainbow',
    animationType: 'rotate',
    hidden: true,
    unlockHint: 'Maintain perfect stats for an extended period'
  },
  {
    id: 'special_immortal',
    title: 'Immortal',
    description: 'Reach age 150',
    category: 'special',
    rarity: 'mythic',
    progressSpec: { kind: 'counter', current: gs => gs.date?.age ?? 0, goal: 150 },
    rewards: { gems: 2000, experience: 5000, title: 'Immortal', badge: 'eternal', specialEffect: 'immortal_glow' },
    difficulty: 5,
    estimatedTime: '12-24 months',
    tips: ['Maintain perfect health', 'Avoid all risks', 'Use premium items'],
    celebrationType: 'rainbow',
    animationType: 'rotate',
    hidden: true,
    unlockHint: 'Achieve the impossible - live forever'
  }
];

// Achievement Categories
export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  {
    id: 'wealth',
    name: 'Wealth',
    description: 'Financial achievements and money milestones',
    icon: '💰',
    color: '#10B981',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'career',
    name: 'Career',
    description: 'Professional achievements and job milestones',
    icon: '💼',
    color: '#F59E0B',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Relationship and social achievements',
    icon: '👥',
    color: '#EF4444',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'health',
    name: 'Health',
    description: 'Fitness and longevity achievements',
    icon: '💪',
    color: '#06B6D4',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'family',
    name: 'Family',
    description: 'Marriage and family achievements',
    icon: '👨‍👩‍👧‍👦',
    color: '#8B5CF6',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'crypto',
    name: 'Crypto',
    description: 'Cryptocurrency and investment achievements',
    icon: '₿',
    color: '#F97316',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Property and real estate achievements',
    icon: '🏠',
    color: '#84CC16',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  },
  {
    id: 'special',
    name: 'Special',
    description: 'Rare and secret achievements',
    icon: '⭐',
    color: '#F59E0B',
    totalAchievements: 0,
    completedAchievements: 0,
    totalRewards: { gems: 0, experience: 0 }
  }
];

// Utility Functions
export const getAchievementById = (id: string): EnhancedAchievement | undefined => {
  return ENHANCED_ACHIEVEMENTS.find(a => a.id === id);
};

export const getAchievementsByCategory = (category: string): EnhancedAchievement[] => {
  return ENHANCED_ACHIEVEMENTS.filter(a => a.category === category);
};

export const getAchievementsByRarity = (rarity: string): EnhancedAchievement[] => {
  return ENHANCED_ACHIEVEMENTS.filter(a => a.rarity === rarity);
};

export const calculateAchievementProgress = (achievement: EnhancedAchievement, gameState: GameState): number => {
  const { progressSpec } = achievement;
  
  switch (progressSpec.kind) {
    case 'boolean':
      return progressSpec.met(gameState) ? 1 : 0;
    case 'counter':
      const current = progressSpec.current(gameState);
      return Math.min(current / progressSpec.goal, 1);
    case 'streak':
      const streak = progressSpec.current(gameState);
      return Math.min(streak / progressSpec.goal, 1);
    case 'milestone':
      const value = progressSpec.current(gameState);
      const milestones = progressSpec.milestones;
      const currentMilestone = milestones.findIndex(m => value < m);
      if (currentMilestone === -1) return 1; // All milestones reached
      const prevMilestone = currentMilestone === 0 ? 0 : milestones[currentMilestone - 1];
      const nextMilestone = milestones[currentMilestone];
      return (value - prevMilestone) / (nextMilestone - prevMilestone);
    default:
      return 0;
  }
};

export const isAchievementUnlocked = (achievement: EnhancedAchievement, gameState: GameState): boolean => {
  const progress = calculateAchievementProgress(achievement, gameState);
  return progress >= 1;
};

export const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case 'common': return '#6B7280';
    case 'uncommon': return '#10B981';
    case 'rare': return '#3B82F6';
    case 'epic': return '#8B5CF6';
    case 'legendary': return '#F59E0B';
    case 'mythic': return '#EF4444';
    default: return '#6B7280';
  }
};

export const getRarityGlow = (rarity: string): string => {
  switch (rarity) {
    case 'common': return 'rgba(107, 114, 128, 0.3)';
    case 'uncommon': return 'rgba(16, 185, 129, 0.3)';
    case 'rare': return 'rgba(59, 130, 246, 0.3)';
    case 'epic': return 'rgba(139, 92, 246, 0.3)';
    case 'legendary': return 'rgba(245, 158, 11, 0.3)';
    case 'mythic': return 'rgba(239, 68, 68, 0.3)';
    default: return 'rgba(107, 114, 128, 0.3)';
  }
};

export const getDifficultyText = (difficulty: number): string => {
  switch (difficulty) {
    case 1: return 'Easy';
    case 2: return 'Medium';
    case 3: return 'Hard';
    case 4: return 'Very Hard';
    case 5: return 'Extremely Hard';
    default: return 'Unknown';
  }
};

export const getDifficultyColor = (difficulty: number): string => {
  switch (difficulty) {
    case 1: return '#10B981';
    case 2: return '#F59E0B';
    case 3: return '#EF4444';
    case 4: return '#8B5CF6';
    case 5: return '#DC2626';
    default: return '#6B7280';
  }
};
