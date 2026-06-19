/**
 * Legacy Pass actions — pure GameState transformers.
 *
 * These take a GameState and return a new one (immutably), so they are trivially
 * unit-testable and safe to drop into `setGameState(prev => ...)`. They sit on top
 * of the pure engine in `lib/legacyPass/legacyPass.ts`.
 *
 * Reward grants map to existing state:
 *   - gems       → stats.gems
 *   - youthPills → top-level youthPills
 *   - cosmetic   → legacyPass.ownedCosmetics (visual only)
 *   - trait      → activeTraits (heritable; passes to heirs via prestige)
 */
import type { GameState } from '@/contexts/game/types';
import {
  addLegacyPassXp,
  claimLegacyPassTier,
  ensureCurrentSeason,
  getCurrentSeasonId,
  type ClaimResult,
  type LegacyPassReward,
  type LegacyPassTrack,
} from '@/lib/legacyPass/legacyPass';

const pushUnique = (list: string[] | undefined, id: string): string[] => {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(id) ? arr : [...arr, id];
};

const safeAdd = (base: number | undefined, amount: number | undefined): number => {
  const b = typeof base === 'number' && isFinite(base) ? base : 0;
  const a = typeof amount === 'number' && isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return b + a;
};

/** Grant a single resolved reward to the state. Pure + immutable. */
export function applyLegacyPassReward(state: GameState, reward: LegacyPassReward): GameState {
  switch (reward.kind) {
    case 'gems':
      return {
        ...state,
        stats: { ...state.stats, gems: safeAdd(state.stats?.gems, reward.amount) },
      };
    case 'youthPills':
      return { ...state, youthPills: safeAdd(state.youthPills, reward.amount) };
    case 'cosmetic': {
      if (!reward.id) return state;
      const pass = ensureCurrentSeason(state.legacyPass);
      return {
        ...state,
        legacyPass: { ...pass, ownedCosmetics: pushUnique(pass.ownedCosmetics, reward.id) },
      };
    }
    case 'trait':
      if (!reward.id) return state;
      return { ...state, activeTraits: pushUnique(state.activeTraits, reward.id) };
    default:
      return state;
  }
}

/** Award Legacy Pass XP (rolls the season over if needed). Pure + immutable. */
export function awardLegacyPassXp(
  state: GameState,
  amount: number,
  nowMs: number = Date.now(),
): GameState {
  const seasonId = getCurrentSeasonId(nowMs);
  return { ...state, legacyPass: addLegacyPassXp(state.legacyPass, amount, seasonId) };
}

/**
 * Claim a tier and apply its reward in one step. Returns the new state plus the
 * engine's typed ClaimResult so the UI can show success/why-not. On failure the
 * state is returned unchanged.
 */
export function claimLegacyPassReward(
  state: GameState,
  track: LegacyPassTrack,
  tier: number,
  nowMs: number = Date.now(),
): { state: GameState; result: ClaimResult } {
  const pass = ensureCurrentSeason(state.legacyPass, getCurrentSeasonId(nowMs));
  const result = claimLegacyPassTier(pass, track, tier);
  if (!result.ok) {
    // Still persist any season reconciliation so the UI reflects the live season.
    return { state: { ...state, legacyPass: pass }, result };
  }
  const withClaim: GameState = { ...state, legacyPass: result.pass };
  const withReward = applyLegacyPassReward(withClaim, result.reward);
  return { state: withReward, result };
}

/** Mark the premium track as owned (called after a verified IAP). Pure. */
export function unlockLegacyPassPremium(state: GameState, nowMs: number = Date.now()): GameState {
  const pass = ensureCurrentSeason(state.legacyPass, getCurrentSeasonId(nowMs));
  return { ...state, legacyPass: { ...pass, premiumOwned: true } };
}
