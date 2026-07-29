/**
 * Planning-basis net worth — the figure the FIRE tracker and the retirement
 * planner project from.
 *
 * WHY THIS IS NOT `netWorth()` (lib/progress/achievements):
 * the canonical net worth is the player's TOTAL worth (it also counts vehicles
 * and the luxury collection at resale value) and is what prestige, the
 * leaderboard, ambitions, bail cost and the stats screen read. Retirement and
 * FIRE ask a narrower question — "what can fund a 4%-rule withdrawal?" — so they
 * count only income-producing / liquidatable holdings: cash, bank savings,
 * stocks, owned real estate and company value, minus debt. Personal-use goods
 * (cars, trophies) are deliberately excluded: they cost upkeep rather than
 * throwing off income, and counting them would tell a player with a yacht that
 * they can retire on it.
 *
 * The 2026-07-28 weekly audit filed the 5-way net-worth duplication as a LOW
 * consistency smell. The FIRE tracker and the retirement planner carried
 * byte-identical private copies of this function; they now share this ONE
 * implementation with the basis written down, so the divergence from the
 * canonical figure is an explicit, single-sourced choice rather than drift.
 * (`preTick.calculateNetWorth` stays separate on purpose — it is snapshot-locked
 * by `subsystemEquivalence.test.ts`.)
 *
 * Numerically identical to the two copies it replaces.
 */
import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export function calculatePlanningNetWorth(state: GameState): number {
  const money = state.stats?.money || 0;
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
