/**
 * Legacy Pass engine (seasonal battle pass) — pure logic, no side effects.
 *
 * A dual-track (free + premium) reward pass themed around the game's prestige /
 * "Legacy" loop. XP is earned from EXISTING engagement signals (daily/weekly
 * challenges, milestones, prestige) — see `LEGACY_PASS_XP`. Rewards are cosmetics,
 * youth pills, gems, and heritable traits only — **never** raw power, so the
 * economy's 2.0× income soft-cap is never threatened (no pay-to-win).
 *
 * Everything here is pure and deterministic so it is trivially unit-testable and
 * safe to call from the weekly tick or UI. State mutation (granting the reward to
 * GameState) is the caller's job.
 */
import type { LegacyPassState } from '@/contexts/game/types';

// ── Season clock ─────────────────────────────────────────────────────────────
/** Season length. Matches the strategy's 6-week cadence. */
export const SEASON_LENGTH_WEEKS = 6;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
/** Fixed epoch so season ids are stable across devices/timezones (UTC). */
const SEASON_EPOCH_MS = Date.UTC(2026, 0, 5); // Mon 2026-01-05

/** Derive the current season id from a wall-clock time. Stable + deterministic. */
export function getCurrentSeasonId(nowMs: number = Date.now()): string {
  const weeksSinceEpoch = Math.floor((nowMs - SEASON_EPOCH_MS) / MS_PER_WEEK);
  const seasonIndex = Math.max(0, Math.floor(weeksSinceEpoch / SEASON_LENGTH_WEEKS));
  return `season-${seasonIndex}`;
}

// ── Tiers ────────────────────────────────────────────────────────────────────
export const MAX_TIER = 25;
export const XP_PER_TIER = 100;

/** Tier (0..MAX_TIER) for a given XP total. Tier 0 = no tiers earned yet. */
export function getTierForXp(xp: number): number {
  if (!isFinite(xp) || xp <= 0) return 0;
  return Math.min(MAX_TIER, Math.floor(xp / XP_PER_TIER));
}

/** Total XP required to have reached a given tier. */
export function getXpForTier(tier: number): number {
  return Math.max(0, Math.min(MAX_TIER, tier)) * XP_PER_TIER;
}

/** XP earned into the current (not-yet-complete) tier, 0..XP_PER_TIER. */
export function xpIntoCurrentTier(xp: number): number {
  if (getTierForXp(xp) >= MAX_TIER) return XP_PER_TIER;
  return Math.max(0, Math.floor(xp)) % XP_PER_TIER;
}

/** XP remaining to the next tier (0 if maxed). */
export function xpToNextTier(xp: number): number {
  if (getTierForXp(xp) >= MAX_TIER) return 0;
  return XP_PER_TIER - xpIntoCurrentTier(xp);
}

// ── XP sources (for later wiring into the game loop) ─────────────────────────
export const LEGACY_PASS_XP = {
  dailyChallenge: 10,
  weeklyChallenge: 50,
  milestone: 25,
  achievement: 15,
  prestige: 200,
} as const;

// ── Rewards ──────────────────────────────────────────────────────────────────
export type LegacyPassRewardKind = 'gems' | 'youthPills' | 'cosmetic' | 'trait';

export interface LegacyPassReward {
  kind: LegacyPassRewardKind;
  /** For gems / youthPills: the quantity granted. */
  amount?: number;
  /** For cosmetic / trait: the item or trait id granted. */
  id?: string;
  /** Human-readable label for the UI. */
  label: string;
}

export type LegacyPassTrack = 'free' | 'premium';

/**
 * Build the reward tables programmatically so the 25-tier ladders stay balanced
 * and easy to retune. Tier index here is 1-based (tier 1 is the first reward).
 *  - Free track: steady gems, an occasional youth pill, a cosmetic at the finale.
 *  - Premium track: bigger gems, regular youth pills, cosmetics, and the marquee
 *    heritable trait at the top.
 */
function buildRewardTable(track: LegacyPassTrack): LegacyPassReward[] {
  const rewards: LegacyPassReward[] = [];
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    if (track === 'free') {
      if (tier === MAX_TIER) {
        rewards.push({ kind: 'cosmetic', id: `legacy_frame_s_free`, label: 'Legacy Profile Frame' });
      } else if (tier % 5 === 0) {
        rewards.push({ kind: 'youthPills', amount: 1, label: '1 Youth Pill' });
      } else {
        rewards.push({ kind: 'gems', amount: 25 + tier * 2, label: `${25 + tier * 2} Gems` });
      }
    } else {
      if (tier === MAX_TIER) {
        rewards.push({ kind: 'trait', id: `legacy_trait_s`, label: 'Heritable Legacy Trait' });
      } else if (tier % 10 === 0) {
        rewards.push({ kind: 'cosmetic', id: `legacy_theme_s_${tier}`, label: 'Apartment Theme' });
      } else if (tier % 3 === 0) {
        rewards.push({ kind: 'youthPills', amount: 1, label: '1 Youth Pill' });
      } else {
        rewards.push({ kind: 'gems', amount: 50 + tier * 5, label: `${50 + tier * 5} Gems` });
      }
    }
  }
  return rewards;
}

export const FREE_REWARDS: readonly LegacyPassReward[] = buildRewardTable('free');
export const PREMIUM_REWARDS: readonly LegacyPassReward[] = buildRewardTable('premium');

/** Reward for a 1-based tier on a track, or null if out of range. */
export function getLegacyPassReward(track: LegacyPassTrack, tier: number): LegacyPassReward | null {
  if (tier < 1 || tier > MAX_TIER) return null;
  const table = track === 'free' ? FREE_REWARDS : PREMIUM_REWARDS;
  return table[tier - 1] ?? null;
}

// ── State helpers (pure) ─────────────────────────────────────────────────────
export function getDefaultLegacyPass(seasonId: string = getCurrentSeasonId()): LegacyPassState {
  return {
    seasonId,
    xp: 0,
    premiumOwned: false,
    claimedFreeTiers: [],
    claimedPremiumTiers: [],
    ownedCosmetics: [],
  };
}

/**
 * Ensure the pass belongs to the given season. If the season rolled over, reset
 * progress (including premium ownership — premium is purchased per season).
 */
export function ensureCurrentSeason(
  pass: LegacyPassState | undefined,
  seasonId: string = getCurrentSeasonId(),
): LegacyPassState {
  if (!pass || pass.seasonId !== seasonId) {
    return getDefaultLegacyPass(seasonId);
  }
  // Same season: defensively normalise array fields so any reader (incl. a
  // partial pass from a CloudSync merge or hand-edited save that bypassed the
  // v20 migration) never sees `undefined` where an array is expected.
  const claimedFreeTiers = Array.isArray(pass.claimedFreeTiers) ? pass.claimedFreeTiers : [];
  const claimedPremiumTiers = Array.isArray(pass.claimedPremiumTiers) ? pass.claimedPremiumTiers : [];
  const ownedCosmetics = Array.isArray(pass.ownedCosmetics) ? pass.ownedCosmetics : [];
  if (
    claimedFreeTiers === pass.claimedFreeTiers &&
    claimedPremiumTiers === pass.claimedPremiumTiers &&
    ownedCosmetics === pass.ownedCosmetics
  ) {
    return pass; // already well-formed — avoid a needless allocation
  }
  return { ...pass, claimedFreeTiers, claimedPremiumTiers, ownedCosmetics };
}

/** Add XP (clamped non-negative), rolling the season over first if needed. */
export function addLegacyPassXp(
  pass: LegacyPassState | undefined,
  amount: number,
  seasonId: string = getCurrentSeasonId(),
): LegacyPassState {
  const current = ensureCurrentSeason(pass, seasonId);
  const add = isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return { ...current, xp: current.xp + add };
}

/** 1-based tiers that are unlocked but not yet claimed on a track. */
export function getClaimableTiers(pass: LegacyPassState, track: LegacyPassTrack): number[] {
  if (track === 'premium' && !pass.premiumOwned) return [];
  const unlockedTier = getTierForXp(pass.xp); // highest tier reached
  const claimed = new Set(track === 'free' ? pass.claimedFreeTiers : pass.claimedPremiumTiers);
  const out: number[] = [];
  for (let tier = 1; tier <= unlockedTier; tier++) {
    if (!claimed.has(tier)) out.push(tier);
  }
  return out;
}

/**
 * Every reward the player has EARNED (tier reached) but not yet claimed, across
 * both tracks (premium tiers only when premium is owned). Used at season rollover
 * to auto-collect what would otherwise be silently lost. Returns them in tier
 * order, free track first.
 */
export function getUnclaimedEarnedRewards(pass: LegacyPassState): LegacyPassReward[] {
  const out: LegacyPassReward[] = [];
  for (const tier of getClaimableTiers(pass, 'free')) {
    const r = getLegacyPassReward('free', tier);
    if (r) out.push(r);
  }
  for (const tier of getClaimableTiers(pass, 'premium')) {
    const r = getLegacyPassReward('premium', tier);
    if (r) out.push(r);
  }
  return out;
}

/** Count of claimable (earned-but-unclaimed) tiers across both tracks. */
export function getClaimableCount(pass: LegacyPassState | undefined): number {
  if (!pass) return 0;
  return getClaimableTiers(pass, 'free').length + getClaimableTiers(pass, 'premium').length;
}

export type ClaimResult =
  | { ok: true; pass: LegacyPassState; reward: LegacyPassReward }
  | { ok: false; reason: 'locked' | 'already-claimed' | 'premium-required' | 'no-reward' };

/**
 * Claim a single tier on a track. Pure: returns the updated pass + the reward, or
 * a typed failure reason. The caller applies the reward to GameState.
 */
export function claimLegacyPassTier(
  pass: LegacyPassState,
  track: LegacyPassTrack,
  tier: number,
): ClaimResult {
  const reward = getLegacyPassReward(track, tier);
  if (!reward) return { ok: false, reason: 'no-reward' };
  if (track === 'premium' && !pass.premiumOwned) return { ok: false, reason: 'premium-required' };
  if (getTierForXp(pass.xp) < tier) return { ok: false, reason: 'locked' };

  const claimedList = track === 'free' ? pass.claimedFreeTiers : pass.claimedPremiumTiers;
  if (claimedList.includes(tier)) return { ok: false, reason: 'already-claimed' };

  const nextClaimed = [...claimedList, tier].sort((a, b) => a - b);
  const nextPass: LegacyPassState =
    track === 'free'
      ? { ...pass, claimedFreeTiers: nextClaimed }
      : { ...pass, claimedPremiumTiers: nextClaimed };
  return { ok: true, pass: nextPass, reward };
}
