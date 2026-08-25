import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
// Shared planning basis (income-producing / liquidatable assets only) — see
// planningNetWorth.ts for why this is deliberately NOT the canonical netWorth().
import { calculatePlanningNetWorth as calculateNetWorth } from './planningNetWorth';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';

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
  // `careers[].levels[].salary` is canonically WEEKLY (paid per week by
  // applyCareerSalaryAndPenalty). Earlier this was divided by WEEKS_PER_YEAR as
  // if annual, making weeklyIncome ~52× too small — expenses collapsed to the
  // MIN floor, fireNumber pinned near $390k for everyone, and savingsRate
  // rendered absurdly (500-1000%+). Treat the salary as the weekly figure.
  const weeklyIncome = career?.levels?.[career.level]?.salary || 0;
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
    ? Math.max(0, Math.min(100, (weeklySavings / weeklyIncome) * 100))
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



// ---------------------------------------------------------------------------
// Financial independence, as a MECHANICAL fact rather than a stats readout
// ---------------------------------------------------------------------------

/**
 * The weekly floor a life has to cost before "my assets cover it" means
 * anything.
 *
 * Reuses this file's OWN baseline cost of living (`MIN_ANNUAL_EXPENSES`, the
 * floor `calculateFIRETracker` already applies) rather than inventing a second
 * number. Without a floor, a character with no rent and no job is "financially
 * independent" on $1/week of passive income - the milestone has to mean a life
 * is being paid for, not that nothing is.
 */
export const FI_MINIMUM_WEEKLY_COST = Math.round(15_600 / WEEKS_PER_YEAR);

export interface FinancialIndependence {
  /** Weekly passive income, the same projection the Cash Flow card shows. */
  passiveWeekly: number;
  /** Weekly cost of the life, INCLUDING the tax owed on that passive income. */
  expensesWeekly: number;
  /** Passive income covers the whole life. */
  achieved: boolean;
  /** 0..1 - how close the assets are to covering the life. */
  progress: number;
}

/**
 * Does this life pay for itself?
 *
 * The question the money axis is actually about, and until now the game
 * computed it (`calculateFIRETracker`) and did nothing with it: one stats
 * screen and the age-45 early-retirement gate, no achievement, no goal, no
 * moment. This is the mechanical version - not the 25x rule of thumb, but the
 * literal test a player can watch converge on the Cash Flow card.
 *
 * Both sides come from the canonical helpers the rest of the app displays, so
 * what the player sees on that card is what this measures. Tax is charged on
 * the passive income before the comparison, because the tick charges it too -
 * declaring independence on a pre-tax figure would fire early and be a lie the
 * next paycheck contradicts.
 */
export function financialIndependence(state: GameState): FinancialIndependence {
  // Local requires would degrade these to `any`; both are pure lib modules.
  const passive = calcWeeklyPassiveIncome(state);
  const passiveWeekly = Math.max(0, Math.round(passive?.total ?? 0));
  const expenses = calcWeeklyExpenses(state, passiveWeekly);
  const rawExpenses = Math.max(0, Math.round(expenses?.total ?? 0));
  const expensesWeekly = Math.max(FI_MINIMUM_WEEKLY_COST, rawExpenses);
  const achieved = passiveWeekly > 0 && passiveWeekly >= expensesWeekly;
  const progress = expensesWeekly > 0
    ? Math.max(0, Math.min(1, passiveWeekly / expensesWeekly))
    : 0;
  return { passiveWeekly, expensesWeekly, achieved, progress };
}
