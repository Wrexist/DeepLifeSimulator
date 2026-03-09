import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/**
 * Retirement planning result
 */
export interface RetirementPlanningResult {
  targetRetirementAge: number;
  currentAge: number;
  yearsToRetirement: number;
  requiredNetWorth: number;
  currentNetWorth: number;
  savingsGap: number;
  projectedRetirementDate: number; // Year
  monthlySavingsNeeded: number;
  assumptions: {
    expectedReturnRate: number; // Annual return %
    inflationRate: number; // Annual inflation %
    withdrawalRate: number; // 4% rule
  };
}

/**
 * Calculate retirement planning
 */
export function calculateRetirementPlanning(
  state: GameState,
  targetRetirementAge: number = 65,
  expectedReturnRate: number = 7,
  inflationRate: number = 3,
  withdrawalRate: number = 4
): RetirementPlanningResult {
  const currentAge = state.date?.age || 18;
  const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);
  
  // Calculate current net worth
  const currentNetWorth = calculateNetWorth(state);
  
  // Estimate annual expenses (simplified: use current weekly expenses * WEEKS_PER_YEAR)
  const weeklyIncome = state.job?.weeklySalary || 0;
  const estimatedAnnualExpenses = weeklyIncome * 0.7 * WEEKS_PER_YEAR; // Assume 70% of income is expenses
  
  // Calculate required net worth using 4% rule
  const requiredNetWorth = (estimatedAnnualExpenses / withdrawalRate) * 100;
  
  // Calculate savings gap
  const savingsGap = Math.max(0, requiredNetWorth - currentNetWorth);
  
  // Project retirement date
  const currentYear = state.date?.year || 2025;
  const projectedRetirementDate = currentYear + yearsToRetirement;
  
  // Calculate monthly savings needed (simplified)
  const monthlySavingsNeeded = yearsToRetirement > 0 
    ? savingsGap / (yearsToRetirement * 12)
    : 0;
  
  return {
    targetRetirementAge,
    currentAge,
    yearsToRetirement,
    requiredNetWorth,
    currentNetWorth,
    savingsGap,
    projectedRetirementDate,
    monthlySavingsNeeded,
    assumptions: {
      expectedReturnRate,
      inflationRate,
      withdrawalRate,
    },
  };
}

/**
 * Calculate net worth
 */
function calculateNetWorth(state: GameState): number {
  const money = state.stats.money || 0;
  const bankSavings = state.bankSavings || 0;
  
  const stockValue = state.stocks?.holdings?.reduce((sum, holding) => {
    return sum + (holding.shares * holding.currentPrice);
  }, 0) || 0;
  
  const realEstateValue = state.realEstate?.reduce((sum, property) => {
    return sum + (property.owned ? property.value : 0);
  }, 0) || 0;
  
  // D-2: NaN guard on company valuation
  const companyValue = state.companies?.reduce((sum, company) => {
    const val = company.owned ? (company.value || 0) : 0;
    return sum + (isFinite(val) ? val : 0);
  }, 0) || 0;

  const totalDebt = state.loans?.reduce((sum, loan) => {
    const bal = loan.remainingBalance || 0;
    return sum + (isFinite(bal) ? bal : 0);
  }, 0) || 0;

  const result = money + bankSavings + stockValue + realEstateValue + companyValue - totalDebt;
  return isFinite(result) ? result : 0;
}

