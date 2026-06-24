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
import type { GameState, LegacyPassState } from '@/contexts/game/types';
import {
  addLegacyPassXp,
  claimLegacyPassTier,
  ensureCurrentSeason,
  getClaimableTiers,
  getCurrentSeasonId,
  getDefaultLegacyPass,
  getUnclaimedEarnedRewards,
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

/**
 * Roll the pass over to a new season WITHOUT losing progress: auto-collect every
 * earned-but-unclaimed reward (gems/youth pills/traits granted to the account;
 * cosmetics carried forward into the new pass), then start the new season. Stamps
 * a one-shot `legacyPassSeasonSummary` for the UI. Pure + immutable.
 *
 * `premiumActiveNow` sets the new season's premium flag (callers with subscription
 * context pass the live value; XP paths pass false and let the reconciler/modal
 * re-derive it).
 */
function rolloverLegacyPass(
  state: GameState,
  newSeasonId: string,
  premiumActiveNow: boolean,
): GameState & { legacyPass: LegacyPassState } {
  const old = state.legacyPass;
  // Normalise against its OWN season id so we read it as-is (no reset here).
  const oldNormalized = old ? ensureCurrentSeason(old, old.seasonId) : undefined;
  const collected = oldNormalized ? getUnclaimedEarnedRewards(oldNormalized) : [];

  let next = state;
  const carriedCosmetics = [...(oldNormalized?.ownedCosmetics ?? [])];
  let collectedGems = 0;
  for (const reward of collected) {
    if (reward.kind === 'cosmetic') {
      // Cosmetics are permanent — carry them into the new season's pass.
      if (reward.id && !carriedCosmetics.includes(reward.id)) carriedCosmetics.push(reward.id);
    } else {
      if (reward.kind === 'gems') collectedGems += reward.amount ?? 0;
      next = applyLegacyPassReward(next, reward); // gems/youthPills/trait → account-level
    }
  }

  const newPass: LegacyPassState = {
    ...getDefaultLegacyPass(newSeasonId),
    premiumOwned: premiumActiveNow,
    ownedCosmetics: carriedCosmetics,
  };

  return {
    ...next,
    legacyPass: newPass,
    legacyPassSeasonSummary:
      collected.length > 0
        ? {
            endedSeasonId: oldNormalized?.seasonId ?? '',
            newSeasonId,
            collectedCount: collected.length,
            collectedGems,
          }
        : next.legacyPassSeasonSummary,
  };
}

/**
 * Award Legacy Pass XP. If the season has rolled over, auto-collects unclaimed
 * rewards first (no silent loss), then adds XP to the fresh season. Pure + immutable.
 */
export function awardLegacyPassXp(
  state: GameState,
  amount: number,
  nowMs: number = Date.now(),
): GameState {
  const seasonId = getCurrentSeasonId(nowMs);
  const current = state.legacyPass;
  if (current && current.seasonId === seasonId) {
    return { ...state, legacyPass: addLegacyPassXp(current, amount, seasonId) };
  }
  const rolled = rolloverLegacyPass(state, seasonId, false);
  return { ...rolled, legacyPass: addLegacyPassXp(rolled.legacyPass, amount, seasonId) };
}

/**
 * Return `state` with its pass normalised to the live season. If the season has
 * rolled over (e.g. the boundary was crossed while the Legacy Pass modal sat
 * open), this auto-collects the old season's earned-but-unclaimed rewards — it
 * never resets the pass and silently drops them. Mirrors `awardLegacyPassXp` /
 * `reconcileLegacyPassSeason`. The new season's premium flag is left false and
 * re-derived from the live subscription by the reconciler; collection of the old
 * season's premium rewards is unaffected (it reads the old pass's `premiumOwned`).
 */
function withLiveSeason(
  state: GameState,
  seasonId: string,
): GameState & { legacyPass: LegacyPassState } {
  const current = state.legacyPass;
  if (current && current.seasonId === seasonId) {
    return { ...state, legacyPass: ensureCurrentSeason(current, seasonId) };
  }
  return rolloverLegacyPass(state, seasonId, false);
}

/**
 * Reconcile the pass to the live season at session start / foreground / pass-open.
 * On rollover: auto-collect + reset (premium re-derived from the subscription).
 * Within a season: normalise + re-derive premium from the subscription. Pure.
 */
export function reconcileLegacyPassSeason(
  state: GameState,
  premiumActiveNow: boolean,
  nowMs: number = Date.now(),
): GameState {
  const seasonId = getCurrentSeasonId(nowMs);
  const current = state.legacyPass;
  if (current && current.seasonId === seasonId) {
    const normalized = ensureCurrentSeason(current, seasonId);
    // Re-derive premium from the live subscription: upgrade when it becomes
    // active, and downgrade when it lapses mid-season (otherwise a lapsed
    // subscriber could keep claiming premium rewards until the next rollover).
    if (premiumActiveNow && !normalized.premiumOwned) {
      return { ...state, legacyPass: { ...normalized, premiumOwned: true } };
    }
    if (!premiumActiveNow && normalized.premiumOwned) {
      return { ...state, legacyPass: { ...normalized, premiumOwned: false } };
    }
    return normalized === current ? state : { ...state, legacyPass: normalized };
  }
  return rolloverLegacyPass(state, seasonId, premiumActiveNow);
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
  // Roll over (auto-collecting unclaimed rewards) if the season changed since the
  // pass was last reconciled — never reset to an empty pass and drop them.
  const base = withLiveSeason(state, getCurrentSeasonId(nowMs));
  const pass = base.legacyPass;
  const result = claimLegacyPassTier(pass, track, tier);
  if (!result.ok) {
    // Still persist any season reconciliation/collection so the UI reflects the
    // live season (and the player keeps any rewards auto-collected on rollover).
    return { state: base, result };
  }
  const withClaim: GameState = { ...base, legacyPass: result.pass };
  const withReward = applyLegacyPassReward(withClaim, result.reward);
  return { state: withReward, result };
}

/**
 * Claim every claimable tier (free + premium-if-owned) in one step and apply all
 * rewards. Returns the new state plus a summary. Pure + immutable. Iterating the
 * up-front claimable lists is safe — claiming never unlocks new tiers.
 */
export function claimAllLegacyPassRewards(
  state: GameState,
  nowMs: number = Date.now(),
): { state: GameState; claimedCount: number; gemsGained: number } {
  const seasonId = getCurrentSeasonId(nowMs);
  // Roll over (auto-collecting unclaimed rewards) if the season changed; the
  // collected rewards land on the account even though the new season has no
  // claimable tiers, so nothing is silently lost.
  let next: GameState = withLiveSeason(state, seasonId);
  let claimedCount = 0;
  let gemsGained = 0;

  const tracks: LegacyPassTrack[] = ['free', 'premium'];
  for (const track of tracks) {
    const pass = next.legacyPass;
    if (!pass) break; // withLiveSeason guarantees a pass; guard for the union type
    for (const tier of getClaimableTiers(pass, track)) {
      const res = claimLegacyPassReward(next, track, tier, nowMs);
      if (res.result.ok) {
        next = res.state;
        claimedCount += 1;
        if (res.result.reward.kind === 'gems') gemsGained += res.result.reward.amount ?? 0;
      }
    }
  }
  return { state: next, claimedCount, gemsGained };
}

/** Mark the premium track as owned (called after a verified IAP). Pure. */
export function unlockLegacyPassPremium(state: GameState, nowMs: number = Date.now()): GameState {
  const pass = ensureCurrentSeason(state.legacyPass, getCurrentSeasonId(nowMs));
  return { ...state, legacyPass: { ...pass, premiumOwned: true } };
}
