import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
// Shared planning basis (income-producing / liquidatable assets only) — see
// planningNetWorth.ts for why this is deliberately NOT the canonical netWorth().
import { calculatePlanningNetWorth as calculateNetWorth } from './planningNetWorth';

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
  const career = state.careers?.find(c => c.id === state.currentJob);
  // `careers[].levels[].salary` is canonically WEEKLY (paid per week by
  // applyCareerSalaryAndPenalty). Dividing by WEEKS_PER_YEAR here treated it as
  // annual, shrinking weeklyIncome ~52× so requiredNetWorth collapsed and nearly
  // everyone read "On track". Use the salary directly as the weekly figure.
  const weeklyIncome = career?.levels?.[career.level]?.salary || 0;
  const estimatedAnnualExpenses = weeklyIncome * 0.7 * WEEKS_PER_YEAR; // Assume 70% of income is expenses

  // BUGFIX: caller-supplied withdrawalRate of 0 produces Infinity → propagates
  // through savingsGap and monthlySavingsNeeded.
  const safeWithdrawalRate = withdrawalRate > 0 ? withdrawalRate : 4;
  const requiredNetWorth = (estimatedAnnualExpenses / safeWithdrawalRate) * 100;
  
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


