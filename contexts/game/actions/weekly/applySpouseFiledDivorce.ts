/**
 * A neglected spouse files for divorce (SOC-4).
 *
 * ## Why this exists
 *
 * The weekly low-score roll in `applyRelationshipHealth` used to treat a
 * spouse exactly like a dating partner: up to 40% a week below a score of 30,
 * the record was deleted and the player took -25 happiness. No settlement, no
 * lawyer fee, no divorce cooldown. `fileDivorce` charges 15-35% of net worth
 * plus $5,000, so a wealthy player could let a marriage rot instead of filing
 * and keep millions - and a married player got an unannounced "Relationship
 * Ended" with no divorce in it at all.
 *
 * A marriage now ends only through divorce. When the spouse leaves, THEY file,
 * and the player owes what a divorce costs.
 *
 * ## What is reused, and what is not
 *
 * The TERMS are `fileDivorce`'s own: `calculateDivorceCosts` (the same
 * net-worth basis, the same per-spouse 15-35% settlement, the same $5,000
 * lawyer fee) - one formula, so filing and being filed on can never price a
 * marriage differently.
 *
 * The PAYMENT is the week loop's: cash first, and whatever cash cannot cover is
 * booked as arrears through `chargeOrDefer`, the one "you cannot pay this" rule
 * every mandatory weekly cost uses. `fileDivorce` instead force-sells stocks
 * and property and opens a settlement loan; doing that inside the tick would
 * mean liquidating a portfolio the player never chose to sell, in a week they
 * did not act. Arrears are settled first out of future income and carry a
 * credit drag, so the debt is real and is paid.
 */

import type { GameState, Relationship } from '@/contexts/game/types';
import { DIVORCE_LAWYER_BASE_FEE } from '@/lib/config/gameConstants';
import { formatMoney } from '@/utils/moneyFormatting';
import { calculateDivorceCosts } from '../DatingActions';
import { chargeOrDefer } from './chargeOrDefer';
import type { WeekContext } from './weekContext';

/** Reputation lost when a spouse files - what a player-filed divorce costs too. */
export const SPOUSE_FILED_REPUTATION_PENALTY = -10;

export interface SpouseFiledDivorceResult {
  /** Settlement + lawyer fee. */
  owed: number;
  /** Taken from cash this week. */
  paid: number;
  /** Booked as arrears (`overdueBalance`). */
  deferred: number;
}

/**
 * Charge the divorce a spouse filed. `state` is the tick's PREVIOUS state, in
 * which `spouse` is still married to the player (the settlement is computed
 * against it). Mutates `ctx.newStats` and `ctx.deferredCharges` like every
 * other weekly charge, and posts the divorce notification.
 */
export function settleSpouseFiledDivorce(
  state: GameState,
  spouse: Pick<Relationship, 'id' | 'name'>,
  ctx: WeekContext,
): SpouseFiledDivorceResult {
  const terms = calculateDivorceCosts(state, spouse.id);
  const owedRaw = terms ? terms.totalCost : DIVORCE_LAWYER_BASE_FEE;
  const owed = Number.isFinite(owedRaw) && owedRaw > 0 ? Math.round(owedRaw) : DIVORCE_LAWYER_BASE_FEE;
  const { paid, deferred } = chargeOrDefer(ctx, owed);

  const reputation = typeof ctx.newStats.reputation === 'number' && Number.isFinite(ctx.newStats.reputation)
    ? ctx.newStats.reputation
    : 0;
  ctx.newStats.reputation = Math.max(0, Math.min(100, reputation + SPOUSE_FILED_REPUTATION_PENALTY));

  const settlementLine = deferred > 0
    ? `The settlement and legal fees come to ${formatMoney(owed)}: ${formatMoney(paid)} was paid from cash and ${formatMoney(deferred)} is now overdue.`
    : `The settlement and legal fees come to ${formatMoney(owed)}, paid from your cash.`;
  ctx.notifications.push({
    id: `spouse-filed-divorce-${spouse.id}`,
    title: '💔 Divorce',
    message: `${spouse.name} has filed for divorce after weeks of neglect. ${settlementLine}`,
  });

  return { owed, paid, deferred };
}
