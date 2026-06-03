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
} from '../types';
import { logger } from '@/utils/logger';
import { updateStats } from './StatsActions';
import { updateMoney } from './MoneyActions';
import {
  rollMatch,
  isCatfish,
  perksForTier,
  swipesRemaining,
  superLikesRemaining,
} from '@/lib/dating/sparkLogic';
import { DATING_PROFILES, type DatingProfile } from '@/lib/dating/datingProfiles';

const log = logger.scope('SparkActions');

const SWIPE_HISTORY_CAP = 200;
const MESSAGE_HISTORY_CAP = 100;
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
    const newMatches = matched
      ? [
          ...s.matches,
          {
            id: genId('spm'),
            profileId,
            matchedWeek: weeksLived,
            superLiked: isSuper,
            promoted: false,
          } as SparkMatch,
        ]
      : s.matches;

    return {
      ...prev,
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
          totalMatches: s.lifetimeStats.totalMatches + (matched ? 1 : 0),
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

  // Deterministic reply pool based on profile personality.
  const POOL: Record<string, string[]> = {
    adventurous: ['Sounds amazing!', 'Let\'s plan something soon 🏔', 'What\'s the wildest thing you\'ve done?'],
    ambitious: ['Always grinding. You?', 'Coffee soon?', 'I respect that.'],
    romantic: ['You seem sweet 💌', 'I\'d love to know more about you', 'Tell me about your dreams.'],
    creative: ['I love that perspective', 'You\'d like the gallery downtown', 'I\'ve been writing again — finally'],
    introverted: ['Same energy honestly.', 'Quiet night sounds perfect', 'I like that you said that.'],
    extroverted: ['When are you free?? 🎉', 'Friends are coming over Saturday — wanna join?', 'omg yes'],
    friendly: ['That made my day 🙂', 'You\'re fun to talk to', 'I was hoping you\'d message.'],
    professional: ['Interesting take.', 'Let\'s grab dinner this week.', 'Networking event Thursday — interested?'],
  };
  const pool = POOL[profile.personality] ?? POOL.friendly;
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
  const profile = findProfile(match.profileId);
  if (!profile) return { success: false, message: 'Profile no longer exists' };

  const relationshipId = match.id; // share the id so future ops can find both sides

  setGameState((prev) => {
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
      relationships: [...(prev.relationships ?? []), newRelationship as any],
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

export const subscribeSparkPremium = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  tier: 'plus' | 'ultra',
  sku: string,
  expiresTimestamp: number,
): { success: boolean; message: string } => {
  setGameState((prev) => {
    const s = ensureSpark(prev);
    const tierRank = (t: SparkPremiumTier) => (t === 'ultra' ? 2 : t === 'plus' ? 1 : 0);
    const peak = tierRank(s.lifetimeStats.peakPremiumTier) >= tierRank(tier)
      ? s.lifetimeStats.peakPremiumTier
      : tier;

    return {
      ...prev,
      sparkApp: {
        ...s,
        premium: {
          active: true,
          tier,
          subscribedTimestamp: Date.now(),
          expiresTimestamp,
          sku,
          perks: perksForTier(tier),
        } as SparkPremium,
        lifetimeStats: { ...s.lifetimeStats, peakPremiumTier: peak },
      },
    };
  });
  return { success: true, message: `Spark ${tier === 'ultra' ? 'Ultra' : 'Plus'} active` };
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

  setGameState((prev) => {
    const s = ensureSpark(prev);
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
  setGameState((prev) => {
    const s = ensureSpark(prev);
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

  setGameState((prev) => {
    const s = ensureSpark(prev);
    const resolvedEvent = { ...event, resolved: true, outcome };
    const relationships = (prev.relationships ?? []).map((r) =>
      r.id === event.partnerId
        ? { ...r, relationshipScore: Math.max(0, (r.relationshipScore ?? 0) + rel) }
        : r,
    );

    return {
      ...prev,
      sparkApp: {
        ...s,
        activeJealousy: null,
        jealousyHistory: [...s.jealousyHistory, resolvedEvent],
        lifetimeStats: {
          ...s.lifetimeStats,
          totalJealousyEvents: s.lifetimeStats.totalJealousyEvents + 1,
        },
      },
      relationships,
    };
  });

  if (rep !== 0) updateStats(setGameState, { reputation: rep });
  log.info(`Jealousy resolved with ${outcome} (rep ${rep}, rel ${rel}) at week ${weeksLived}`);
  return { success: true, message: msg, reputationDelta: rep, relationshipDelta: rel };
};
