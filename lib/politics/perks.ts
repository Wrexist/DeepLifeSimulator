/**
 * Political Perks System
 * 
 * Benefits and bonuses unlocked by holding political office
 */

export interface PoliticalPerk {
  id: string;
  name: string;
  description: string;
  requiredLevel: number; // Office level required (0-5)
  effects: {
    loanInterestReduction?: number; // Percentage reduction (0-100)
    businessIncomeBonus?: number; // Percentage bonus (0-100)
    realEstateTaxBreak?: number; // Percentage reduction in upkeep (0-100)
    socialMediaFollowerBonus?: number; // Percentage bonus to followers (0-100)
    unlockExclusiveOpportunities?: boolean; // Unlocks special features
    governmentContracts?: boolean; // Enables government contracts for companies
  };
}

export const POLITICAL_PERKS: PoliticalPerk[] = [
  // Council Member (Level 0) Perks
  {
    id: 'local_connections',
    name: 'Local Connections',
    description: 'Your local political connections help you in business.',
    requiredLevel: 0,
    effects: {
      loanInterestReduction: 2, // 2% reduction
      businessIncomeBonus: 5, // 5% bonus
    },
  },
  {
    id: 'local_media_boost',
    name: 'Local Media Attention',
    description: 'Local media coverage increases your social presence.',
    requiredLevel: 0,
    effects: {
      socialMediaFollowerBonus: 10, // 10% bonus
    },
  },

  // Mayor (Level 1) Perks
  {
    id: 'mayor_business_boost',
    name: 'Mayoral Business Support',
    description: 'As mayor, you can support local businesses more effectively.',
    requiredLevel: 1,
    effects: {
      loanInterestReduction: 5, // 5% reduction
      businessIncomeBonus: 15, // 15% bonus
      realEstateTaxBreak: 10, // 10% reduction in property upkeep
    },
  },
  {
    id: 'mayor_media',
    name: 'City-Wide Recognition',
    description: 'City-wide recognition boosts your social media following.',
    requiredLevel: 1,
    effects: {
      socialMediaFollowerBonus: 25, // 25% bonus
    },
  },
  {
    id: 'government_contracts_tier1',
    name: 'Local Government Contracts',
    description: 'Unlock access to local government contracts for your companies.',
    requiredLevel: 1,
    effects: {
      governmentContracts: true,
      unlockExclusiveOpportunities: true,
    },
  },

  // State Representative (Level 2) Perks
  {
    id: 'state_business_boost',
    name: 'State Business Influence',
    description: 'State-level influence provides significant business advantages.',
    requiredLevel: 2,
    effects: {
      loanInterestReduction: 8, // 8% reduction
      businessIncomeBonus: 25, // 25% bonus
      realEstateTaxBreak: 15, // 15% reduction
    },
  },
  {
    id: 'state_media',
    name: 'State-Wide Recognition',
    description: 'State-wide recognition significantly boosts your social presence.',
    requiredLevel: 2,
    effects: {
      socialMediaFollowerBonus: 50, // 50% bonus
    },
  },
  {
    id: 'government_contracts_tier2',
    name: 'State Government Contracts',
    description: 'Access to state-level government contracts for your companies.',
    requiredLevel: 2,
    effects: {
      governmentContracts: true,
    },
  },

  // Governor (Level 3) Perks
  {
    id: 'governor_business_boost',
    name: 'Gubernatorial Business Power',
    description: 'Governor-level influence provides major business advantages.',
    requiredLevel: 3,
    effects: {
      loanInterestReduction: 12, // 12% reduction
      businessIncomeBonus: 40, // 40% bonus
      realEstateTaxBreak: 25, // 25% reduction
    },
  },
  {
    id: 'governor_media',
    name: 'National Recognition',
    description: 'Governor status provides national media attention.',
    requiredLevel: 3,
    effects: {
      socialMediaFollowerBonus: 75, // 75% bonus
    },
  },
  {
    id: 'government_contracts_tier3',
    name: 'State Government Contracts (Enhanced)',
    description: 'Enhanced access to lucrative state government contracts.',
    requiredLevel: 3,
    effects: {
      governmentContracts: true,
    },
  },
  {
    id: 'governor_exclusive',
    name: 'Exclusive Opportunities',
    description: 'Unlock exclusive investment and business opportunities.',
    requiredLevel: 3,
    effects: {
      unlockExclusiveOpportunities: true,
    },
  },

  // Senator (Level 4) Perks
  {
    id: 'senator_business_boost',
    name: 'Senatorial Business Influence',
    description: 'Senate-level influence provides exceptional business advantages.',
    requiredLevel: 4,
    effects: {
      loanInterestReduction: 15, // 15% reduction
      businessIncomeBonus: 60, // 60% bonus
      realEstateTaxBreak: 35, // 35% reduction
    },
  },
  {
    id: 'senator_media',
    name: 'National Media Presence',
    description: 'Senator status provides massive national media attention.',
    requiredLevel: 4,
    effects: {
      socialMediaFollowerBonus: 100, // 100% bonus (doubles followers)
    },
  },
  {
    id: 'government_contracts_tier4',
    name: 'Federal Government Contracts',
    description: 'Access to federal government contracts for your companies.',
    requiredLevel: 4,
    effects: {
      governmentContracts: true,
    },
  },
  {
    id: 'senator_exclusive',
    name: 'Premium Exclusive Opportunities',
    description: 'Unlock premium exclusive investment and business opportunities.',
    requiredLevel: 4,
    effects: {
      unlockExclusiveOpportunities: true,
    },
  },

  // President (Level 5) Perks
  {
    id: 'president_business_boost',
    name: 'Presidential Business Power',
    description: 'Presidential influence provides maximum business advantages.',
    requiredLevel: 5,
    effects: {
      loanInterestReduction: 20, // 20% reduction
      businessIncomeBonus: 100, // 100% bonus (doubles income)
      realEstateTaxBreak: 50, // 50% reduction
    },
  },
  {
    id: 'president_media',
    name: 'Global Recognition',
    description: 'Presidential status provides global media attention.',
    requiredLevel: 5,
    effects: {
      socialMediaFollowerBonus: 200, // 200% bonus (triples followers)
    },
  },
  {
    id: 'government_contracts_tier5',
    name: 'Presidential Government Contracts',
    description: 'Access to the most lucrative federal government contracts.',
    requiredLevel: 5,
    effects: {
      governmentContracts: true,
    },
  },
  {
    id: 'president_exclusive',
    name: 'Ultimate Exclusive Opportunities',
    description: 'Unlock the ultimate exclusive investment and business opportunities.',
    requiredLevel: 5,
    effects: {
      unlockExclusiveOpportunities: true,
    },
  },
];

/**
 * Get all active perks for a given political career level
 * @param careerLevel Political career level (0-5)
 * @returns Array of active perks
 */
export function getActivePerks(careerLevel: number): PoliticalPerk[] {
  return POLITICAL_PERKS.filter(perk => perk.requiredLevel <= careerLevel);
}

/**
 * Get combined perk effects for a given career level
 * @param careerLevel Political career level (0-5)
 * @returns Combined effects object
 */
export function getCombinedPerkEffects(careerLevel: number): {
  loanInterestReduction: number;
  businessIncomeBonus: number;
  realEstateTaxBreak: number;
  socialMediaFollowerBonus: number;
  unlockExclusiveOpportunities: boolean;
  governmentContracts: boolean;
} {
  const activePerks = getActivePerks(careerLevel);
  
  return {
    loanInterestReduction: activePerks.reduce((sum, perk) => sum + (perk.effects.loanInterestReduction || 0), 0),
    businessIncomeBonus: activePerks.reduce((sum, perk) => sum + (perk.effects.businessIncomeBonus || 0), 0),
    realEstateTaxBreak: activePerks.reduce((sum, perk) => sum + (perk.effects.realEstateTaxBreak || 0), 0),
    socialMediaFollowerBonus: activePerks.reduce((sum, perk) => sum + (perk.effects.socialMediaFollowerBonus || 0), 0),
    unlockExclusiveOpportunities: activePerks.some(perk => perk.effects.unlockExclusiveOpportunities === true),
    governmentContracts: activePerks.some(perk => perk.effects.governmentContracts === true),
  };
}

/**
 * Get perk by ID
 * @param perkId Perk ID
 * @returns Perk or undefined
 */
export function getPerkById(perkId: string): PoliticalPerk | undefined {
  return POLITICAL_PERKS.find(p => p.id === perkId);
}

