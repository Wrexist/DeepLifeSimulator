import type { GameState, FamilyBusiness } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

/**
 * Legacy bonus data structure
 */
export interface LegacyBonusData {
  familyWealth: number; // Total wealth passed down through generations
  familyBusinesses: FamilyBusiness[]; // Businesses passed down
  generationalAchievements: string[]; // Achievements unlocked across generations
  bonusMultipliers: {
    startingMoney: number;
    income: number;
    experience: number;
  };
  generationHistory: {
    generation: number;
    netWorth: number;
    ageAtDeath: number;
    achievements: string[];
    businesses: string[];
  }[];
}

/**
 * Calculate legacy bonuses from previous generations
 */
export function calculateLegacyBonuses(state: GameState): LegacyBonusData {
  const previousLives = state.previousLives || [];
  const familyBusinesses = state.familyBusinesses || [];
  const currentGeneration = state.generationNumber || 1;
  
  // Calculate total family wealth (sum of all previous generations' net worth)
  const familyWealth = previousLives.reduce((sum, life) => sum + (life.netWorth || 0), 0);
  
  // Collect all achievements from previous generations
  const generationalAchievements: string[] = [];
  previousLives.forEach(life => {
    if (life.summaryAchievements) {
      generationalAchievements.push(...life.summaryAchievements);
    }
  });
  
  // Calculate bonus multipliers based on legacy
  const startingMoneyMultiplier = 1.0 + (familyWealth / 10_000_000) * 0.1; // 10% per $10M
  const incomeMultiplier = 1.0 + (familyWealth / 50_000_000) * 0.05; // 5% per $50M
  const experienceMultiplier = 1.0 + (previousLives.length * 0.02); // 2% per generation
  
  // Build generation history
  const generationHistory = previousLives.map(life => ({
    generation: life.generation || 0,
    netWorth: life.netWorth || 0,
    ageAtDeath: life.ageAtDeath || 0,
    achievements: life.summaryAchievements || [],
    businesses: [], // Would need to track which businesses were passed down
  }));
  
  return {
    familyWealth,
    familyBusinesses,
    generationalAchievements: [...new Set(generationalAchievements)], // Remove duplicates
    bonusMultipliers: {
      startingMoney: Math.min(startingMoneyMultiplier, 2.0), // Cap at 2x
      income: Math.min(incomeMultiplier, 1.5), // Cap at 1.5x
      experience: Math.min(experienceMultiplier, 1.5), // Cap at 1.5x
    },
    generationHistory,
  };
}

/**
 * Apply legacy bonuses to initial game state
 */
export function applyLegacyBonuses(
  initialState: GameState,
  legacyData: LegacyBonusData
): GameState {
  const updatedState = { ...initialState };
  
  // Apply starting money bonus
  if (legacyData.bonusMultipliers.startingMoney > 1.0) {
    const baseMoney = updatedState.stats.money || 200;
    const bonusMoney = baseMoney * (legacyData.bonusMultipliers.startingMoney - 1.0);
    updatedState.stats = {
      ...updatedState.stats,
      money: baseMoney + bonusMoney,
    };
  }
  
  // Apply family businesses
  if (legacyData.familyBusinesses.length > 0) {
    updatedState.familyBusinesses = legacyData.familyBusinesses.map(business => ({
      ...business,
      generationsHeld: (business.generationsHeld || 0) + 1,
    }));
  }
  
  // Update legacy bonuses in state
  updatedState.legacyBonuses = {
    incomeMultiplier: legacyData.bonusMultipliers.income,
    learningMultiplier: legacyData.bonusMultipliers.experience,
    reputationBonus: legacyData.generationalAchievements.length * 2, // +2 reputation per achievement
  };
  
  return updatedState;
}

/**
 * Calculate legacy wealth to pass down
 */
export function calculateLegacyWealth(state: GameState): number {
  const netWorth = calculateNetWorth(state);
  const legacyBonuses = state.prestige?.unlockedBonuses || [];
  
  // Check if legacy_wealth bonus is unlocked
  const hasLegacyWealthBonus = legacyBonuses.includes('legacy_wealth');
  
  if (hasLegacyWealthBonus) {
    // Pass down 10% of final net worth
    return netWorth * 0.1;
  }
  
  // Default: pass down 5% of final net worth
  return netWorth * 0.05;
}

/**
 * Calculate net worth for legacy purposes
 */
function calculateNetWorth(state: GameState): number {
  const money = state.stats.money || 0;
  const bankSavings = state.bankSavings || 0;
  
  // Stock value
  const stockValue = state.stocks?.holdings?.reduce((sum, holding) => {
    return sum + (holding.shares * holding.currentPrice);
  }, 0) || 0;
  
  // Real estate value
  const realEstateValue = state.realEstate?.reduce((sum, property) => {
    return sum + (property.owned ? property.value : 0);
  }, 0) || 0;
  
  // Company value
  const companyValue = state.companies?.reduce((sum, company) => {
    return sum + (company.owned ? company.value : 0);
  }, 0) || 0;
  
  // Vehicle value
  const vehicleValue = state.vehicles?.reduce((sum, vehicle) => {
    return sum + (vehicle.owned ? vehicle.value : 0);
  }, 0) || 0;
  
  // Subtract debts
  const totalDebt = state.loans?.reduce((sum, loan) => {
    return sum + loan.remainingBalance;
  }, 0) || 0;
  
  return money + bankSavings + stockValue + realEstateValue + companyValue + vehicleValue - totalDebt;
}

/**
 * Prepare family businesses for next generation
 */
export function prepareFamilyBusinessesForLegacy(state: GameState): FamilyBusiness[] {
  const companies = state.companies || [];
  const currentGeneration = state.generationNumber || 1;
  
  return companies
    .filter(company => company.owned)
    .map(company => ({
      companyId: company.id,
      foundedGeneration: currentGeneration,
      generationsHeld: 1,
      brandValue: company.value || 0,
      // Additional business data could be stored here
    }));
}

/**
 * Get legacy bonus description for UI
 */
export function getLegacyBonusDescription(legacyData: LegacyBonusData): string {
  const parts: string[] = [];
  
  if (legacyData.bonusMultipliers.startingMoney > 1.0) {
    const percent = Math.round((legacyData.bonusMultipliers.startingMoney - 1.0) * 100);
    parts.push(`+${percent}% starting money`);
  }
  
  if (legacyData.bonusMultipliers.income > 1.0) {
    const percent = Math.round((legacyData.bonusMultipliers.income - 1.0) * 100);
    parts.push(`+${percent}% income`);
  }
  
  if (legacyData.bonusMultipliers.experience > 1.0) {
    const percent = Math.round((legacyData.bonusMultipliers.experience - 1.0) * 100);
    parts.push(`+${percent}% experience`);
  }
  
  if (legacyData.familyBusinesses.length > 0) {
    parts.push(`${legacyData.familyBusinesses.length} family business${legacyData.familyBusinesses.length > 1 ? 'es' : ''}`);
  }
  
  if (legacyData.generationalAchievements.length > 0) {
    parts.push(`${legacyData.generationalAchievements.length} generational achievement${legacyData.generationalAchievements.length > 1 ? 's' : ''}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No legacy bonuses';
}

/**
 * Check if legacy bonuses should be applied
 */
export function shouldApplyLegacyBonuses(state: GameState): boolean {
  // Apply if this is not the first generation
  return (state.generationNumber || 1) > 1;
}

