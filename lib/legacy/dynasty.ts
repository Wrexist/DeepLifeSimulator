/**
 * Dynasty System
 * 
 * Functions for calculating and managing dynasty statistics
 * across multiple generations
 */

import type { GameState, DynastyStats, Heirloom } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';

/**
 * Default dynasty stats
 */
export const DEFAULT_DYNASTY_STATS: DynastyStats = {
  totalGenerations: 1,
  totalWealth: 0,
  familyReputation: 0,
  heirlooms: [],
  familyAchievements: [],
  longestLivingMember: { name: '', age: 0 },
  wealthiestMember: { name: '', netWorth: 0 },
  totalChildrenAllGenerations: 0,
  dynastyFoundedYear: new Date().getFullYear(),
  familyMotto: undefined,
};

/**
 * Calculate dynasty reputation modifier
 * Higher reputation improves job opportunities, relationship chances, etc.
 */
export function getDynastyReputationModifier(reputation: number): number {
  if (reputation >= 100) return 1.5; // 50% bonus
  if (reputation >= 75) return 1.3; // 30% bonus
  if (reputation >= 50) return 1.15; // 15% bonus
  if (reputation >= 25) return 1.05; // 5% bonus
  return 1.0;
}

/**
 * Update dynasty stats when player dies / new generation
 */
export function updateDynastyOnDeath(
  currentStats: DynastyStats,
  playerName: string,
  playerAge: number,
  playerNetWorth: number,
  childrenCount: number,
  achievements: string[]
): DynastyStats {
  const updated = { ...currentStats };
  
  // Update totals
  updated.totalGenerations += 1;
  updated.totalWealth += playerNetWorth;
  updated.totalChildrenAllGenerations += childrenCount;
  
  // Check if longest living
  if (playerAge > updated.longestLivingMember.age) {
    updated.longestLivingMember = { name: playerName, age: playerAge };
  }
  
  // Check if wealthiest
  if (playerNetWorth > updated.wealthiestMember.netWorth) {
    updated.wealthiestMember = { name: playerName, netWorth: playerNetWorth };
  }
  
  // Add unique achievements to family achievements
  achievements.forEach(achievement => {
    if (!updated.familyAchievements.includes(achievement)) {
      updated.familyAchievements.push(achievement);
    }
  });
  
  // Update family reputation based on achievements and wealth
  const reputationGain = calculateReputationGain(playerNetWorth, achievements.length);
  updated.familyReputation = Math.min(100, updated.familyReputation + reputationGain);
  
  return updated;
}

/**
 * Calculate reputation gain from a life
 */
function calculateReputationGain(netWorth: number, achievementCount: number): number {
  let gain = 0;
  
  // Wealth-based reputation
  if (netWorth >= 100000000) gain += 15;
  else if (netWorth >= 10000000) gain += 10;
  else if (netWorth >= 1000000) gain += 5;
  else if (netWorth >= 100000) gain += 2;
  
  // Achievement-based reputation
  gain += Math.min(10, achievementCount);
  
  return gain;
}

/**
 * Get total heirloom bonuses
 */
export function getHeirloomBonuses(heirlooms: Heirloom[]): {
  incomeBonus: number;
  reputationBonus: number;
  happinessBonus: number;
  learningBonus: number;
} {
  const bonuses = {
    incomeBonus: 0,
    reputationBonus: 0,
    happinessBonus: 0,
    learningBonus: 0,
  };
  
  heirlooms.forEach(heirloom => {
    if (heirloom.bonuses.incomeBonus) bonuses.incomeBonus += heirloom.bonuses.incomeBonus;
    if (heirloom.bonuses.reputationBonus) bonuses.reputationBonus += heirloom.bonuses.reputationBonus;
    if (heirloom.bonuses.happinessBonus) bonuses.happinessBonus += heirloom.bonuses.happinessBonus;
    if (heirloom.bonuses.learningBonus) bonuses.learningBonus += heirloom.bonuses.learningBonus;
  });
  
  return bonuses;
}

/**
 * Generate a random heirloom (chance when player dies rich)
 */
export function generateHeirloom(
  playerName: string,
  playerNetWorth: number,
  generation: number
): Heirloom | null {
  // Only generate heirloom if wealthy enough
  if (playerNetWorth < 1000000) return null;
  
  // Random chance based on wealth
  const chance = Math.min(0.5, playerNetWorth / 100000000);
  if (Math.random() > chance) return null;
  
  // Determine rarity
  let rarity: 'common' | 'rare' | 'legendary' = 'common';
  if (playerNetWorth >= 50000000) {
    rarity = Math.random() > 0.7 ? 'legendary' : 'rare';
  } else if (playerNetWorth >= 10000000) {
    rarity = Math.random() > 0.5 ? 'rare' : 'common';
  }
  
  // Heirloom templates
  const heirloomTemplates = {
    common: [
      { name: 'Family Watch', icon: '⌚', description: 'A classic timepiece passed down through generations' },
      { name: 'Antique Ring', icon: '💍', description: 'A beautiful ring with a small gemstone' },
      { name: 'Leather Journal', icon: '📖', description: 'Filled with wisdom from past generations' },
      { name: 'Silver Pen', icon: '🖊️', description: 'Used to sign important family documents' },
      { name: 'Family Photo Album', icon: '📸', description: 'Precious memories preserved forever' },
    ],
    rare: [
      { name: 'Diamond Necklace', icon: '💎', description: 'An exquisite piece of jewelry' },
      { name: 'Ancient Coin Collection', icon: '🪙', description: 'Rare coins from around the world' },
      { name: 'Gold Pocket Watch', icon: '⏱️', description: 'Intricate craftsmanship from a master jeweler' },
      { name: 'Vintage Painting', icon: '🖼️', description: 'A priceless work of art' },
      { name: 'Rare Book Collection', icon: '📚', description: 'First editions of literary classics' },
    ],
    legendary: [
      { name: 'Crown of Fortune', icon: '👑', description: 'Said to bring prosperity to its owner' },
      { name: 'Enchanted Amulet', icon: '🔮', description: 'An artifact of mysterious power' },
      { name: 'Dynasty Signet Ring', icon: '💫', description: 'Symbol of the family legacy' },
      { name: 'Golden Scepter', icon: '⚜️', description: 'Once owned by royalty' },
      { name: 'Ancient Family Crest', icon: '🛡️', description: 'The original emblem of the dynasty' },
    ],
  };
  
  const templates = heirloomTemplates[rarity];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Generate bonuses based on rarity
  const bonusMultiplier = rarity === 'legendary' ? 3 : rarity === 'rare' ? 2 : 1;
  const bonusTypes = ['incomeBonus', 'reputationBonus', 'happinessBonus', 'learningBonus'];
  const selectedBonus = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
  
  const bonuses: Heirloom['bonuses'] = {};
  bonuses[selectedBonus as keyof typeof bonuses] = bonusMultiplier * 5;
  
  // Calculate value based on rarity and player wealth
  const baseValue = rarity === 'legendary' ? 1000000 : rarity === 'rare' ? 100000 : 10000;
  const currentValue = baseValue + Math.floor(Math.random() * baseValue);
  
  return {
    id: `heirloom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: template.name,
    description: template.description,
    rarity,
    generationsHeld: 1,
    originalOwner: playerName,
    currentValue,
    bonuses,
    icon: template.icon,
  };
}

/**
 * Update heirloom generations held
 */
export function updateHeirloomGenerations(heirlooms: Heirloom[]): Heirloom[] {
  return heirlooms.map(heirloom => ({
    ...heirloom,
    generationsHeld: heirloom.generationsHeld + 1,
    // Increase value slightly with age
    currentValue: Math.floor(heirloom.currentValue * 1.05),
  }));
}

/**
 * Calculate dynasty tier based on stats
 */
export function getDynastyTier(stats: DynastyStats): {
  tier: string;
  title: string;
  description: string;
} {
  const score = calculateDynastyScore(stats);
  
  if (score >= 1000) {
    return {
      tier: 'legendary',
      title: 'Legendary Dynasty',
      description: 'Your family name is known throughout history',
    };
  }
  if (score >= 500) {
    return {
      tier: 'prestigious',
      title: 'Prestigious Dynasty',
      description: 'A family of great influence and power',
    };
  }
  if (score >= 250) {
    return {
      tier: 'notable',
      title: 'Notable Dynasty',
      description: 'Your family has made a mark on society',
    };
  }
  if (score >= 100) {
    return {
      tier: 'established',
      title: 'Established Dynasty',
      description: 'A respectable family with growing influence',
    };
  }
  if (score >= 50) {
    return {
      tier: 'emerging',
      title: 'Emerging Dynasty',
      description: 'Your family is beginning to build a legacy',
    };
  }
  return {
    tier: 'humble',
    title: 'Humble Beginnings',
    description: 'Every great dynasty starts somewhere',
  };
}

/**
 * Calculate dynasty score for tier determination
 */
function calculateDynastyScore(stats: DynastyStats): number {
  let score = 0;
  
  // Generation score
  score += stats.totalGenerations * 10;
  
  // Wealth score
  if (stats.totalWealth >= 1000000000) score += 200;
  else if (stats.totalWealth >= 100000000) score += 100;
  else if (stats.totalWealth >= 10000000) score += 50;
  else if (stats.totalWealth >= 1000000) score += 20;
  
  // Reputation score
  score += stats.familyReputation;
  
  // Heirloom score
  stats.heirlooms.forEach(heirloom => {
    score += heirloom.rarity === 'legendary' ? 50 : heirloom.rarity === 'rare' ? 20 : 5;
    score += heirloom.generationsHeld * 2;
  });
  
  // Achievement score
  score += stats.familyAchievements.length * 2;
  
  // Longevity bonus
  if (stats.longestLivingMember.age >= 90) score += 30;
  else if (stats.longestLivingMember.age >= 80) score += 15;
  
  return score;
}

/**
 * Get family reputation effects on gameplay
 */
export function getReputationEffects(reputation: number): {
  jobAcceptanceBonus: number;
  relationshipBonus: number;
  startingMoneyBonus: number;
} {
  const modifier = getDynastyReputationModifier(reputation);
  
  return {
    jobAcceptanceBonus: Math.floor((modifier - 1) * 20), // 0-10% bonus
    relationshipBonus: Math.floor((modifier - 1) * 10), // 0-5 bonus
    startingMoneyBonus: Math.floor((modifier - 1) * 500), // 0-250 bonus money
  };
}

