/**
 * Divorce Lawyer System
 * 
 * Three tiers of lawyers with different success rates and costs
 */

export interface DivorceLawyer {
  id: string;
  name: string;
  tier: 'budget' | 'standard' | 'premium';
  baseCost: number; // Base cost (used for minimum)
  costPercentOfSettlement: number; // Percentage of settlement as cost
  successRate: number; // 0-1, chance of success
  minReduction: number; // Minimum settlement reduction % (0-1)
  maxReduction: number; // Maximum settlement reduction % (0-1)
  description: string;
  tagline: string;
}

/**
 * Calculate dynamic lawyer cost based on settlement amount
 * Scales with settlement to ensure meaningful costs and savings
 */
export function calculateLawyerCost(lawyer: DivorceLawyer, settlement: number): number {
  // Cost is either base cost OR percentage of settlement, whichever is higher
  // This ensures:
  // - Small settlements: lawyer costs are reasonable (base cost)
  // - Large settlements: lawyer costs scale appropriately (percentage)
  const percentageCost = settlement * lawyer.costPercentOfSettlement;
  return Math.max(lawyer.baseCost, Math.floor(percentageCost));
}

export const DIVORCE_LAWYERS: DivorceLawyer[] = [
  {
    id: 'budget',
    name: 'John "Quick Deal" Smith',
    tier: 'budget',
    baseCost: 5000, // Minimum cost
    costPercentOfSettlement: 0.05, // 5% of settlement (scales with settlement)
    successRate: 0.30, // 30% chance
    minReduction: 0.20, // 20% reduction
    maxReduction: 0.40, // 40% reduction
    description: 'A budget-friendly lawyer who handles simple cases. Not the most experienced, but gets the job done... sometimes.',
    tagline: 'Affordable, but results may vary',
  },
  {
    id: 'standard',
    name: 'Sarah "Fair Fight" Johnson',
    tier: 'standard',
    baseCost: 15000, // Minimum cost
    costPercentOfSettlement: 0.10, // 10% of settlement (scales with settlement)
    successRate: 0.60, // 60% chance
    minReduction: 0.30, // 30% reduction
    maxReduction: 0.50, // 50% reduction
    description: 'A reliable lawyer with good track record. Professional and experienced in divorce cases.',
    tagline: 'Solid choice for most cases',
  },
  {
    id: 'premium',
    name: 'Robert "Shark" Williams',
    tier: 'premium',
    baseCost: 50000, // Minimum cost
    costPercentOfSettlement: 0.20, // 20% of settlement (scales with settlement)
    successRate: 0.85, // 85% chance
    minReduction: 0.40, // 40% reduction
    maxReduction: 0.70, // 70% reduction
    description: 'Top-tier divorce attorney with an impressive win rate. Known for aggressive tactics and getting the best deals for clients.',
    tagline: 'The best money can buy',
  },
];

/**
 * Calculate potential settlement reduction with a lawyer
 */
export function calculateLawyerOutcome(
  baseSettlement: number,
  lawyer: DivorceLawyer,
  rolls?: {
    successRoll?: number;
    reductionRoll?: number;
  }
): {
  success: boolean;
  reducedSettlement: number;
  reduction: number;
  reductionPercent: number;
  savings: number;
  lawyerCost: number;
} {
  // Calculate dynamic cost based on settlement
  const lawyerCost = calculateLawyerCost(lawyer, baseSettlement);
  
  const normalizedSuccessRoll = typeof rolls?.successRoll === 'number' && isFinite(rolls.successRoll)
    ? Math.max(0, Math.min(1, rolls.successRoll))
    : Math.random();
  const success = normalizedSuccessRoll < lawyer.successRate;
  
  if (!success) {
    // Lawyer failed - no reduction
    return {
      success: false,
      reducedSettlement: baseSettlement,
      reduction: 0,
      reductionPercent: 0,
      savings: -lawyerCost, // You still pay the lawyer even if they fail
      lawyerCost,
    };
  }
  
  // Calculate reduction percentage
  const normalizedReductionRoll = typeof rolls?.reductionRoll === 'number' && isFinite(rolls.reductionRoll)
    ? Math.max(0, Math.min(1, rolls.reductionRoll))
    : Math.random();
  const reductionPercent = lawyer.minReduction + 
    (normalizedReductionRoll * (lawyer.maxReduction - lawyer.minReduction));
  
  const reduction = baseSettlement * reductionPercent;
  const reducedSettlement = Math.max(0, baseSettlement - reduction);
  const savings = reduction - lawyerCost; // Net savings after lawyer cost
  
  return {
    success: true,
    reducedSettlement,
    reduction,
    reductionPercent: reductionPercent * 100,
    savings,
    lawyerCost,
  };
}

/**
 * Get expected value (average outcome) for a lawyer
 */
export function getLawyerExpectedValue(
  baseSettlement: number,
  lawyer: DivorceLawyer
): {
  expectedReduction: number;
  expectedSavings: number;
  expectedSettlement: number;
  roi: number; // Return on investment
  lawyerCost: number;
} {
  // Calculate dynamic cost based on settlement
  const lawyerCost = calculateLawyerCost(lawyer, baseSettlement);
  
  const avgReductionPercent = (lawyer.minReduction + lawyer.maxReduction) / 2;
  const expectedReduction = baseSettlement * avgReductionPercent * lawyer.successRate;
  const expectedSettlement = baseSettlement - expectedReduction;
  // Expected savings accounts for success rate (you pay lawyer even if they fail)
  const expectedSavings = expectedReduction - lawyerCost;
  const roi = lawyerCost > 0 ? (expectedSavings / lawyerCost) * 100 : 0;
  
  return {
    expectedReduction,
    expectedSavings,
    expectedSettlement,
    roi,
    lawyerCost,
  };
}

