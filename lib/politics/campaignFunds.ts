/**
 * Crediting the campaign pot.
 *
 * `campaignFunds` is the campaign's money: party funding lands there each week
 * (`weeklyTick.ts`), elections spend it, and embezzlement skims it - with the
 * scandal heat that brings. An event that raises money for the campaign (the
 * `political_fundraiser`) credits it here instead of paying cash into the
 * wallet, which is what it used to do (2026-10-23 owner decision D4).
 */

import type { PoliticsState } from '@/contexts/game/types';

const safe = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * `politics` with `amount` added to `campaignFunds`, floored at 0 and rounded
 * to whole dollars. Returns the same object when there is nothing to apply, so
 * a caller can compare by identity.
 */
export function creditCampaignFunds<P extends Pick<PoliticsState, 'campaignFunds'>>(politics: P, amount: number): P {
  const delta = safe(amount);
  if (delta === 0) return politics;
  return { ...politics, campaignFunds: Math.max(0, Math.round(safe(politics.campaignFunds) + delta)) };
}
