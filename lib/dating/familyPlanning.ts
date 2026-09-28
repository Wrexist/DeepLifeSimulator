import type { GameState } from '@/contexts/game/types';

/** Shared eligibility for the Family screen and the atomic conception update.
 * The cash threshold is a reserve requirement; birth charges remain in the weekly loop.
 */
export function familyPlanningBlock(state: GameState, partnerId: string): string | null {
  const partner = state.relationships?.find(r => r.id === partnerId
    && (r.type === 'partner' || r.type === 'spouse'));
  if (state.showDeathPopup) return 'You have died.';
  if (!partner) return 'You need a partner or spouse to start a family.';
  if (state.date.age < 18) return 'You must be at least 18 to start a family.';
  if (partner.isPregnant) return 'Already expecting. Wait for the baby to arrive.';
  if (partner.relationshipScore < 70) return `Needs 70% bond - you are at ${partner.relationshipScore}%.`;
  if (partner.type !== 'spouse' && partner.engagementWeek == null && !partner.livingTogether) {
    return 'Move in together or get engaged first.';
  }
  const births = (state.family?.children ?? []).map(c => c.birthWeeksLived)
    .filter((week): week is number => typeof week === 'number' && Number.isFinite(week));
  if (births.length) {
    const remaining = 40 - (state.weeksLived - Math.max(...births));
    if (remaining > 0) return `Wait ${remaining} more weeks before trying for another child.`;
  }
  if (!Number.isFinite(state.stats.money) || state.stats.money < 5000) {
    return 'Keep at least $5,000 in cash before trying for a baby.';
  }
  return null;
}
