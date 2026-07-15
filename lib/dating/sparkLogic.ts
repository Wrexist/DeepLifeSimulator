/**
 * Spark logic — pure functions backing the dating app.
 *
 * Owns: match probability scoring, catfish detection, premium tier perks,
 * swipe quota math, jealousy/cheating risk calculations.
 *
 * No React, no setGameState — these are pure functions on input data.
 */

import type {
  GameState,
  SparkPremiumTier,
  SparkPremium,
} from '@/contexts/game/types';
import type { DatingProfile } from './datingProfiles';

// ── Match probability ─────────────────────────────────────────────────────

/**
 * Calculate the probability (0-1) that an NPC swipes right on the player.
 * Inputs: player's reputation/wealth/photos + NPC personality + active boost.
 *
 * Used by `swipeOnProfile` action to decide if a swipe-right becomes a match.
 */
export function calculateMatchProbability(
  state: GameState,
  profile: DatingProfile,
): number {
  const stats = state.stats;
  const reputation = stats?.reputation ?? 0;
  const sparkProfile = state.sparkApp?.profile;
  const hasPhotos = (sparkProfile?.photos?.length ?? 0) > 0;
  const hasBio = (sparkProfile?.bio?.length ?? 0) > 20;

  // Base rate scales loosely with reputation: low rep ~25%, high rep ~70%.
  let p = 0.25 + Math.min(0.45, reputation / 200);

  // Profile quality lifts match rate meaningfully.
  if (hasPhotos) p += 0.08;
  if (hasBio) p += 0.05;
  if (sparkProfile?.attractivenessScore != null) {
    p += Math.min(0.15, sparkProfile.attractivenessScore / 1000);
  }

  // Premium subscribers get a small algorithmic edge.
  const premium = state.sparkApp?.premium;
  if (premium?.active) {
    p += premium.tier === 'ultra' ? 0.12 : premium.tier === 'plus' ? 0.06 : 0;
  }

  // Active boost amplifies further.
  if (state.sparkApp?.boost?.active) {
    p *= premium?.perks?.boostMultiplier ?? 1.5;
  }

  // Wealth gating: millionaire NPCs are pickier when player has no money.
  const money = stats?.money ?? 0;
  if (profile.wealth === 'millionaire' && money < 50_000) p *= 0.4;
  if (profile.wealth === 'wealthy' && money < 5_000) p *= 0.7;

  // Personality compatibility — friendly+caring is broad, ambitious is selective.
  if (profile.personality === 'ambitious' && reputation < 30) p *= 0.7;
  if (profile.personality === 'romantic' && hasBio) p += 0.05;

  return Math.max(0.05, Math.min(0.95, p));
}

/**
 * Deterministic "Did the NPC swipe right?" decision.
 * Uses the same `(handle, week, profileId)` seed pattern as the rest of the
 * codebase so re-renders / StrictMode produce identical results per week.
 */
export function rollMatch(
  state: GameState,
  profile: DatingProfile,
  weeksLived: number,
): boolean {
  const p = calculateMatchProbability(state, profile);
  const seed = `spark|${state.userProfile?.handle ?? 'player'}|${weeksLived}|${profile.id}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const pseudoRandom = (Math.abs(h) % 10_000) / 10_000;
  return pseudoRandom < p;
}

// ── Catfish detection ─────────────────────────────────────────────────────

/**
 * Probability that a given profile is a catfish.
 * Suspicion increases when income looks too good for the photo set, wealth tier
 * mismatches the listed job, or the bio uses scam-y phrases.
 */
export function calculateCatfishProbability(profile: DatingProfile): number {
  let p = 0.03; // baseline — most profiles are real
  const incomeMismatch = profile.wealth === 'millionaire' && profile.income < 100_000;
  const wealthMismatch = profile.wealth === 'millionaire' && profile.job === 'Student';
  const bioRedFlags = /\b(invest|crypto|send|cashapp|venmo|sugar)\b/i.test(profile.bio);
  if (incomeMismatch) p += 0.25;
  if (wealthMismatch) p += 0.3;
  if (bioRedFlags) p += 0.4;
  if ((profile.photos?.length ?? 0) === 0 && profile.wealth === 'millionaire') p += 0.15;
  return Math.min(0.65, p);
}

/**
 * Catfish risk based on deterministic per-profile seed — so the same profile is
 * consistently catfish-or-not in a save.
 */
export function isCatfish(profile: DatingProfile, lineageSeed: string): boolean {
  const p = calculateCatfishProbability(profile);
  if (p < 0.05) return false;
  const seed = `catfish|${lineageSeed}|${profile.id}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 100) / 100 < p;
}

// ── Premium tier perks ────────────────────────────────────────────────────

export const SPARK_PREMIUM_TIERS: Record<SparkPremiumTier, SparkPremium['perks']> = {
  free: {
    unlimitedSwipes: false,
    seeWhoLikedYou: false,
    rewindLastSwipe: false,
    boostMultiplier: 1.0,
    superLikesPerDay: 1,
    verifiedBadge: false,
    travelMode: false,
  },
  plus: {
    unlimitedSwipes: true,
    seeWhoLikedYou: false,
    rewindLastSwipe: true,
    boostMultiplier: 1.5,
    superLikesPerDay: 5,
    verifiedBadge: false,
    travelMode: false,
  },
  ultra: {
    unlimitedSwipes: true,
    seeWhoLikedYou: true,
    rewindLastSwipe: true,
    boostMultiplier: 2.5,
    superLikesPerDay: 10,
    verifiedBadge: true,
    travelMode: true,
  },
};

export function perksForTier(tier: SparkPremiumTier): SparkPremium['perks'] {
  return { ...SPARK_PREMIUM_TIERS[tier] };
}

/**
 * Spark Premium — in-game (cash) subscription pricing per tier. Paid from
 * stats.money and auto-renewed weekly on the tick (see applySubscriptionsForWeek).
 * Ultra is ~2× Plus (mirrors the old $4.99 / $9.99 split) and priced against the
 * game's weekly job income. NOT a real App Store IAP.
 */
export const SPARK_TIER_PRICING: Record<'plus' | 'ultra', { weekly: number; annual: number }> = {
  plus: { weekly: 12, annual: 520 }, // 52 × 12 = 624 → ~17% off
  ultra: { weekly: 24, annual: 1040 }, // 52 × 24 = 1248 → ~17% off
};

// ── Swipe quota ───────────────────────────────────────────────────────────

/** Max swipes per week at the player's current premium tier. */
export function maxSwipesPerWeek(premium: SparkPremium | undefined): number {
  if (premium?.perks?.unlimitedSwipes) return Number.POSITIVE_INFINITY;
  return 30;
}

/** Swipes remaining this in-game week. */
export function swipesRemaining(state: GameState): number {
  const sp = state.sparkApp;
  if (!sp) return 0;
  const max = maxSwipesPerWeek(sp.premium);
  if (max === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return Math.max(0, max - sp.swipesUsedThisWeek);
}

/** Super-likes remaining this week per premium tier. */
export function superLikesRemaining(state: GameState): number {
  const sp = state.sparkApp;
  if (!sp) return 0;
  // Optional-chain: a save from before `premium`/`perks` existed would throw
  // here on every SwipeScreen render (swipesRemaining above already guards).
  // Fall back to the free-tier allowance (1).
  const cap = sp.premium?.perks?.superLikesPerDay ?? 1;
  return Math.max(0, cap - (sp.superLikesUsedThisWeek ?? 0));
}

// ── Jealousy risk ─────────────────────────────────────────────────────────

/**
 * Probability per week that an active partner notices the player swiping on
 * Spark. Scales with how many active partners + how many swipes this week.
 */
export function calculateJealousyRisk(state: GameState): number {
  const partners = (state.relationships ?? []).filter(
    (r) => (r.type === 'partner' || r.type === 'spouse') && (r.relationshipScore ?? 0) > 40,
  );
  if (partners.length === 0) return 0;

  const swipesThisWeek = state.sparkApp?.swipesUsedThisWeek ?? 0;
  if (swipesThisWeek === 0) return 0;

  // Spouses are more vigilant than partners.
  const hasSpouse = partners.some((p) => p.type === 'spouse');
  const swipeFactor = Math.min(1, swipesThisWeek / 20);
  const partnerFactor = Math.min(1, partners.length / 3);

  let p = 0.05 + swipeFactor * 0.35 + partnerFactor * 0.2;
  if (hasSpouse) p += 0.1;
  return Math.min(0.7, p);
}

// ── Profile attractiveness (for incoming likes) ───────────────────────────

/**
 * Score the player's own dating profile (0-100). Drives incoming "liked you"
 * volume and small match-rate boosts.
 */
export function scorePlayerProfile(state: GameState): number {
  const sp = state.sparkApp;
  if (!sp) return 0;
  const photos = sp.profile?.photos?.length ?? 0;
  const bioLen = (sp.profile?.bio ?? '').length;
  const interests = (sp.profile?.interests ?? []).length;
  const reputation = state.stats?.reputation ?? 0;
  const money = state.stats?.money ?? 0;
  const verified = sp.premium?.perks?.verifiedBadge ? 8 : 0;

  let s = 10;
  s += Math.min(25, photos * 8);          // up to 25 from photos
  s += Math.min(15, bioLen / 6);          // up to 15 from bio length
  s += Math.min(10, interests * 2);       // up to 10 from interests
  s += Math.min(20, reputation / 2);      // up to 20 from rep
  s += Math.min(12, Math.log10(Math.max(1, money)));
  s += verified;
  return Math.min(100, Math.round(s));
}
