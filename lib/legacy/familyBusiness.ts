import { Company } from '@/contexts/game/types';

export interface FamilyBusinessData {
  companyId: string;
  foundedGeneration: number;
  generationsHeld: number;
  brandValue: number; // Extra multiplier for income
  reputation: number;
}

export class FamilyBusinessSystem {
  /**
   * Calculate bonus multiplier for a family business
   */
  static calculateBonus(generationsHeld: number): number {
    // +10% per generation held, max +100%
    return 1 + Math.min(1, generationsHeld * 0.1);
  }

  /**
   * Apply family business bonuses to a company
   */
  static applyLegacyBonuses(company: Company, generationsHeld: number): Company {
    const bonusMultiplier = this.calculateBonus(generationsHeld);
    
    return {
      ...company,
      weeklyIncome: Math.round(company.weeklyIncome * bonusMultiplier),
      baseWeeklyIncome: Math.round(company.baseWeeklyIncome * bonusMultiplier),
      marketingLevel: Math.min(10, company.marketingLevel + Math.floor(generationsHeld / 2)),
    };
  }
  
  /**
   * Determine if a company qualifies as a family business
   */
  static isFamilyBusiness(generationsHeld: number): boolean {
    return generationsHeld >= 1;
  }
}

