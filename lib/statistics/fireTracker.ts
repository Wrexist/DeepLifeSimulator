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
  const career = state.careers?.find(c => c.id === state.currentJob);
  const annualSalary = career?.levels?.[career.level]?.salary || 0;
  const weeklyIncome = annualSalary / WEEKS_PER_YEAR;
  // Even with no salary the player still has living expenses, so floor the
  // estimate. Without this an unemployed/retired/student player had
  // estimatedAnnualExpenses = 0 → fireNumber = 0 → progressToFIRE =
  // netWorth / 0 (NaN or a false 100%) and achieved = netWorth >= 0 (true for
  // anyone non-negative).
  const MIN_ANNUAL_EXPENSES = 15600; // ~$300/week baseline cost of living
  const estimatedAnnualExpenses = Math.max(
    MIN_ANNUAL_EXPENSES,
    weeklyIncome * 0.7 * WEEKS_PER_YEAR
  ); // Assume 70% of income is expenses, floored at a baseline

  // FIRE number (25x annual expenses - 4% rule)
  const fireNumber = estimatedAnnualExpenses * 25;

  // Calculate current net worth
  const currentNetWorth = calculateNetWorth(state);
  const achieved = currentNetWorth >= fireNumber;

  // Progress to FIRE (fireNumber is always > 0 thanks to the expense floor)
  const progressToFIRE = Math.max(0, Math.min(100, (currentNetWorth / fireNumber) * 100));

  // Calculate savings rate
  const weeklySavings = (state.bankSavings || 0) / Math.max(1, state.weeksLived || 1);
  const savingsRate = weeklyIncome > 0
    ? (weeklySavings / weeklyIncome) * 100
    : 0;

  // Estimate years to FIRE (simplified calculation)
  const savingsGap = fireNumber - currentNetWorth;
  const annualSavings = weeklySavings * WEEKS_PER_YEAR;
  const yearsToFIRE = achieved
    ? 0
    : annualSavings > 0 && savingsGap > 0
      ? savingsGap / annualSavings
      : Infinity;

  // Coast FIRE (enough saved to coast to retirement without additional savings)
  const coastFIRE = estimatedAnnualExpenses * 12.5; // Simplified
  const coastFIREProgress = Math.max(0, Math.min(100, (currentNetWorth / coastFIRE) * 100));

  // FIRE milestones
  const leanFIRE = estimatedAnnualExpenses * 0.7 * 25; // 70% expenses
  const regularFIRE = fireNumber;
  const fatFIRE = estimatedAnnualExpenses * 1.5 * 25; // 150% expenses
  
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
    return sum + (property.owned ? (property.currentValue ?? property.price) : 0);
  }, 0) || 0;

  // D-2: NaN guard on company valuation (annual income, per codebase convention)
  const companyValue = state.companies?.reduce((sum, company) => {
    const val = (company.weeklyIncome || 0) * WEEKS_PER_YEAR;
    return sum + (isFinite(val) ? val : 0);
  }, 0) || 0;

  const totalDebt = state.loans?.reduce((sum, loan) => {
    const bal = loan.remaining || 0;
    return sum + (isFinite(bal) ? bal : 0);
  }, 0) || 0;

  const result = money + bankSavings + stockValue + realEstateValue + companyValue - totalDebt;
  return isFinite(result) ? result : 0;
}

