/**
 * DeepLife+ subscription benefit application — pure GameState transformers.
 *
 * Applies the in-game benefits of an active DeepLife+ subscription:
 *   - Removes ads (settings.adsRemoved) — same gate the Remove Ads IAP uses.
 *   - Grants a one-time gem welcome bonus (idempotent via
 *     settings.deepLifePlusActivated).
 *
 * The Legacy Pass premium track is gated separately on the subscription tier
 * (subscriptionService.getSubscriptionTier), so it needs no state change here.
 *
 * Pure + immutable — drop into `setGameState(prev => applyDeepLifePlusBenefits(prev))`.
 */
import type { GameState } from '@/contexts/game/types';
import { DEEP_LIFE_PLUS_WELCOME_GEMS } from '@/lib/subscription/deepLifePlus';

const safeAddGems = (base: number | undefined, amount: number): number => {
  const b = typeof base === 'number' && isFinite(base) ? base : 0;
  const a = isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return b + a;
};

/**
 * Grant DeepLife+ benefits. Idempotent for the welcome gems: they are only
 * granted on the first activation (gated by settings.deepLifePlusActivated);
 * ad removal is always (re)asserted.
 */
export function applyDeepLifePlusBenefits(state: GameState): GameState {
  const alreadyActivated = state.settings?.deepLifePlusActivated === true;
  const gemGrant = alreadyActivated ? 0 : DEEP_LIFE_PLUS_WELCOME_GEMS;

  return {
    ...state,
    settings: {
      ...state.settings,
      adsRemoved: true,
      adsRemovedDate: state.settings?.adsRemovedDate ?? new Date().toISOString(),
      deepLifePlusActivated: true,
    },
    stats: {
      ...state.stats,
      gems: safeAddGems(state.stats?.gems, gemGrant),
    },
  };
}
