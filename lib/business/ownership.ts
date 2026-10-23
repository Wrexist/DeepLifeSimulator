import type { GameState } from '@/contexts/game/types';

/**
 * The fraction of a company the player still owns: 1 while private, the kept
 * share after an IPO. Malformed values read as 1, so a corrupt overlay can
 * never zero a company's income or value.
 *
 * A leaf module on purpose: both `lib/economy/passiveIncome` (income) and
 * `lib/progress/achievements` (`netWorth`, value) read it, and passiveIncome
 * already imports achievements, so the helper cannot live in either without
 * closing an import cycle.
 */
export function companyOwnerShare(state: Pick<GameState, 'hustleApp'>, companyId: string): number {
  const ipo = state.hustleApp?.companies?.[companyId]?.ipo;
  if (!ipo || ipo.status !== 'public') return 1;
  const pct = ipo.ownershipPercent;
  return typeof pct === 'number' && isFinite(pct) && pct > 0 && pct <= 100 ? pct / 100 : 1;
}
