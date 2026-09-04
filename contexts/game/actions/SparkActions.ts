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
import { applyStatsDelta } from './StatsActions';
import { applyMoneyDelta } from './MoneyActions';
import { makeLifeRoll } from '@/utils/seededRoll';
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
import {
  clampRapport,
  findConversationOption,
  findDateVenue,
  listConversationOptions,
  listDateVenues,
  playerAppeal,
  readRapport,
  resolveConversationOption,
  resolveOptionAvailability,
  type SparkConversationOptionId,
  type SparkDateVenueId,
} from '@/lib/spark/conversation';

const log = logger.scope('SparkActions');

const SWIPE_HISTORY_CAP = 200;
const MESSAGE_HISTORY_CAP = 100;
const JEALOUSY_HISTORY_CAP = 50;
const BOOST_GEM_COST = 50;
const BOOST_DURATION_WEEKS = 1;
// Fresh "liked you" entries granted immediately on Boost purchase — a tangible,
// on-screen payoff so the 50-gem spend visibly does something right away.
const BOOST_LIKED_YOU_BONUS = 3;
// Exported so SwipeScreen's confirm dialog can quote the real price.
export const REWIND_GEM_COST = 20;

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

/** Every field of a fresh sparkApp slice, as its own object per call. */
function sparkDefaults(): NonNullable<GameState['sparkApp']> {
  return (
    {
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

/** Drop explicitly-undefined keys so a spread can't punch holes in the defaults. */
function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * The sparkApp slice, guaranteed complete.
 *
 * This used to be `prev.sparkApp ?? defaults` — all-or-nothing, so a
 * PRESENT-but-partial slice (CloudSync merge, hand-edit, a save written before a
 * field existed) passed straight through with its holes intact, and every
 * consumer that read a sub-field without a guard threw. repairGameState backfills
 * the same fields on load, but repair only runs at the load boundary; the fix
 * belongs in the helper every action already calls (2026-07-07 lesson), so a
 * partial slice reaching an action mid-session is healed too.
 */
function ensureSpark(prev: GameState): NonNullable<GameState['sparkApp']> {
  const defaults = sparkDefaults();
  const sp = prev.sparkApp;
  if (!sp) return defaults;
  return {
    ...defaults,
    ...definedOnly(sp),
    profile: { ...defaults.profile, ...definedOnly(sp.profile ?? {}) },
    premium: sp.premium
      ? { ...defaults.premium, ...definedOnly(sp.premium), perks: sp.premium.perks ?? perksForTier(sp.premium.tier ?? 'free') }
      : defaults.premium,
    lifetimeStats: { ...defaults.lifetimeStats, ...definedOnly(sp.lifetimeStats ?? {}) },
  };
}

/**
 * Ids that are a function of the LIFE, not the wall clock (Program 14).
 *
 * These were `${prefix}-${Date.now()}-${Math.random()}`, and every one of them
 * is written into the save: replaying the same life produced a different set of
 * match and message ids, which is what a deep diff of two identical persona
 * runs surfaced after the NPC-goal and memory-id fixes. `Math.random()` in an
 * action module is the same defect CLAUDE.md §4.3 names on the tick.
 *
 * A match id is now `spm-<profileId>`, which is not merely deterministic but
 * CORRECT: a life can hold at most one match per dating profile (the swipe path
 * and the like-back path both reuse an existing match rather than minting a
 * second), so the profile IS the identity. `promoteMatchToRelationship` already
 * relies on that one-match-per-person rule.
 */
function matchIdFor(profileId: string): string {
  return `spm-${profileId}`;
}

/** A message id unique within its thread: the week it was sent plus its index. */
function messageIdFor(prefix: string, matchId: string, weeksLived: number, index: number): string {
  return `${prefix}-${matchId}-w${weeksLived}-${index}`;
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
    return { success: false, message: 'Out of swipes this week - upgrade to Plus for unlimited' };
  }

  const isSuper = direction === 'super';
  if (isSuper && superLikesRemaining(gameState) <= 0) {
    return { success: false, message: 'Out of super-likes this week - upgrade for more' };
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

  // Catfish suspicion - same deterministic seed per save/profile.
  const lineageSeed = gameState.lineageId ?? 'initial';
  const catfishSuspected = isCatfish(profile, lineageSeed);

  // P1-5: mint the match id OUTSIDE the updater so we can return it. The UI
  // previously read the "last match" from the stale closure gameState, which on
  // the first match was undefined → "Conversation not found", and on later
  // matches opened the wrong chat.
  const newMatchId = matched ? matchIdFor(profile.id) : undefined;

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
    // which nothing wrote to - so they were permanently stuck at 0. Append the
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

  // Optional-chain: a legacy/partial `sparkApp` present but lacking `premium`
  // (the exact shape dc3e337 fixed for scorePlayerProfile) would otherwise throw
  // "Cannot read properties of undefined (reading 'perks')" on tapping Rewind.
  const isPremium = sp.premium?.perks?.rewindLastSwipe ?? false;
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

/**
 * FREE-TEXT CHAT IS GONE (v45).
 *
 * `sendSparkMessage` (a 2-energy free-text send) and `generateNpcReply` (its
 * ~1.8s delayed auto-reply) used to live here and were called by ChatScreen's
 * composer. The owner asked for OPTIONS instead of typing, so the composer was
 * removed and both functions lost their only caller.
 *
 * They are deleted rather than left exported, for two reasons beyond tidiness.
 * `sendSparkMessage` charged its energy in a SECOND `setGameState` after the
 * message updater - the gate-then-grant shape CLAUDE.md §4.4 exists to stop -
 * and neither function touched rapport, so anything still calling them would
 * write messages into a thread the conversation engine then reasons about as
 * if they had never happened.
 *
 * The replacement is `playConversationOption` below: one updater, rapport
 * aware, cooldown stamped.
 *
 * `lib/dating/npcReplyPool.ts` went with them (2026-08-17). It was the reply
 * catalog those two functions read, so once they were deleted nothing in
 * production referenced it - the only remaining importer was its own
 * coverage test, which enforced a per-personality pool for a module no screen
 * could reach and would have failed CI the next time a personality was added
 * to `DATING_PROFILES`. A gate on dead code is a trap, not protection. Its
 * successor is `lib/spark/conversationContent.ts`, where every line the chat
 * can say now lives, keyed by TONE rather than by personality so a new
 * personality cannot fall through to an empty pool.
 */

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
 * the player, liking back is a guaranteed instant match - mirrors
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
  // Optional-chain: a legacy/partial `sparkApp` lacking `premium` would throw
  // on `.perks` (same class as dc3e337) when tapping a Liked-You entry.
  if (!sp.premium?.perks?.seeWhoLikedYou) {
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
  const matchId = existingMatch ? existingMatch.id : matchIdFor(profileId);

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
 * The whole match → partner decision, as a PURE function of a state snapshot.
 *
 * Extracted so there is exactly one place that knows the anti-bigamy rule and
 * exactly one place that knows what a promoted match looks like. Two callers
 * need it and they need it at different moments:
 *
 *   - `promoteMatchToRelationship` (the bare API — see its own note) calls it
 *     once outside the updater for the message it reports, and again inside
 *     against `prev` as the same-batch race guard.
 *   - `playConversationOption`'s `go_steady` move needs the promotion to land
 *     in the SAME updater that charges the energy and appends the two chat
 *     messages (CLAUDE.md §4.4). Dispatching a second time would have opened a
 *     real hole: a double tap whose first roll MISSED and second roll LANDED
 *     could promote without ever paying, because the charge updater rejects on
 *     cooldown while a separate promote dispatch would not.
 *
 * Returning the next state rather than mutating keeps it composable — the
 * conversation path feeds it a state that already carries the charges.
 */
/**
 * Is this profile ALREADY somebody in the player's life?
 *
 * A promoted match shares its id with the relationship it creates, so "have I
 * promoted this MATCH?" was the only guard both promotion paths had. That is
 * not the same question. `unmatch` (reachable from `PartnerProfileScreen`)
 * removes the match and leaves the relationship standing, so swiping the same
 * profile again in a later week produces a NEW match id — which walked straight
 * past the id guard and appended a SECOND relationship for the same person.
 *
 * Measured: two records both named "Sarah Johnson", each counting toward
 * `social_butterfly` (10 friends, 25 gems), `social_celebrity` (25 friends, 75
 * gems) and `strongRelationshipCount`, which the goal engine reads as social
 * emphasis. Duplicated social state, gems for a person met once.
 *
 * The right key is the PERSON. Relationships created from a Spark match record
 * the profile's own name, so matching on it catches both the friend path and
 * the partner path, and it keeps working for a relationship whose match was
 * unmatched years earlier — which is exactly the case the id guard misses.
 */
function profileAlreadyKnown(state: GameState, profileId: string): string | null {
  const profile = findProfile(profileId);
  if (!profile) return null;
  const known = (state.relationships ?? []).some(
    (r) => r && r.name === profile.name && r.type !== 'parent' && r.type !== 'child',
  );
  return known ? profile.name : null;
}

export function resolveMatchPromotion(
  prev: GameState,
  matchId: string,
):
  | { ok: true; next: GameState; relationshipId: string; partnerName: string }
  | { ok: false; message: string } {
  const s = ensureSpark(prev);
  const match = s.matches.find((m) => m.id === matchId);
  if (!prev.sparkApp || !match) return { ok: false, message: 'Match not found' };
  if (match.promoted) return { ok: false, message: 'Already dating this person' };
  // ANTI-BIGAMY: exclusivity — can't start dating while already with someone
  // (same rule + message style as SocialActionsContext.startDating).
  const existingPartner = findRomanticPartner(prev.relationships);
  if (existingPartner) {
    return { ok: false, message: `You are already with ${existingPartner.name}.` };
  }
  const profile = findProfile(match.profileId);
  if (!profile) return { ok: false, message: 'Profile no longer exists' };
  // The person, not the match — see `profileAlreadyKnown`.
  const known = profileAlreadyKnown(prev, match.profileId);
  if (known) return { ok: false, message: `${known} is already in your contacts.` };

  const relationshipId = match.id; // share the id so future ops can find both sides
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
    ok: true,
    relationshipId,
    partnerName: profile.name,
    next: {
      ...prev,
      sparkApp: {
        ...s,
        matches: s.matches.map((m) => (m.id === matchId ? { ...m, promoted: true } : m)),
      },
      relationships: [...(prev.relationships ?? []), newRelationship],
    },
  };
}

/**
 * Promote a Spark match into a full `Relationship` (partner). Required
 * before the player can go on dates, give gifts, or propose via the
 * existing DatingActions. The match remains in `sparkApp.matches` flagged
 * `promoted: true` so the chat history stays accessible.
 *
 * NO UI CALLS THIS TODAY, deliberately. ChatScreen's header heart used to, and
 * that made it a free instant promotion sitting next to the `go_steady` chip,
 * which costs 5 energy, needs 75 rapport and can be refused - the gate was
 * decoration as long as an ungated door stood beside it. The heart now plays
 * `go_steady` through `playConversationOption` like the chip does.
 *
 * This stays exported as the bare promotion API - one dispatch, no rapport
 * economy - for a future surface that legitimately has no conversation behind
 * it (a story event, a scenario setup). Anything player-facing that represents
 * "ask them out" must go through the conversation path instead, or it
 * re-creates the same bypass.
 */
export const promoteMatchToRelationship = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  matchId: string,
): { success: boolean; message: string; relationshipId?: string } => {
  const preview = resolveMatchPromotion(gameState, matchId);
  if (!preview.ok) return { success: false, message: preview.message };

  setGameState((prev) => {
    // Re-resolved against `prev`, not the snapshot above - a same-batch
    // double-tap (or a promote racing another relationship-creating action)
    // must not append a second partner.
    const committed = resolveMatchPromotion(prev, matchId);
    return committed.ok ? committed.next : prev;
  });

  return {
    success: true,
    message: `You and ${preview.partnerName} are now officially dating`,
    relationshipId: preview.relationshipId,
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
/**
 * Promote a Spark match into a **friend**.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "Cannot make any friends. Mom Dad children
 * and spouse are all that's available. You can match with as many people as you
 * want on Spark but only the first one is a contact."
 *
 * Both halves of that were one gap. `'friend'` is a declared `Relationship`
 * type read in at least six places - `lib/contacts/aggregator.ts`,
 * `ContactsApp`, `lib/social/npcDepth.ts` (goals, wants, gift preferences, and
 * a `meet_friends` want that lists `'friend'` among its target types),
 * `SocialActionsContext`, `prestigeExecution`'s heir cleanup - and it was
 * created by **nothing**. A repo-wide search for `type: 'friend'` in non-test
 * source returned no results. Every one of those consumers was dead code, and
 * `ContactsApp`'s empty state advertised a verb ("Date, befriend, or build
 * family ties") the game did not implement.
 *
 * The second half follows: `promoteMatchToRelationship` is the ONLY producer of
 * relationships anywhere, and its anti-bigamy guard correctly refuses a second
 * partner - so once one match was promoted, every other match had nowhere to
 * go. That guard is right and stays; what was missing is the other destination.
 *
 * Deliberately NOT gated on exclusivity: a player may have any number of
 * friends, and a friend costs nothing to hold. The idempotence guard is
 * ownership of the match, not a global count.
 *
 * The relationship's `type` is the single source of truth for what a promoted
 * match became - `SparkMatch.promoted` stays a plain boolean and the UI reads
 * the type off `relationships`. That keeps this out of the save format
 * entirely: no new field, no migration, no STATE_VERSION bump.
 */
export const promoteMatchToFriend = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  matchId: string,
): { success: boolean; message: string; relationshipId?: string } => {
  const sp = gameState.sparkApp;
  const match = sp?.matches.find((m) => m.id === matchId);
  if (!sp || !match) return { success: false, message: 'Match not found' };
  if (match.promoted) return { success: false, message: 'Already in your contacts' };
  const profile = findProfile(match.profileId);
  if (!profile) return { success: false, message: 'Profile no longer exists' };

  const relationshipId = match.id; // shared id, same as the partner path

  // Already a contact under this id - the OUTER mirror of the updater's second
  // guard. Without it the refusal could only be reported by reading a variable
  // back across the updater boundary.
  if ((gameState.relationships ?? []).some((r) => r?.id === relationshipId)) {
    return { success: false, message: 'Already in your contacts' };
  }
  // ...and already a contact as a PERSON, which the id cannot see once the
  // original match has been unmatched. See `profileAlreadyKnown`.
  const knownAs = profileAlreadyKnown(gameState, match.profileId);
  if (knownAs) return { success: false, message: `${knownAs} is already in your contacts` };

  /**
   * The pessimistic capture that used to live here was REMOVED on 2026-08-15.
   *
   * `updaterResultRatchet.test.ts` recommended it at the time, on the premise
   * that it was the fixed shape. It is not: a captured value is only readable
   * for the FIRST functional update of a React batch, so on any deferred
   * dispatch this reported "Already in your contacts" for a friendship it had
   * just created. That ratchet's premise - and its recommendation - have since
   * been corrected.
   *
   * Both guards below now mirror an outer one, so they are same-batch RACE
   * protection for STATE and the report has no timing dependency.
   */
  setGameState((prev) => {
    // Re-check against `prev`, not the snapshot above: two taps in one React
    // batch would otherwise append the same person twice (CLAUDE.md §4.4).
    const s = ensureSpark(prev);
    const stillUnpromoted = s.matches.find((m) => m.id === matchId && !m.promoted);
    if (!stillUnpromoted) return prev;
    if ((prev.relationships ?? []).some((r) => r?.id === relationshipId)) return prev;
    if (profileAlreadyKnown(prev, match.profileId)) return prev;

    const newRelationship = {
      id: relationshipId,
      name: profile.name,
      type: 'friend' as const,
      // Below the 55 a promoted partner starts at: you have chatted, not dated.
      // Also comfortably above NEGLECT_THRESHOLD, so a brand-new friend is not
      // immediately "at risk".
      relationshipScore: 45,
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

  return { success: true, message: `${profile.name} is now a friend`, relationshipId };
};

// ─────────────────────────────────────────────────────────────────────
// Choice-driven conversation (v45)
// ─────────────────────────────────────────────────────────────────────

/**
 * What a promoted match became - read off the relationship it created, which is
 * the single source of truth (`SparkMatch.promoted` is a plain boolean, so
 * friend and partner look identical there). A promoted match shares its id with
 * its relationship, so this is a lookup and not a search.
 *
 * `undefined` for an un-promoted match, and also for a promoted one whose
 * relationship is gone (a breakup removes it) - the caller degrades to generic
 * copy rather than guessing.
 */
const promotionKindOf = (
  state: GameState,
  matchId: string,
): 'partner' | 'friend' | undefined => {
  const rel = (state.relationships ?? []).find((r) => r?.id === matchId);
  if (!rel) return undefined;
  return rel.type === 'friend' ? 'friend' : 'partner';
};

/** Everything ChatScreen needs to draw the option panel, in one read. */
export interface SparkConversationView {
  rapport: number;
  options: ReturnType<typeof listConversationOptions>;
}

/**
 * Assemble the conversation gate input from a `GameState`.
 *
 * Lives here rather than in the screen so the UI and the action agree on what
 * "available" means by construction - the disabled reason a chip shows is
 * produced by the same call the action re-checks against `prev`.
 */
export const getSparkConversationView = (
  gameState: GameState,
  matchId: string,
): SparkConversationView | null => {
  const sp = gameState.sparkApp;
  const match = sp?.matches?.find((m) => m.id === matchId);
  if (!sp || !match) return null;
  const rapport = readRapport(match);
  return {
    rapport,
    options: listConversationOptions({
      rapport,
      energy: gameState.stats?.energy ?? 0,
      money: gameState.stats?.money ?? 0,
      weeksLived: gameState.weeksLived ?? 0,
      cooldowns: match.conversationCooldowns,
      messageCount: sp.messages?.[matchId]?.length ?? 0,
      promoted: Boolean(match.promoted),
      promotedAs: promotionKindOf(gameState, matchId),
    }),
  };
};

export interface PlayConversationResult {
  success: boolean;
  message: string;
  /** Present only when the move was actually played. */
  outcome?: 'success' | 'miss';
  /**
   * NO `rapport` FIELD ON PURPOSE. It used to be reported here from the
   * pre-dispatch resolution, while the value actually COMMITTED is recomputed
   * from `prev` inside the updater - so the two could disagree on any queued
   * second change. Nothing read it (the screen renders rapport from
   * `getSparkConversationView`, which reads the committed state), so it was a
   * wrong number nobody was looking at. Read rapport from state, not from here.
   */
  /** Set when a `go_steady` landed - the caller opens the partner profile. */
  relationshipId?: string;
}

/**
 * Play one conversation option.
 *
 * ALL state movement lands in ONE `setGameState` updater (CLAUDE.md §4.4):
 * the energy charge, the cash charge for a date, the rapport change, the
 * cooldown stamp, both chat messages, the unread counters, the
 * `totalDatesGoneOn` increment and - for `go_steady` - the promotion itself.
 * The updater re-resolves the gate against `prev` and returns `prev` unchanged
 * to reject, so a double tap in one React batch charges once.
 *
 * The COOLDOWN stamp is what makes that work in general: every option carries a
 * cooldown of at least one game week, so the second updater of a batch sees the
 * option already played this week and bails before touching money or energy.
 *
 * The outcome is rolled OUTSIDE the updater (`resolveConversationOption`),
 * because an updater must be pure and may run twice. A resolution whose commit
 * is rejected is simply discarded - nothing was charged and nothing was said.
 *
 * Both messages are appended together rather than paced by a timer. The UI can
 * animate the reveal if it wants; the state must not depend on a timer that a
 * screen unmount can cancel mid-transaction.
 */
export const playConversationOption = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  matchId: string,
  optionId: SparkConversationOptionId,
  venueId?: SparkDateVenueId,
  /**
   * The outcome and reply-copy draw. Defaults to the LIFE-and-WEEK stream, not
   * `Math.random` (Program 14).
   *
   * `Math.random` was the default and every caller took it, so how a
   * conversation went - whether the move landed, and which of several replies
   * came back - was unreproducible: this was the last field to diverge when the
   * romance persona was replayed, and it is a save-scum reroll besides (a
   * failed flirt could be retried by reloading). Keyed on the match and the
   * option, so two different moves in the same week roll independently while
   * the same move in the same week always answers the same. The cooldown map
   * (v45) is what re-arms it.
   */
  rand?: () => number,
): PlayConversationResult => {
  const sp = gameState.sparkApp;
  const match = sp?.matches?.find((m) => m.id === matchId);
  if (!sp || !match) return { success: false, message: 'Match not found' };
  const profile = findProfile(match.profileId);
  if (!profile) return { success: false, message: 'Profile no longer exists' };
  const seededRand = rand ?? (() => {
    const stream = makeLifeRoll(gameState, gameState.weeksLived ?? 0);
    return stream(`spark-move:${matchId}:${optionId}:${venueId ?? ''}`);
  });

  const option = findConversationOption(optionId);
  if (!option) return { success: false, message: 'That is not something you can say' };

  // The generic gate below prices a date at its CHEAPEST venue, so the CHOSEN
  // venue is checked separately and FIRST. Without this, picking dinner with
  // coffee money passed the outer gate, resolved an outcome, and was then
  // rejected inside the updater by `applyMoneyDelta` - reporting success while
  // nothing happened.
  if (option.requiresVenue) {
    const venue = findDateVenue(venueId);
    if (!venue) return { success: false, message: 'Pick where you are taking them first' };
    const row = listDateVenues(
      { energy: gameState.stats?.energy ?? 0, money: gameState.stats?.money ?? 0 },
      option,
    ).find((v) => v.venue.id === venue.id);
    if (row && !row.available) {
      return { success: false, message: row.reason ?? 'You cannot afford that date' };
    }
  }

  const weeksLived = gameState.weeksLived ?? 0;
  const gate = resolveOptionAvailability(option, {
    rapport: readRapport(match),
    energy: gameState.stats?.energy ?? 0,
    money: gameState.stats?.money ?? 0,
    weeksLived,
    cooldowns: match.conversationCooldowns,
    messageCount: sp.messages?.[matchId]?.length ?? 0,
    promoted: Boolean(match.promoted),
    promotedAs: promotionKindOf(gameState, matchId),
  });
  if (!gate.available) {
    return { success: false, message: gate.reason ?? 'Not right now' };
  }

  const resolution = resolveConversationOption({
    optionId,
    venueId,
    rapport: readRapport(match),
    profile: {
      name: profile.name,
      personality: profile.personality,
      interests: profile.interests,
    },
    appeal: playerAppeal(gameState.stats),
    rand: seededRand,
  });
  if (!resolution) return { success: false, message: 'Not right now' };

  // The anti-bigamy refusal is reported BEFORE anything is charged, from the
  // one authority (`resolveMatchPromotion`). Without this the player would pay
  // 5 energy for a proposal that could never have been accepted.
  if (optionId === 'go_steady' && resolution.success) {
    const preview = resolveMatchPromotion(gameState, matchId);
    if (!preview.ok) return { success: false, message: preview.message };
  }

  const threadLengthBefore = (sp.messages[matchId] ?? []).length;
  const playerMsgId = messageIdFor('spmsg', matchId, gameState.weeksLived ?? 0, threadLengthBefore);
  const npcMsgId = messageIdFor('spnpc', matchId, gameState.weeksLived ?? 0, threadLengthBefore + 1);
  const now = Date.now();

  setGameState((prev) => {
    const s = ensureSpark(prev);
    const m = s.matches.find((x) => x.id === matchId);
    if (!m) return prev;

    // Re-gate against `prev`. This is the same call the UI used to draw the
    // chip, so the two cannot drift - and on a same-batch second tap the
    // cooldown stamped by the first updater fails it here.
    const fresh = resolveOptionAvailability(option, {
      rapport: readRapport(m),
      energy: prev.stats?.energy ?? 0,
      money: prev.stats?.money ?? 0,
      weeksLived: prev.weeksLived ?? 0,
      cooldowns: m.conversationCooldowns,
      messageCount: (s.messages[matchId] ?? []).length,
      promoted: Boolean(m.promoted),
      promotedAs: promotionKindOf(prev, matchId),
    });
    if (!fresh.available) return prev;

    // `resolveOptionAvailability` prices a date at its CHEAPEST venue, so the
    // actual configuration is checked here against `prev` as well.
    if ((prev.stats?.energy ?? 0) < resolution.energyCost) return prev;

    let next: GameState = prev;
    if (resolution.cashCost > 0) {
      const spend = applyMoneyDelta(next, -resolution.cashCost, `Spark date (${resolution.venueId})`);
      if (!spend) return prev; // funds moved since the preview - reject atomically
      next = { ...next, ...spend };
    }
    next = {
      ...next,
      ...applyStatsDelta(next, {
        energy: -resolution.energyCost,
        ...(resolution.happinessDelta !== 0 ? { happiness: resolution.happinessDelta } : {}),
      }),
    };

    const playerMsg: SparkMessage = {
      id: playerMsgId,
      matchId,
      from: 'player',
      text: resolution.playerText,
      timestamp: now,
      gameWeek: prev.weeksLived ?? 0,
    };
    const npcMsg: SparkMessage = {
      id: npcMsgId,
      matchId,
      from: 'npc',
      text: resolution.npcText,
      timestamp: now + 1,
      gameWeek: prev.weeksLived ?? 0,
    };
    const thread = [...(s.messages[matchId] ?? []), playerMsg, npcMsg].slice(-MESSAGE_HISTORY_CAP);

    // Rapport is recomputed from `prev`'s value, not carried over from the
    // pre-dispatch resolution, so a queued second change cannot be applied to a
    // stale base. `clampRapport` keeps it inside 0-100.
    const rapportAfter = clampRapport(readRapport(m) + resolution.rapportDelta);

    next = {
      ...next,
      sparkApp: {
        ...s,
        matches: s.matches.map((mm) =>
          mm.id === matchId
            ? {
                ...mm,
                rapport: rapportAfter,
                conversationCooldowns: {
                  ...(mm.conversationCooldowns ?? {}),
                  [optionId]: prev.weeksLived ?? 0,
                },
                lastMessageTimestamp: now,
                // The player is looking at the thread - both sides are read.
                unreadByPlayer: 0,
                unreadByNpc: 0,
              }
            : mm,
        ),
        messages: { ...s.messages, [matchId]: thread },
        lifetimeStats: {
          ...s.lifetimeStats,
          totalDatesGoneOn:
            s.lifetimeStats.totalDatesGoneOn + (resolution.countsAsDate ? 1 : 0),
        },
      },
    };

    // go_steady, committed in the SAME updater through the one authority.
    if (optionId === 'go_steady' && resolution.success) {
      const promo = resolveMatchPromotion(next, matchId);
      // Refusing here rejects the whole move - no charge, no messages - rather
      // than banking a proposal that was never accepted.
      if (!promo.ok) return prev;
      next = promo.next;
    }

    return next;
  });

  log.info(
    `spark conversation ${optionId}${venueId ? `/${venueId}` : ''} on ${profile.name} → ${resolution.success ? 'landed' : 'missed'}`,
  );

  return {
    success: true,
    message: resolution.npcText,
    outcome: resolution.success ? 'success' : 'miss',
    // The relationship shares the match's id by construction
    // (`resolveMatchPromotion`), so this needs no value read back out of the
    // updater - which would be unreliable for any deferred dispatch.
    relationshipId: optionId === 'go_steady' && resolution.success ? matchId : undefined,
  };
};

export const subscribeSparkPremium = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  tier: 'plus' | 'ultra',
  plan: InGameSubscriptionPlan = 'weekly',
): { success: boolean; message: string } => {
  const price = plan === 'annual' ? SPARK_TIER_PRICING[tier].annual : SPARK_TIER_PRICING[tier].weekly;
  const tierLabel = tier === 'ultra' ? 'Ultra' : 'Plus';
  // Re-entry guard: buying the tier+plan you ALREADY hold re-charges the full
  // price and (for annual) resets paidThroughWeek to now+52 rather than extending
  // it - a pure loss. Changing tier (Plus ⇄ Ultra) or plan stays allowed. Filed
  // as a non-blocking LOW by the 2026-07-16 weekly audit.
  const activePremium = gameState.sparkApp?.premium;
  if (activePremium?.active === true && activePremium.tier === tier && (activePremium.plan ?? 'weekly') === plan) {
    return {
      success: false,
      message: `Spark ${tierLabel} is already active - no need to buy it again.`,
    };
  }
  // Derive the caller-facing result from the CURRENT snapshot BEFORE dispatching.
  // setGameState is a plain (wrapped) React useState setter that may defer the
  // updater, so reading a value the updater assigns is unreliable. The atomic
  // charge+grant still lives inside the updater below (applyMoneyDelta overdraft-
  // reject), which remains the source of truth for money safety.
  if ((gameState.stats?.money ?? 0) < price) {
    return {
      success: false,
      message: `You can't afford Spark ${tierLabel} ($${price.toLocaleString()}).`,
    };
  }
  setGameState((prev) => {
    // Same re-entry guard re-checked against `prev` — two taps in one React batch
    // both read the pre-dispatch snapshot, so only this in-updater check stops the
    // second from paying twice.
    const prevPremium = prev.sparkApp?.premium;
    if (
      prevPremium?.active === true &&
      prevPremium.tier === tier &&
      (prevPremium.plan ?? 'weekly') === plan
    ) {
      return prev;
    }
    // Charge in-game cash atomically (overdraft-reject) in the same updater that
    // grants the perks.
    const spend = applyMoneyDelta(prev, -price, `Spark ${tier} (${plan})`);
    if (!spend) return prev; // funds dropped since the preview → reject atomically
    const s = ensureSpark(prev);
    const ws = prev.weeksLived ?? 0;
    const tierRank = (t: SparkPremiumTier) => (t === 'ultra' ? 2 : t === 'plus' ? 1 : 0);
    const peak = tierRank(s.lifetimeStats.peakPremiumTier) >= tierRank(tier)
      ? s.lifetimeStats.peakPremiumTier
      : tier;

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
  return {
    success: true,
    message:
      plan === 'annual'
        ? `Spark ${tierLabel} active - $${price.toLocaleString()} for 52 weeks.`
        : `Spark ${tierLabel} active - $${price}/week.`,
  };
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
    // floored at 0 - a gem-duplication / free-boost exploit.
    if ((prev.stats?.gems ?? 0) < BOOST_GEM_COST) {
      return prev;
    }
    const s = ensureSpark(prev);
    /**
     * R4-MON-3: reject if a boost is already running.
     *
     * The gems re-check above closed the flooring half, but not the double-buy:
     * a second tap in the same batch debited another BOOST_GEM_COST and then
     * rewrote `expiresWeek` to the SAME value, so 100 gems bought one week of
     * boost. CLAUDE.md §4.4.
     */
    if (s.boost?.active && (s.boost.expiresWeek ?? 0) > (prev.weeksLived ?? 0)) {
      return prev;
    }
    // Immediate visibility payoff: seed a few fresh "liked you" entries so the
    // 50-gem Boost has a tangible effect the moment it's bought (the match-rate
    // lift in calculateMatchProbability is otherwise invisible until swiping).
    // Free-tier players can't SEE who liked them, but the entries still convert
    // into matches on swipe and drive the Likes-tab count / Plus upsell teaser.
    const likedYou = [...s.likedYou];
    for (const p of DATING_PROFILES) {
      if (likedYou.length >= s.likedYou.length + BOOST_LIKED_YOU_BONUS) break;
      if (!likedYou.some((l) => l.profileId === p.id)) {
        likedYou.push({ profileId: p.id, likedAtWeek: weeksLived, superLiked: false });
      }
    }
    return {
      ...prev,
      stats: { ...prev.stats, gems: (prev.stats.gems ?? 0) - BOOST_GEM_COST },
      sparkApp: {
        ...s,
        boost: { active: true, expiresWeek: weeksLived + BOOST_DURATION_WEEKS },
        likedYou,
      },
    };
  });
  return { success: true, message: `Boosted for ${BOOST_DURATION_WEEKS} week` };
};

// ─────────────────────────────────────────────────────────────────────
// Catfish
// ─────────────────────────────────────────────────────────────────────

export const reportProfile = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  profileId: string,
): { success: boolean; message: string } => {
  // Already reported - the OUTER mirror of the updater's guard. Without one the
  // refusal was unreportable, so a second report of the same profile said
  // "Profile reported and unmatched" and did nothing.
  if ((gameState.sparkApp?.reportedIds ?? []).includes(profileId)) {
    return { success: false, message: 'You already reported this profile.' };
  }
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

  // Already exposed - the OUTER mirror of the updater's dedup guard. Without
  // one, the refusal could only be reported by reading a flag back across the
  // updater boundary, which is unreliable for any dispatch that is not first in
  // its React batch (2026-08-15).
  if ((gameState.sparkApp?.catfishRecords ?? []).some(
    (r) => r.profileId === profileId && r.outcome === 'exposed',
  )) {
    return { success: false, message: 'You already exposed this catfish.', reputationGain: 0 };
  }

  // ANTI-EXPLOIT (H-8/H-9 class): the outer call may fire twice in one React
  // batch, so the dedup is re-checked against FRESH state here. The reputation
  // grant folds into the SAME updater - it used to be a trailing `updateStats`
  // gated on a flag, so a deferred dispatch recorded the exposure and granted
  // no reputation at all.
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (s.catfishRecords.some((r) => r.profileId === profileId && r.outcome === 'exposed')) {
      return prev;
    }
    const withRep = { ...prev, ...applyStatsDelta(prev, { reputation: reputationGain }) };
    return {
      ...withRep,
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
  return {
    success: true,
    message: `Catfish exposed - +${reputationGain} reputation`,
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
  // fire twice in one React batch; without a fresh-state re-check both taps
  // append a record AND both debit the loss.
  //
  // The debit and the reputation hit now fold into the SAME updater. They used
  // to be trailing dispatches gated on a flag read back from here, so a
  // deferred dispatch wrote the "fell for it" record - which the Spark history
  // and lifetime stats read - while the player was never actually charged.
  setGameState((prev) => {
    const s = ensureSpark(prev);
    if (s.catfishRecords.some((r) => r.profileId === profileId && r.outcome === 'fell_for_it' && r.exposedAtWeek === weeksLived)) {
      return prev;
    }
    let next: GameState = prev;
    const debit = applyMoneyDelta(next, -moneyLost, 'Spark catfish scam');
    if (debit) next = { ...next, ...debit };
    next = { ...next, ...applyStatsDelta(next, { reputation: -2 }) };
    return {
      ...next,
      sparkApp: {
        ...s,
        catfishRecords: [
          ...s.catfishRecords,
          { profileId, exposedAtWeek: weeksLived, outcome: 'fell_for_it', moneyLost },
        ],
      },
    };
  });
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

  // The outer `!event` check above is the reported outcome; the re-check below
  // is the same-batch RACE guard. The reputation hit folds in here too - it was
  // a trailing `updateStats` gated on a flag read back after the dispatch, so a
  // deferred resolve cleared the event and skipped the reputation entirely.
  setGameState((prev) => {
    const active = prev.sparkApp?.activeJealousy;
    if (!active) return prev;
    const s = ensureSpark(prev);
    const resolvedEvent = { ...active, resolved: true, outcome };
    const relationships = (prev.relationships ?? []).map((r) =>
      r.id === active.partnerId
        ? { ...r, relationshipScore: Math.max(0, (r.relationshipScore ?? 0) + rel) }
        : r,
    );

    return {
      ...prev,
      ...(rep !== 0 ? applyStatsDelta(prev, { reputation: rep }) : {}),
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

  log.info(`Jealousy resolved with ${outcome} (rep ${rep}, rel ${rel}) at week ${weeksLived}`);
  return { success: true, message: msg, reputationDelta: rep, relationshipDelta: rel };
};
