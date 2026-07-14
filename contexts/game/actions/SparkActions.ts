/**
 * Spark Actions — in-game dating app (v15+).
 *
 * Pattern (matches SocialActions.ts / PulseActions.ts / DatingActions.ts):
 *   - First arg is React.Dispatch<SetStateAction<GameState>>
 *   - Mutate via setGameState(prev => ...)
 *   - Do NOT call saveGame() — the UI caller does that
 *   - All time-stamped fields use weeksLived (absolute), never the cyclic 1-4 counter
 *
 * Coverage:
 *   - Profile editing
 *   - Swiping (left / right / super)
 *   - Match management + chat
 *   - Premium subscription (3 tiers)
 *   - Gem boost
 *   - Catfish reporting + exposure
 *   - Jealousy event resolution
 *   - Promotion from match → relationship (chat → dating)
 */
import React from 'react';
import { GameState } from '../types';
import type {
  SparkSwipeDirection,
  SparkPremiumTier,
  SparkMatch,
  SparkMessage,
  SparkPlayerProfile,
  SparkJealousyOutcome,
  SparkPremium,
  InGameSubscriptionPlan,
} from '../types';
import { logger } from '@/utils/logger';
import { updateStats } from './StatsActions';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import {
  rollMatch,
  isCatfish,
  perksForTier,
  swipesRemaining,
  superLikesRemaining,
  SPARK_TIER_PRICING,
} from '@/lib/dating/sparkLogic';
import { DATING_PROFILES, type DatingProfile } from '@/lib/dating/datingProfiles';
import { findRomanticPartner } from '@/lib/dating/relationshipGuards';
import { getNpcReplyPool } from '@/lib/dating/npcReplyPool';

const log = logger.scope('SparkActions');

const SWIPE_HISTORY_CAP = 200;
const MESSAGE_HISTORY_CAP = 100;
const JEALOUSY_HISTORY_CAP = 50;
const BOOST_GEM_COST = 50;
const BOOST_DURATION_WEEKS = 1;
const REWIND_GEM_COST = 20;

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

function ensureSpark(prev: GameState): NonNullable<GameState['sparkApp']> {
  return (
    prev.sparkApp ?? {
      profile: { bio: '', photos: [], interests: [], showAge: true, showJob: true, showWealth: false },
      swipes: [],
      matches: [],
      messages: {},
      swipeQuota: 30,
      swipesUsedThisWeek: 0,
      lastQuotaResetWeek: 0,
      superLikesUsedThisWeek: 0,
      premium: {
        active: false,
        tier: 'free',
        perks: perksForTier('free'),
      },
      likedYou: [],
      catfishRecords: [],
      activeJealousy: null,
      jealousyHistory: [],
      boost: null,
      dismissedCatfishIds: [],
      reportedIds: [],
      lifetimeStats: {
        totalSwipes: 0, totalMatches: 0, totalSuperLikes: 0,
        totalDatesGoneOn: 0, totalGiftsGiven: 0, totalProposals: 0,
        totalMarriages: 0, totalDivorces: 0,
        totalCatfishExposed: 0, totalJealousyEvents: 0,
        peakPremiumTier: 'free', totalPremiumWeeks: 0,
      },
    }
  );
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function findProfile(profileId: string): DatingProfile | undefined {
  return DATING_PROFILES.find((p) => p.id === profileId);
}

// ─────────────────────────────────────────────────────────────────────
// Profile editing
// ─────────────────────────────────────────────────────────────────────

export const updateMyProfile = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  patch: Partial<SparkPlayerProfile>,
): void => {
  setGameState((prev) => {
    const sp = ensureSpark(prev);
    return {
      ...prev,
      sparkApp: {
        ...sp,
        profile: { ...sp.profile, ...patch },
      },
    };
  });
};

// ─────────────────────────────────────────────────────────────────────
// Swiping
// ─────────────────────────────────────────────────────────────────────

export interface SwipeResult {
  success: boolean;
  message: string;
  matched?: boolean;
  catfishSuspected?: boolean;
  superUsed?: boolean;
  /** P1-5: id of the SparkMatch created on a match, so the UI opens the right
   *  chat instead of guessing the last entry from stale closure state. */
  matchId?: string;
}

/**
 * Swipe on a dating profile.
 *
 * - 'left'  = pass
 * - 'right' = like
 * - 'super' = super-like (premium-quota-gated, 3× match chance, NPC notified)
 *
 * Side effects:
 *   - Decrements swipe quota
 *   - On right/super, rolls match probability via `rollMatch`
 *   - On match, appends a SparkMatch
 *   - Flags catfish suspicion when applicable
 */
export const swipeOnProfile = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  profileId: string,
  direction: SparkSwipeDirection,
): SwipeResult => {
  const profile = findProfile(profileId);
  if (!profile) return { success: false, message: 'Profile not found' };

  const sp = gameState.sparkApp;
  if (!sp) return { success: false, message: 'Spark not initialized' };
  if (swipesRemaining(gameState) <= 0) {
    return { success: false, message: 'Out of swipes this week — upgrade to Plus for unlimited' };
  }

  const isSuper = direction === 'super';
  if (isSuper && superLikesRemaining(gameState) <= 0) {
    return { success: false, message: 'Out of super-likes this week — upgrade for more' };
  }

  const weeksLived = gameState.weeksLived ?? 0;
  const isLike = direction === 'right' || direction === 'super';

  // Determine match outcome. Super-likes get a 3× probability bump (rolled
  // by re-running the seeded roll three times and taking max).
  let matched = false;
  if (isLike) {
    matched = rollMatch(gameState, profile, weeksLived);
    if (isSuper && !matched) {
      matched = rollMatch(gameState, profile, weeksLived + 1)
        || rollMatch(gameState, profile, weeksLived + 2);
    }
  }

  // Catfish suspicion — same deterministic seed per save/profile.
  const lineageSeed = gameState.lineageId ?? 'initial';
  const catfishSuspected = isCatfish(profile, lineageSeed);

  // P1-5: mint the match id OUTSIDE the updater so we can return it. The UI
  // previously read the "last match" from the stale closure gameState, which on
  // the first match was undefined → "Conversation not found", and on later
  // matches opened the wrong chat.
  const newMatchId = matched ? genId('spm') : undefined;

  setGameState((prev) => {
    const s = ensureSpark(prev);
    const swipe = {
      profileId,
      direction,
      matched,
      swipedWeek: weeksLived,
      timestamp: Date.now(),
    };
    const newSwipes = [swipe, ...s.swipes].slice(0, SWIPE_HISTORY_CAP);
    // Dedup by profileId: two rapid Like taps (finishSwipe fires from an
    // animation callback that ignores the `finished` flag) must not append a
    // second match for the same profile or double-count totalMatches.
    const alreadyMatched = s.matches.some((m) => m.profileId === profileId);
    const newMatchAdded = matched && !alreadyMatched;
    const newMatches = newMatchAdded
      ? [
          ...s.matches,
          {
            id: newMatchId as string,
            profileId,
            matchedWeek: weeksLived,
            superLiked: isSuper,
            promoted: false,
          } as SparkMatch,
        ]
      : s.matches;

    // R10-2: also record the match in the top-level `datingMatches` ledger. The
    // "first match" / "25 matches" achievements read `gs.datingMatches?.length`,
    // which nothing wrote to — so they were permanently stuck at 0. Append the
    // matched profile id (deduped) so that progress actually accrues.
    const newDatingMatches =
      matched && !(prev.datingMatches ?? []).includes(profileId)
        ? [...(prev.datingMatches ?? []), profileId]
        : prev.datingMatches;

    return {
      ...prev,
      datingMatches: newDatingMatches,
      sparkApp: {
        ...s,
        swipes: newSwipes,
        matches: newMatches,
        swipesUsedThisWeek: s.swipesUsedThisWeek + 1,
        superLikesUsedThisWeek: s.superLikesUsedThisWeek + (isSuper ? 1 : 0),
        lifetimeStats: {
          ...s.lifetimeStats,
          totalSwipes: s.lifetimeStats.totalSwipes + 1,
          totalSuperLikes: s.lifetimeStats.totalSuperLikes + (isSuper ? 1 : 0),
          totalMatches: s.lifetimeStats.totalMatches + (newMatchAdded ? 1 : 0),
        },
      },
    };
  });

  log.info(`swipe ${direction} on ${profile.name} → matched=${matched}`);
  return {
    success: true,
    message: matched ? `It's a match with ${profile.name}!` : direction === 'left' ? 'Passed' : 'Liked',
    matched,
    catfishSuspected,
    superUsed: isSuper,
    matchId: newMatchId,
  };
};

/**
 * Rewind the last swipe. Premium feature — costs 20 gems on the free tier,
 * free for Plus/Ultra subscribers.
 */
export const rewindLastSwipe = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): { success: boolean; message: string } => {
  const sp = gameState.sparkApp;
  if (!sp) return { success: false, message: 'Spark not initialized' };
  if (sp.swipes.length === 0) return { success: false, message: 'No swipes to undo' };

  const isPremium = sp.premium.perks.rewindLastSwipe;
  if (!isPremium && (gameState.stats?.gems ?? 0) < REWIND_GEM_COST) {
    return { success: false, message: `Need ${REWIND_GEM_COST} gems to rewind` };
  }

  const last = sp.swipes[0];
  setGameState((prev) => {
    // H-8 (R8): for non-premium users, debit gems INSIDE the updater and reject
    // if they can no longer afford the rewind. updateStats clamps gems to >=0
    // rather than rejecting, which let grant-then-charge run the undo for free.
    if (!isPremium && (prev.stats?.gems ?? 0) < REWIND_GEM_COST) {
      return prev;
    }
    const s = ensureSpark(prev);
    return {
      ...prev,
      stats: isPremium
        ? prev.stats
        : { ...prev.stats, gems: (prev.stats.gems ?? 0) - REWIND_GEM_COST },
      sparkApp: {
        ...s,
        swipes: s.swipes.slice(1),
        matches: last.matched ? s.matches.filter((m) => m.profileId !== last.profileId || m.matchedWeek !== last.swipedWeek) : s.matches,
        swipesUsedThisWeek: Math.max(0, s.swipesUsedThisWeek - 1),
        superLikesUsedThisWeek: last.direction === 'super'
          ? Math.max(0, s.superLikesUsedThisWeek - 1)
          : s.superLikesUsedThisWeek,
      },
    };
  });
  return { success: true, message: 'Last swipe undone' };
};

// ─────────────────────────────────────────────────────────────────────
// Matches & chat
// ─────────────────────────────────────────────────────────────────────

export const unmatch = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  matchId: string,
): void => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    const { [matchId]: _gone, ...remainingMsgs } = s.messages;
    return {
      ...prev,
      sparkApp: {
        ...s,
        matches: s.matches.filter((m) => m.id !== matchId),
        messages: remainingMsgs,
      },
    };
  });
};

export const sendSparkMessage = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  matchId: string,
  text: string,
): { success: boolean; message: string; messageId?: string } => {
  const trimmed = (text || '').trim();
  if (!trimmed) return { success: false, message: 'Message cannot be empty' };
  if ((gameState.stats?.energy ?? 0) < 2) {
    return { success: false, message: 'Need 2 energy to send a message' };
  }

  const weeksLived = gameState.weeksLived ?? 0;
  const messageId = genId('spmsg');

  setGameState((prev) => {
    const s = ensureSpark(prev);
    const match = s.matches.find((m) => m.id === matchId);
    if (!match) return prev;

    const playerMsg: SparkMessage = {
      id: messageId,
      matchId,
      from: 'player',
      text: trimmed,
      timestamp: Date.now(),
      gameWeek: weeksLived,
    };

    const existing = s.messages[matchId] ?? [];
    const updatedThread = [...existing, playerMsg].slice(-MESSAGE_HISTORY_CAP);

    return {
      ...prev,
      sparkApp: {
        ...s,
        matches: s.matches.map((m) =>
          m.id === matchId
            ? { ...m, lastMessageTimestamp: Date.now(), unreadByNpc: (m.unreadByNpc ?? 0) + 1 }
            : m,
        ),
        messages: { ...s.messages, [matchId]: updatedThread },
      },
    };
  });

  updateStats(setGameState, { energy: -2 });
  return { success: true, message: 'Sent', messageId };
};

/**
 * Generate an NPC reply to the player's latest message. Called from the UI
 * after `sendSparkMessage` to simulate the NPC writing back.
 */
export const generateNpcReply = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  matchId: string,
): void => {
  const sp = gameState.sparkApp;
  const match = sp?.matches.find((m) => m.id === matchId);
  if (!sp || !match) return;
  const profile = findProfile(match.profileId);
  if (!profile) return;

  // Deterministic reply pool based on profile personality. Pools are content —
  // they live in lib/dating/npcReplyPool.ts and cover every catalog personality
  // (see PREREQ BUG FIX there), so replies actually vary by who you match with
  // instead of collapsing to the generic `friendly` pool.
  const pool = getNpcReplyPool(profile.personality);
  const reply = pool[Math.floor(Math.random() * pool.length)];
  const weeksLived = gameState.weeksLived ?? 0;

  setGameState((prev) => {
    const s = ensureSpark(prev);
    const m = s.matches.find((x) => x.id === matchId);
    if (!m) return prev;
    const npcMsg: SparkMessage = {
      id: genId('spnpc'),
      matchId,
      from: 'npc',
      text: reply,
      timestamp: Date.now(),
      gameWeek: weeksLived,
    };
    const existing = s.messages[matchId] ?? [];
    return {
      ...prev,
      sparkApp: {
        ...s,
        matches: s.matches.map((mm) =>
          mm.id === matchId
            ? { ...mm, lastMessageTimestamp: Date.now(), unreadByPlayer: (mm.unreadByPlayer ?? 0) + 1, unreadByNpc: 0 }
            : mm,
        ),
        messages: { ...s.messages, [matchId]: [...existing, npcMsg].slice(-MESSAGE_HISTORY_CAP) },
      },
    };
  });
};

export const markMatchRead = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  matchId: string,
): void => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    return {
      ...prev,
      sparkApp: {
        ...s,
        matches: s.matches.map((m) =>
          m.id === matchId ? { ...m, unreadByPlayer: 0 } : m,
        ),
      },
    };
  });
};

// ─────────────────────────────────────────────────────────────────────
// Likes-You inbox (delivers the Ultra "See who liked you" perk)
// ─────────────────────────────────────────────────────────────────────

/**
 * Like back a profile from the "liked you" inbox. Because they already liked
 * the player, liking back is a guaranteed instant match — mirrors
 * `swipeOnProfile`'s match-append + `datingMatches` dedupe. Gated behind the
 * `seeWhoLikedYou` perk (Ultra): free/Plus users only see a blurred count, so
 * they can never target a specific profile to like back.
 *
 * Consumes the `likedYou` entry (whether or not a fresh match was created) so
 * the inbox doesn't re-surface someone the player already actioned.
 */
export const likeBackFromLikedYou = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  profileId: string,
): { success: boolean; message: string; matchId?: string } => {
  const sp = gameState.sparkApp;
  if (!sp) return { success: false, message: 'Spark not initialized' };
  if (!sp.premium.perks.seeWhoLikedYou) {
    return { success: false, message: 'Upgrade to Ultra to see who liked you' };
  }
  const entry = sp.likedYou.find((l) => l.profileId === profileId);
  if (!entry) return { success: false, message: 'They no longer like you' };
  const profile = findProfile(profileId);
  if (!profile) return { success: false, message: 'Profile no longer exists' };

  const weeksLived = gameState.weeksLived ?? 0;
  // If a match already exists for this profile, reuse its id; otherwise mint a
  // fresh one OUTSIDE the updater so we can return it deterministically.
  const existingMatch = sp.matches.find((m) => m.profileId === profileId);
  const matchId = existingMatch ? existingMatch.id : genId('spm');

  setGameState((prev) => {
    const s = ensureSpark(prev);
    const already = s.matches.some((m) => m.profileId === profileId);
    const newMatches = already
      ? s.matches
      : [
          ...s.matches,
          {
            id: matchId,
            profileId,
            matchedWeek: weeksLived,
            superLiked: entry.superLiked,
            promoted: false,
          } as SparkMatch,
        ];
    const newDatingMatches =
      !(prev.datingMatches ?? []).includes(profileId)
        ? [...(prev.datingMatches ?? []), profileId]
        : prev.datingMatches;
    return {
      ...prev,
      datingMatches: newDatingMatches,
      sparkApp: {
        ...s,
        matches: newMatches,
        // Always consume the liked-you entry once actioned.
        likedYou: s.likedYou.filter((l) => l.profileId !== profileId),
        lifetimeStats: {
          ...s.lifetimeStats,
          totalMatches: s.lifetimeStats.totalMatches + (already ? 0 : 1),
        },
      },
    };
  });

  log.info(`like-back on ${profile.name} → match ${matchId}`);
  return { success: true, message: `It's a match with ${profile.name}!`, matchId };
};

/**
 * Dismiss a "liked you" entry without matching. Removes it from the inbox.
 * (No `dismissed` flag / migration needed — the entry is simply dropped.)
 */
export const dismissLikedYou = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  profileId: string,
): void => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (!s.likedYou.some((l) => l.profileId === profileId)) return prev;
    return {
      ...prev,
      sparkApp: { ...s, likedYou: s.likedYou.filter((l) => l.profileId !== profileId) },
    };
  });
};

// ─────────────────────────────────────────────────────────────────────
// Promote match → relationship
// ─────────────────────────────────────────────────────────────────────

/**
 * Promote a Spark match into a full `Relationship` (partner). Required
 * before the player can go on dates, give gifts, or propose via the
 * existing DatingActions. The match remains in `sparkApp.matches` flagged
 * `promoted: true` so the chat history stays accessible.
 */
export const promoteMatchToRelationship = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  matchId: string,
): { success: boolean; message: string; relationshipId?: string } => {
  const sp = gameState.sparkApp;
  const match = sp?.matches.find((m) => m.id === matchId);
  if (!sp || !match) return { success: false, message: 'Match not found' };
  if (match.promoted) return { success: false, message: 'Already dating this person' };
  // ANTI-BIGAMY: exclusivity — can't start dating while already with someone
  // (same rule + message style as SocialActionsContext.startDating).
  const existingPartner = findRomanticPartner(gameState.relationships);
  if (existingPartner) {
    return { success: false, message: `You are already with ${existingPartner.name}.` };
  }
  const profile = findProfile(match.profileId);
  if (!profile) return { success: false, message: 'Profile no longer exists' };

  const relationshipId = match.id; // share the id so future ops can find both sides

  setGameState((prev) => {
    // ANTI-BIGAMY recheck inside the updater — a same-batch double-tap (or a
    // promote racing another relationship-creating action) must not append a
    // second partner.
    if (findRomanticPartner(prev.relationships)) return prev;
    const s = ensureSpark(prev);
    const newRelationship = {
      id: relationshipId,
      name: profile.name,
      type: 'partner' as const,
      relationshipScore: 55, // matched + chatted enough to escalate
      personality: profile.personality,
      gender: profile.gender,
      age: profile.age,
      income: profile.income,
      job: profile.job,
      datesCount: 0,
    };

    return {
      ...prev,
      sparkApp: {
        ...s,
        matches: s.matches.map((m) => (m.id === matchId ? { ...m, promoted: true } : m)),
      },
      relationships: [...(prev.relationships ?? []), newRelationship],
    };
  });

  return {
    success: true,
    message: `You and ${profile.name} are now officially dating`,
    relationshipId,
  };
};

// ─────────────────────────────────────────────────────────────────────
// Premium subscription
// ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to Spark Premium (Plus / Ultra) as an IN-GAME cash subscription
 * (NOT a real IAP). Debits `stats.money` immediately via the canonical
 * `applyMoneyDelta` (overdraft-reject + NaN-guard) in the same updater that
 * grants the tier perks, and records the weekly price so the tick can auto-renew
 * it (applySubscriptionsForWeek).
 *
 * - plan 'weekly': charge the weekly fee now; auto-renews weekly on the tick.
 * - plan 'annual': charge the discounted 52-week prepay now; weekly billing is
 *   skipped until the prepaid term ends, then normal weekly auto-renew resumes.
 *
 * Returns `{ success:false }` with a clear message when the player can't afford it.
 */
export const subscribeSparkPremium = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  tier: 'plus' | 'ultra',
  plan: InGameSubscriptionPlan = 'weekly',
): { success: boolean; message: string } => {
  const price = plan === 'annual' ? SPARK_TIER_PRICING[tier].annual : SPARK_TIER_PRICING[tier].weekly;
  const tierLabel = tier === 'ultra' ? 'Ultra' : 'Plus';
  let result: { success: boolean; message: string } = {
    success: false,
    message: `You can't afford Spark ${tierLabel} ($${price.toLocaleString()}).`,
  };
  setGameState((prev) => {
    // Charge in-game cash atomically (overdraft-reject) in the same updater that
    // grants the perks.
    const spend = applyMoneyDelta(prev, -price, `Spark ${tier} (${plan})`);
    if (!spend) return prev; // unaffordable → reject; keep default failure message
    const s = ensureSpark(prev);
    const ws = prev.weeksLived ?? 0;
    const tierRank = (t: SparkPremiumTier) => (t === 'ultra' ? 2 : t === 'plus' ? 1 : 0);
    const peak = tierRank(s.lifetimeStats.peakPremiumTier) >= tierRank(tier)
      ? s.lifetimeStats.peakPremiumTier
      : tier;

    result = {
      success: true,
      message:
        plan === 'annual'
          ? `Spark ${tierLabel} active — $${price.toLocaleString()} for 52 weeks.`
          : `Spark ${tierLabel} active — $${price}/week.`,
    };
    return {
      ...prev,
      ...spend,
      sparkApp: {
        ...s,
        premium: {
          active: true,
          tier,
          plan,
          weeklyPrice: SPARK_TIER_PRICING[tier].weekly,
          startedWeek: ws,
          paidThroughWeek: plan === 'annual' ? ws + 52 : undefined,
          subscribedTimestamp: Date.now(),
          perks: perksForTier(tier),
        } as SparkPremium,
        lifetimeStats: { ...s.lifetimeStats, peakPremiumTier: peak },
      },
    };
  });
  return result;
};

export const cancelSparkPremium = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
): void => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    return {
      ...prev,
      sparkApp: {
        ...s,
        premium: {
          ...s.premium,
          active: false,
          tier: 'free',
          perks: perksForTier('free'),
        },
      },
    };
  });
};

// ─────────────────────────────────────────────────────────────────────
// Boost
// ─────────────────────────────────────────────────────────────────────

export const boostProfile = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): { success: boolean; message: string } => {
  if ((gameState.stats?.gems ?? 0) < BOOST_GEM_COST) {
    return { success: false, message: `Need ${BOOST_GEM_COST} gems to boost` };
  }
  const weeksLived = gameState.weeksLived ?? 0;
  setGameState((prev) => {
    // H-8 (R8): debit gems INSIDE the grant updater and reject on insufficient
    // funds. updateStats clamps gems to >=0 (it never rejects), so the prior
    // grant-then-charge let two rapid taps both grant the boost while gems
    // floored at 0 — a gem-duplication / free-boost exploit.
    if ((prev.stats?.gems ?? 0) < BOOST_GEM_COST) {
      return prev;
    }
    const s = ensureSpark(prev);
    return {
      ...prev,
      stats: { ...prev.stats, gems: (prev.stats.gems ?? 0) - BOOST_GEM_COST },
      sparkApp: {
        ...s,
        boost: { active: true, expiresWeek: weeksLived + BOOST_DURATION_WEEKS },
      },
    };
  });
  return { success: true, message: `Boosted for ${BOOST_DURATION_WEEKS} week` };
};

// ─────────────────────────────────────────────────────────────────────
// Catfish
// ─────────────────────────────────────────────────────────────────────

export const reportProfile = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  profileId: string,
): { success: boolean; message: string } => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (s.reportedIds.includes(profileId)) return prev;
    return {
      ...prev,
      sparkApp: {
        ...s,
        reportedIds: [...s.reportedIds, profileId],
        matches: s.matches.filter((m) => m.profileId !== profileId),
      },
    };
  });
  return { success: true, message: 'Profile reported and unmatched' };
};

export const exposeCatfish = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  profileId: string,
): { success: boolean; message: string; reputationGain: number } => {
  const weeksLived = gameState.weeksLived ?? 0;
  const reputationGain = 5;

  // ANTI-EXPLOIT (H-8/H-9 class): the outer call may fire twice in one React
  // batch. Without a dedup re-check inside the updater, both taps appended a
  // duplicate catfishRecord + bumped totalCatfishExposed, and the trailing
  // updateStats double-granted reputation for one catfish. Re-check FRESH state
  // and skip the reputation leg when the duplicate is rejected.
  let applied = false;
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (s.catfishRecords.some((r) => r.profileId === profileId && r.outcome === 'exposed')) {
      return prev;
    }
    applied = true;
    return {
      ...prev,
      sparkApp: {
        ...s,
        catfishRecords: [
          ...s.catfishRecords,
          { profileId, exposedAtWeek: weeksLived, outcome: 'exposed' },
        ],
        matches: s.matches.filter((m) => m.profileId !== profileId),
        lifetimeStats: {
          ...s.lifetimeStats,
          totalCatfishExposed: s.lifetimeStats.totalCatfishExposed + 1,
        },
      },
    };
  });
  if (!applied) {
    return { success: false, message: 'You already exposed this catfish.', reputationGain: 0 };
  }
  updateStats(setGameState, { reputation: reputationGain });
  return {
    success: true,
    message: `Catfish exposed — +${reputationGain} reputation`,
    reputationGain,
  };
};

export const dismissCatfishSuspicion = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  profileId: string,
): void => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (s.dismissedCatfishIds.includes(profileId)) return prev;
    return {
      ...prev,
      sparkApp: { ...s, dismissedCatfishIds: [...s.dismissedCatfishIds, profileId] },
    };
  });
};

/**
 * The player fell for a catfish scam. Loses money and gets logged.
 * Triggered when the player goes on a date with a catfish profile.
 */
export const fallForCatfish = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  profileId: string,
  moneyLost: number,
): void => {
  const weeksLived = gameState.weeksLived ?? 0;
  // ANTI-DOUBLE-CHARGE (mirrors exposeCatfish): the Alert "Send money" button can
  // fire twice in one React batch; without a fresh-state re-check both taps append
  // a record AND both trailing updateMoney calls debit the loss (charging twice).
  // Skip the money/reputation legs when the duplicate is rejected.
  let applied = false;
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (s.catfishRecords.some((r) => r.profileId === profileId && r.outcome === 'fell_for_it' && r.exposedAtWeek === weeksLived)) {
      return prev;
    }
    applied = true;
    return {
      ...prev,
      sparkApp: {
        ...s,
        catfishRecords: [
          ...s.catfishRecords,
          { profileId, exposedAtWeek: weeksLived, outcome: 'fell_for_it', moneyLost },
        ],
      },
    };
  });
  if (!applied) return;
  updateMoney(setGameState, -moneyLost, 'Spark catfish scam');
  updateStats(setGameState, { reputation: -2 });
};

// ─────────────────────────────────────────────────────────────────────
// Jealousy
// ─────────────────────────────────────────────────────────────────────

export const resolveJealousy = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  outcome: SparkJealousyOutcome,
): { success: boolean; message: string; reputationDelta: number; relationshipDelta: number } => {
  const event = gameState.sparkApp?.activeJealousy;
  if (!event) {
    return { success: false, message: 'No active jealousy event', reputationDelta: 0, relationshipDelta: 0 };
  }
  const weeksLived = gameState.weeksLived ?? 0;

  // Outcome → effects table
  const effects: Record<SparkJealousyOutcome, { rep: number; rel: number; msg: string }> = {
    admitted: { rep: -3, rel: -20, msg: 'You came clean. They were hurt but appreciate the honesty.' },
    denied: { rep: -1, rel: -10, msg: 'You denied it. They aren\'t fully convinced.' },
    caught_cheating: { rep: -8, rel: -45, msg: 'They caught you red-handed.' },
    confronted: { rep: 0, rel: -5, msg: 'You confronted them about being controlling. Tense.' },
    dismissed: { rep: -2, rel: -15, msg: 'You brushed off their concern. They\'re skeptical.' },
  };
  const { rep, rel, msg } = effects[outcome];

  let applied = false;
  setGameState((prev) => {
    // Re-check against prev: a same-batch double-tap must not apply the
    // relationship / history / stat effects twice (the first tap clears the
    // event). Mirrors the exposeCatfish guard.
    const active = prev.sparkApp?.activeJealousy;
    if (!active) return prev;
    applied = true;
    const s = ensureSpark(prev);
    const resolvedEvent = { ...active, resolved: true, outcome };
    const relationships = (prev.relationships ?? []).map((r) =>
      r.id === active.partnerId
        ? { ...r, relationshipScore: Math.max(0, (r.relationshipScore ?? 0) + rel) }
        : r,
    );

    return {
      ...prev,
      sparkApp: {
        ...s,
        activeJealousy: null,
        jealousyHistory: [...s.jealousyHistory, resolvedEvent].slice(-JEALOUSY_HISTORY_CAP),
        lifetimeStats: {
          ...s.lifetimeStats,
          totalJealousyEvents: s.lifetimeStats.totalJealousyEvents + 1,
        },
      },
      relationships,
    };
  });

  // Gate the trailing reputation dispatch on whether the update actually applied
  // so a no-op second tap doesn't double-hit reputation.
  if (!applied) {
    return { success: false, message: 'No active jealousy event', reputationDelta: 0, relationshipDelta: 0 };
  }
  if (rep !== 0) updateStats(setGameState, { reputation: rep });
  log.info(`Jealousy resolved with ${outcome} (rep ${rep}, rel ${rel}) at week ${weeksLived}`);
  return { success: true, message: msg, reputationDelta: rep, relationshipDelta: rel };
};
