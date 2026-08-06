/**
 * Dynasty System
 * 
 * Functions for calculating and managing dynasty statistics
 * across multiple generations
 */

import type { DynastyStats, Heirloom } from '@/contexts/game/types';

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
  achievements: string[],
  // v13: cross-generation Pulse follower carry (optional for back-compat
  // with any test or pre-v13 callsite that doesn't supply it).
  peakFollowersThisLife: number = 0,
): DynastyStats {
  // Clone the ARRAYS, not just the top level. `{ ...currentStats }` is shallow,
  // so `familyAchievements` stayed the same array object the caller passed in —
  // and the `push` below therefore mutated the LIVE save's
  // `state.dynastyStats.familyAchievements` in place. `computeInheritance` reads
  // as a pure calculation and is called before the player has confirmed
  // anything, so a previewed-then-cancelled prestige permanently wrote this
  // life's achievements into the dynasty. Caught by the GP-3 regression test,
  // which saw one case's achievements appear in the next case's empty state.
  const updated: DynastyStats = {
    ...currentStats,
    familyAchievements: [...(currentStats.familyAchievements ?? [])],
    heirlooms: [...(currentStats.heirlooms ?? [])],
  };

  // Update totals
  updated.totalGenerations += 1;
  updated.totalWealth += playerNetWorth;
  updated.totalChildrenAllGenerations += childrenCount;

  // v13 Pulse: accumulate peak followers into the dynasty's lifetime carry.
  if (peakFollowersThisLife > 0) {
    updated.pulseLifetimeFollowersCarry =
      (updated.pulseLifetimeFollowersCarry ?? 0) + peakFollowersThisLife;
  }
  
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
  _generation: number
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
 * The dynasty rank ladder.
 *
 * `getDynastyTier` shipped with SIX tiers, a title and a description each —
 * and **zero consumers** anywhere in the app. It is a working, persisted,
 * cross-life progression score that no player has ever seen, which is the same
 * "built but unreachable" class as the legacy shop's missing buy button.
 *
 * Surfacing it also exposed that the ladder stopped where a long dynasty is
 * only getting started. `calculateDynastyScore` is unbounded in practice:
 * `totalGenerations` grows +1 per death forever, and each heirloom contributes
 * `generationsHeld * 2`, so a 50-generation family scores in the low thousands
 * while the old top rank capped out at 1,000. Three ranks were added above
 * Legendary, with thresholds derived from that curve rather than chosen as
 * round numbers: a deep-but-plausible family (60 generations, $2B of combined
 * wealth, 15 legendary heirlooms held 30 generations, max reputation) scores
 * ~2,700, so the ladder runs 1,500 / 2,000 / 2,600 — the top rank is a real
 * climb past Legendary that such a dynasty just finishes.
 *
 * The first pass used 1,800 / 3,000 / 5,000, chosen as round numbers, and the
 * accompanying test caught that 5,000 was unreachable by any plausible family.
 * Thresholds are derived FROM the growth curve, not imposed on it.
 */
export interface DynastyRank {
  tier: string;
  title: string;
  description: string;
  /** Score at which this rank is earned. */
  minScore: number;
}

export const DYNASTY_RANKS: DynastyRank[] = [
  { tier: 'humble', title: 'Humble Beginnings', description: 'Every great dynasty starts somewhere', minScore: 0 },
  { tier: 'emerging', title: 'Emerging Dynasty', description: 'Your family is beginning to build a legacy', minScore: 50 },
  { tier: 'established', title: 'Established Dynasty', description: 'A respectable family with growing influence', minScore: 100 },
  { tier: 'notable', title: 'Notable Dynasty', description: 'Your family has made a mark on society', minScore: 250 },
  { tier: 'prestigious', title: 'Prestigious Dynasty', description: 'A family of great influence and power', minScore: 500 },
  { tier: 'legendary', title: 'Legendary Dynasty', description: 'Your family name is known throughout history', minScore: 1000 },
  { tier: 'storied', title: 'Storied House', description: 'Historians argue about your family', minScore: 1500 },
  { tier: 'immortal', title: 'Immortal Line', description: 'The name has outlived everyone who first carried it', minScore: 2000 },
  { tier: 'mythic', title: 'Mythic Dynasty', description: 'Your family is no longer quite believed to be real', minScore: 2600 },
];

/**
 * Calculate dynasty tier based on stats.
 *
 * Return shape is unchanged from the original six-tier version so any future
 * caller written against it keeps working.
 */
export function getDynastyTier(stats: DynastyStats): {
  tier: string;
  title: string;
  description: string;
} {
  const score = calculateDynastyScore(stats);
  // Highest rank whose threshold is met. Walked from the top so the ladder
  // stays correct if ranks are ever inserted mid-table.
  for (let i = DYNASTY_RANKS.length - 1; i >= 0; i -= 1) {
    if (score >= DYNASTY_RANKS[i].minScore) {
      const { tier, title, description } = DYNASTY_RANKS[i];
      return { tier, title, description };
    }
  }
  const first = DYNASTY_RANKS[0];
  return { tier: first.tier, title: first.title, description: first.description };
}

/**
 * Current score, current rank, and what is next — everything a readout needs.
 * `progress` is 0..1 through the CURRENT band, so a bar can't jump backwards
 * when a new rank is entered.
 */
export function getDynastyProgress(stats: DynastyStats): {
  score: number;
  rank: DynastyRank;
  next?: DynastyRank;
  progress: number;
} {
  const score = calculateDynastyScore(stats);
  let index = 0;
  for (let i = DYNASTY_RANKS.length - 1; i >= 0; i -= 1) {
    if (score >= DYNASTY_RANKS[i].minScore) { index = i; break; }
  }
  const rank = DYNASTY_RANKS[index];
  const next = DYNASTY_RANKS[index + 1];
  const span = next ? next.minScore - rank.minScore : 0;
  const progress = next && span > 0
    ? Math.max(0, Math.min(1, (score - rank.minScore) / span))
    : 1;
  return { score, rank, next, progress };
}

/**
 * Calculate dynasty score for tier determination.
 *
 * Exported so a readout can show the number the rank is derived from — a rank
 * with no visible score is a badge, not a progression bar.
 */
export function calculateDynastyScore(stats: DynastyStats): number {
  let score = 0;

  // Generation score
  score += (stats.totalGenerations ?? 0) * 10;

  // Wealth score
  const wealth = stats.totalWealth ?? 0;
  if (wealth >= 1000000000) score += 200;
  else if (wealth >= 100000000) score += 100;
  else if (wealth >= 10000000) score += 50;
  else if (wealth >= 1000000) score += 20;

  // Reputation score
  score += stats.familyReputation ?? 0;

  // Heirloom score
  (stats.heirlooms ?? []).forEach(heirloom => {
    score += heirloom.rarity === 'legendary' ? 50 : heirloom.rarity === 'rare' ? 20 : 5;
    score += (heirloom.generationsHeld ?? 0) * 2;
  });

  // Achievement score
  score += (stats.familyAchievements ?? []).length * 2;

  // Descendants. `totalChildrenAllGenerations` accumulates on every death, so
  // a family that keeps having children keeps climbing — which is what makes
  // grandchildren (v34) feed the rank rather than being a display-only tree.
  score += Math.min(200, (stats.totalChildrenAllGenerations ?? 0) * 3);

  // Longevity bonus
  const age = stats.longestLivingMember?.age ?? 0;
  if (age >= 90) score += 30;
  else if (age >= 80) score += 15;

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

