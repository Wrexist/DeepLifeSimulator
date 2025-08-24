import { GameState } from '@/contexts/GameContext';
import { getUpgradeTier } from '@/lib/realEstate/housing';

export interface ExpenseBreakdown {
  upkeep: number;
  loans: number;
}

interface LoanLike {
  weeklyPayment: number;
}

export function calcWeeklyExpenses(
  state: GameState & { loans?: LoanLike[] }
): { total: number; breakdown: ExpenseBreakdown } {
  const upkeep = state.realEstate.reduce((sum, p) => {
    const tier = getUpgradeTier(p.upgradeLevel) || getUpgradeTier(0)!;
    return sum + (p.upkeep ?? 0) + tier.upkeepBonus;
  }, 0);
  const loans = state.loans ?? [];
  const loanPayments = loans.reduce((sum, l) => sum + l.weeklyPayment, 0);
  const total = upkeep + loanPayments;
  return { total, breakdown: { upkeep, loans: loanPayments } };
}

export type { LoanLike as LoanLikeType };
