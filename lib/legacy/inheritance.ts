import { GameState } from '@/contexts/GameContext';
import { RealEstate, Company, Heirloom, DynastyStats } from '@/contexts/game/types';
import { Memory, MEMORY_TEMPLATES, generateMemoryId } from './memories';
import {
  generateHeirloom,
  updateHeirloomGenerations,
  updateDynastyOnDeath,
  getHeirloomBonuses,
} from './dynasty';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface InheritanceSummary {
  totalNetWorth: number;
  realEstateIds: string[];
  companyIds: string[];
  cash: number;
  bankSavings: number;
  debts: number;
  
  // New Systems
  familyBusinessIds: string[];
  generatedMemories: Memory[];
  legacyBonuses: {
    incomeMultiplier: number;
    learningMultiplier: number;
    reputationBonus: number;
  };
  
  // Dynasty & Heirloom System
  newHeirloom?: Heirloom;
  updatedHeirlooms: Heirloom[];
  updatedDynastyStats: DynastyStats;
}

export function computeInheritance(state: GameState): InheritanceSummary {
  const cash = state.stats.money ?? 0;
  const bankSavings = state.bankSavings ?? 0;

  const ownedRealEstate = (state.realEstate as RealEstate[] | undefined) ?? [];
  const realEstateIds: string[] = ownedRealEstate
    .filter(p => p.owned)
    .map(p => p.id);

  const companies = (state.companies as Company[] | undefined) ?? [];
  const companyIds: string[] = companies.map(c => c.id);
  
  // Identify family businesses (for now, any company owned is passed down as potential family business)
  // In future, check if it was already inherited
  const familyBusinessIds = companyIds;

  const realEstateValue = ownedRealEstate
    .filter(p => p.owned)
    .reduce((sum, p) => sum + (p.price ?? 0), 0);

  const companyValue = companies.reduce(
    (sum, c) => sum + (c.weeklyIncome ?? 0) * WEEKS_PER_YEAR * 5,
    0
  );

  const loansTotal =
    state.loans?.reduce((sum, loan) => sum + (loan.remaining ?? 0), 0) ??
    0;

  const debts = loansTotal < 0 ? 0 : loansTotal;
  const grossAssets = cash + bankSavings + realEstateValue + companyValue;
  const totalNetWorth = grossAssets - debts;

  // Clamp starting debt for next life
  const clampedNetWorth =
    totalNetWorth < 0 ? Math.max(totalNetWorth, -5000) : totalNetWorth;

  // Calculate Legacy Bonuses
  const completedCount = (state.achievements || []).filter(a => a.completed).length;
  
  const incomeMultiplier =
    1 + Math.min(Math.max(clampedNetWorth, 0), 10_000_000) / 10_000_000 / 10; // up to +10%
    
  const learningMultiplier = 
    1 + Math.min(completedCount, 20) / 200; // up to +10%
    
  const reputationBonus = Math.min(
    Math.floor(state.stats.reputation / 10),
    20,
  );

  // Generate Memories from this life
  const generatedMemories: Memory[] = [];
  const generation = state.generationNumber;
  const ancestorName = state.userProfile.name || `${state.userProfile.firstName} ${state.userProfile.lastName}`;

  // 1. Wealth Memory
  if (totalNetWorth > 1_000_000) {
    const template = MEMORY_TEMPLATES.fortune_made(`$${(totalNetWorth / 1000000).toFixed(1)}M`, ancestorName);
    generatedMemories.push({
      id: generateMemoryId(generation, 'wealth'),
      title: template.title!,
      description: template.description!,
      category: 'achievement',
      generation,
      ancestorName,
      date: Date.now(),
      effects: { reputation: 5 },
      unlocked: false,
      unlockCondition: { age: 25 },
      tags: template.tags || [],
    });
  } else if (totalNetWorth < -1000) {
    const template = MEMORY_TEMPLATES.bankruptcy(ancestorName);
    generatedMemories.push({
      id: generateMemoryId(generation, 'bankruptcy'),
      title: template.title!,
      description: template.description!,
      category: 'warning',
      generation,
      ancestorName,
      date: Date.now(),
      effects: { happiness: -5, reputation: 5 },
      unlocked: false,
      unlockCondition: { age: 20 },
      tags: template.tags || [],
    });
  }

  // 2. Skill Memories (Top skills)
  // Iterate through skills (crime, hobbies, etc. - need to access from state)
  // Simplified for now: Check Achievements
  if (completedCount > 5) {
    generatedMemories.push({
        id: generateMemoryId(generation, 'achiever'),
        title: 'A Life of Achievement',
        description: `${ancestorName} accomplished many great things.`,
        category: 'story',
        generation,
        ancestorName,
        date: Date.now(),
        effects: { happiness: 5 },
        unlocked: false,
        tags: ['achievement'],
    });
  }

  // ============================================
  // Dynasty & Heirloom System
  // ============================================
  
  // Get current dynasty stats or create defaults
  const currentDynastyStats: DynastyStats = state.dynastyStats || {
    totalGenerations: generation,
    totalWealth: 0,
    familyReputation: 0,
    heirlooms: [],
    familyAchievements: [],
    longestLivingMember: { name: '', age: 0 },
    wealthiestMember: { name: '', netWorth: 0 },
    totalChildrenAllGenerations: 0,
    dynastyFoundedYear: 2025,
    familyMotto: undefined,
  };
  
  // Get player age and children count
  const playerAge = state.date?.age || 18;
  const childrenCount = state.family?.children?.length || 0;
  const unlockedAchievements = (state.achievements || [])
    .filter(a => a.completed)
    .map(a => a.name);
  
  // Update dynasty stats with this life's accomplishments
  const updatedDynastyStats = updateDynastyOnDeath(
    currentDynastyStats,
    ancestorName,
    playerAge,
    totalNetWorth,
    childrenCount,
    unlockedAchievements
  );
  
  // Try to generate a new heirloom if wealthy
  const newHeirloom = generateHeirloom(ancestorName, totalNetWorth, generation);
  
  // Update existing heirlooms (increment generations held)
  let updatedHeirlooms = updateHeirloomGenerations(currentDynastyStats.heirlooms);
  
  // Add new heirloom if generated
  if (newHeirloom) {
    updatedHeirlooms = [...updatedHeirlooms, newHeirloom];
  }
  
  // Update dynasty stats with heirlooms
  updatedDynastyStats.heirlooms = updatedHeirlooms;
  
  // Apply heirloom bonuses to legacy bonuses
  const heirloomBonuses = getHeirloomBonuses(updatedHeirlooms);
  const finalIncomeMultiplier = incomeMultiplier * (1 + heirloomBonuses.incomeBonus / 100);
  const finalLearningMultiplier = learningMultiplier * (1 + heirloomBonuses.learningBonus / 100);
  const finalReputationBonus = reputationBonus + heirloomBonuses.reputationBonus;

  return {
    totalNetWorth: clampedNetWorth,
    realEstateIds,
    companyIds,
    familyBusinessIds,
    cash,
    bankSavings,
    debts,
    generatedMemories,
    legacyBonuses: {
      incomeMultiplier: finalIncomeMultiplier,
      learningMultiplier: finalLearningMultiplier,
      reputationBonus: finalReputationBonus,
    },
    // Dynasty & Heirloom System
    newHeirloom: newHeirloom || undefined,
    updatedHeirlooms,
    updatedDynastyStats,
  };
}
