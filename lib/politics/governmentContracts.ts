/**
 * Government Contracts System
 * 
 * Provides weekly income bonuses to companies based on political office level
 */

import { GameState } from '@/contexts/game/types';

export interface GovernmentContract {
  id: string;
  companyId: string;
  contractType: 'local' | 'state' | 'federal';
  weeklyBonus: number;
  approvalRequired: number; // Minimum approval rating required
  unlockedAt: number; // Office level required
}

/**
 * Calculate government contract bonus for a company
 * @param gameState Current game state
 * @param companyId Company ID
 * @returns Weekly bonus amount from government contracts
 */
export function calculateGovernmentContractBonus(
  gameState: GameState,
  companyId: string
): number {
  const politics = gameState.politics;
  
  // No contracts if not in political office
  if (!politics || politics.careerLevel === 0) {
    return 0;
  }

  // Check approval rating (need at least 60% for contracts)
  if (politics.approvalRating < 60) {
    return 0;
  }

  // Get company
  const company = gameState.companies.find(c => c.id === companyId);
  if (!company) {
    return 0;
  }

  // Calculate base contract bonus based on office level and company income
  const baseIncome = company.weeklyIncome || 0;
  
  // Contract bonuses scale with office level
  const contractMultipliers: Record<number, number> = {
    0: 0, // Council Member - no contracts
    1: 0.10, // Mayor - 10% bonus
    2: 0.20, // State Representative - 20% bonus
    3: 0.35, // Governor - 35% bonus
    4: 0.50, // Senator - 50% bonus
    5: 0.75, // President - 75% bonus
  };

  const multiplier = contractMultipliers[politics.careerLevel] || 0;
  const bonus = Math.round(baseIncome * multiplier);

  // Approval rating affects contract value (higher approval = better contracts)
  const approvalMultiplier = 0.5 + (politics.approvalRating / 100) * 0.5; // 0.5x to 1.0x based on approval
  const finalBonus = Math.round(bonus * approvalMultiplier);

  return finalBonus;
}

/**
 * Get all active government contracts for all companies
 * @param gameState Current game state
 * @returns Total weekly bonus from all government contracts
 */
export function getTotalGovernmentContractBonus(gameState: GameState): number {
  if (!gameState.companies || gameState.companies.length === 0) {
    return 0;
  }

  return gameState.companies.reduce((total, company) => {
    return total + calculateGovernmentContractBonus(gameState, company.id);
  }, 0);
}

/**
 * Check if government contracts are available
 * @param gameState Current game state
 * @returns True if contracts are available
 */
export function areGovernmentContractsAvailable(gameState: GameState): boolean {
  const politics = gameState.politics;
  
  if (!politics || politics.careerLevel === 0) {
    return false;
  }

  // Contracts available at Mayor level (level 1) and above
  return politics.careerLevel >= 1 && politics.approvalRating >= 60;
}

/**
 * Get contract type based on office level
 * @param careerLevel Political career level
 * @returns Contract type
 */
export function getContractType(careerLevel: number): 'local' | 'state' | 'federal' {
  if (careerLevel >= 4) return 'federal'; // Senator and President
  if (careerLevel >= 2) return 'state'; // State Representative and Governor
  return 'local'; // Mayor
}

