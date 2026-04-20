import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/**
 * FIRE (Financial Independence, Retire Early) tracking result
 */
export interface FIRETrackerResult {
  fireNumber: number; // 25x annual expenses
  currentNetWorth: number;
  progressToFIRE: number; // Percentage
  yearsToFIRE: number;
  savingsRate: number; // Percentage of income saved
  coastFIRE: number; // Coast FIRE number
  coastFIREProgress: number; // Percentage to Coast FIRE
  milestones: {
    leanFIRE: number;
    regularFIRE: number;
    fatFIRE: number;
    achieved: boolean;
  };
}

/**
 * Calculate FIRE tracking
 */
export function calculateFIRETracker(state: GameState): FIRETrackerResult {
  // Calculate annual expenses
  const weeklyIncome = state.job?.weeklySalary || 0;
  const estimatedAnnualExpenses = weeklyIncome * 0.7 * WEEKS_PER_YEAR; // Assume 70% of income is expenses
  
  // FIRE number (25x annual expenses - 4% rule)
  const fireNumber = estimatedAnnualExpenses * 25;
  
  // Calculate current net worth
  const currentNetWorth = calculateNetWorth(state);
  
  // Progress to FIRE
  const progressToFIRE = Math.min(100, (currentNetWorth / fireNumber) * 100);
  
  // Calculate savings rate
  const weeklySavings = (state.bankSavings || 0) / Math.max(1, state.weeksLived || 1);
  const savingsRate = weeklyIncome > 0 
    ? (weeklySavings / weeklyIncome) * 100 
    : 0;
  
  // Estimate years to FIRE (simplified calculation)
  const savingsGap = fireNumber - currentNetWorth;
  const annualSavings = weeklySavings * WEEKS_PER_YEAR;
  const yearsToFIRE = annualSavings > 0 && savingsGap > 0
    ? savingsGap / annualSavings
    : Infinity;
  
  // Coast FIRE (enough saved to coast to retirement without additional savings)
  const coastFIRE = estimatedAnnualExpenses * 12.5; // Simplified
  const coastFIREProgress = Math.min(100, (currentNetWorth / coastFIRE) * 100);
  
  // FIRE milestones
  const leanFIRE = estimatedAnnualExpenses * 0.7 * 25; // 70% expenses
  const regularFIRE = fireNumber;
  const fatFIRE = estimatedAnnualExpenses * 1.5 * 25; // 150% expenses
  
  const achieved = currentNetWorth >= fireNumber;
  
  return {
    fireNumber,
    currentNetWorth,
    progressToFIRE,
    yearsToFIRE: yearsToFIRE === Infinity ? 999 : Math.round(yearsToFIRE),
    savingsRate,
    coastFIRE,
    coastFIREProgress,
    milestones: {
      leanFIRE,
      regularFIRE,
      fatFIRE,
      achieved,
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

