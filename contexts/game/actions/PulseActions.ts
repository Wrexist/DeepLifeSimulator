/**
 * Pulse Actions — in-game social platform actions (v13+).
 *
 * Pattern (matches SocialActions.ts / DatingActions.ts / MoneyActions.ts):
 *   - First arg is React.Dispatch<SetStateAction<GameState>>
 *   - Mutate via setGameState(prev => ...)
 *   - Do NOT call saveGame() — the UI caller does that
 *   - Time-stamped fields use weeksLived (absolute), never the cyclic 1-4 week-of-month counter
 *
 * Coverage: composition, engagement, follow graph, scandals, brand deals,
 * live streaming, monetization (gems/IAP/ads), notifications.
 */
import React from 'react';
import { GameState } from '../types';
import type {
  PulseContentType,
  PulsePostCategory,
  PulseRecentPost,
  PulseComment,
  PulseNotification,
  PulseNotificationType,
  PulseScandalResolution,
  PulseActiveBrandDeal,
  InGameSubscriptionPlan,
} from '../types';
import { logger } from '@/utils/logger';
import { updateStats, applyStatsDelta } from './StatsActions';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import {
  calculatePostEngagement,
  calculateNewFollowersFromPost,
  calculatePostAdRevenueFull,
  checkViralChance,
  getEnergyCost,
  getHealthCost,
  getHappinessGain,
  getInfluenceLevel,
  canCreateContent,
  calculateLiveStreamDonations,
  getEngagementMultiplierFromVerifiedPro,
  VERIFIED_PRO_WEEKLY_PRICE,
  VERIFIED_PRO_ANNUAL_PRICE,
} from '@/lib/social/socialMedia';

const log = logger.scope('PulseActions');

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

function ensureSocial(prev: GameState): NonNullable<GameState['socialMedia']> {
  return (
    prev.socialMedia ?? {
      followers: 0,
      influenceLevel: 'novice',
      totalPosts: 0,
      viralPosts: 0,
      brandPartnerships: 0,
      engagementRate: 0,
    }
  );
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pushNotification(
  social: NonNullable<GameState['socialMedia']>,
  type: PulseNotificationType,
  text: string,
  weeksLived: number,
  extras: Partial<PulseNotification> = {},
): PulseNotification {
  const notification: PulseNotification = {
    id: genId('pn'),
    type,
    timestamp: Date.now(),
    gameWeek: weeksLived,
    read: false,
    text,
    ...extras,
  };
  const notifications = [notification, ...(social.notifications ?? [])].slice(0, 100);
  social.notifications = notifications;
  return notification;
}

// ─────────────────────────────────────────────────────────────────────
// Composition & engagement
// ─────────────────────────────────────────────────────────────────────

export interface ComposePostArgs {
  content: string;
  contentType: PulseContentType;
  hashtags?: string[];
  photo?: string;
  category?: PulsePostCategory;
  mentionedNpcIds?: string[];
  sponsoredByDealId?: string;
  sponsoredBrandName?: string;
}

export interface ComposePostResult {
  success: boolean;
  message: string;
  postId?: string;
  isViral?: boolean;
  followersGained?: number;
}

/**
 * Compose a new Pulse post. Spends energy/health, may go viral, may grant
 * skill XP via category mapping, registers any new hashtags as 'player'-sourced.
 */
export const composePost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  args: ComposePostArgs,
  _deps: { updateStats: typeof updateStats } = { updateStats },
): ComposePostResult => {
  const content = (args.content || '').trim();
  if (content.length === 0) {
    return { success: false, message: 'Post content cannot be empty.' };
  }

  const social = gameState.socialMedia ?? ensureSocial(gameState);
  const weeksLived = gameState.weeksLived ?? 0;
  const lastPostWeek = social.lastPostWeeks?.[args.contentType] ?? -Infinity;
  const ok = canCreateContent(
    gameState.stats.energy,
    args.contentType,
    typeof lastPostWeek === 'number' && isFinite(lastPostWeek) ? lastPostWeek : undefined,
    weeksLived,
  );
  if (!ok.canCreate) {
    return { success: false, message: ok.reason || 'Cannot post right now.' };
  }

  const isViral = checkViralChance(social.influenceLevel, args.contentType);
  const engagement = calculatePostEngagement(
    social.followers,
    args.contentType,
    isViral,
  );
  const followersGained = calculateNewFollowersFromPost(
    social.followers,
    engagement,
    isViral,
  );
  const proMultiplier = getEngagementMultiplierFromVerifiedPro(gameState);
  const adRevenue = Math.floor(
    calculatePostAdRevenueFull(
      engagement.likes,
      args.contentType,
      isViral,
      social.followers,
    ) * proMultiplier,
  );

  const postId = genId('pp');
  const newPost: PulseRecentPost = {
    id: postId,
    content,
    likes: engagement.likes,
    comments: 0,
    reposts: engagement.reposts,
    views: engagement.views,
    bookmarks: engagement.bookmarks,
    timestamp: Date.now(),
    gameWeek: weeksLived,
    contentType: args.contentType,
    category: args.category,
    photo: args.photo,
    hashtags: args.hashtags,
    isViral,
    sponsoredByDealId: args.sponsoredByDealId,
    sponsoredBrandName: args.sponsoredBrandName,
  };

  /**
   * ONE updater: the post, its stats and its ad revenue.
   *
   * The stat costs and the ad-revenue credit used to be separate
   * `updateStats` / `updateMoney` dispatches gated on a `let applied` flag read
   * back after this one. That read is only reliable for the FIRST functional
   * update of a React batch, so on a deferred dispatch the post was appended
   * and its followers/earnings recorded while the energy/health/happiness costs
   * and the cash NEVER landed — and the player was told "You already posted
   * that type this week." Folding them in makes the grant and its costs the
   * same transition (CLAUDE.md §4.4), which is also a stronger version of the
   * double-pay guard the flag was there to provide.
   */
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };

    // ANTI-EXPLOIT: re-check the per-content-type weekly cap against FRESH state.
    // The outer canCreateContent reads the stale snapshot, so two taps in one
    // batch both passed it; without this guard both appended a post and (via the
    // side-effects below) double-paid ad revenue + followers.
    const freshLast = sm.lastPostWeeks?.[args.contentType];
    if (typeof freshLast === 'number' && freshLast === weeksLived) {
      return prev;
    }

    sm.followers = (sm.followers ?? 0) + followersGained;
    sm.totalPosts = (sm.totalPosts ?? 0) + 1;
    if (isViral) sm.viralPosts = (sm.viralPosts ?? 0) + 1;
    sm.influenceLevel = getInfluenceLevel(sm.followers);
    sm.lastPostWeek = weeksLived;
    sm.lastPostWeeks = {
      ...(sm.lastPostWeeks ?? ({} as Record<PulseContentType, number>)),
      [args.contentType]: weeksLived,
    };
    sm.lastPostTimes = {
      ...(sm.lastPostTimes ?? ({} as Record<PulseContentType, number>)),
      [args.contentType]: Date.now(),
    };
    sm.recentPosts = [newPost, ...(sm.recentPosts ?? [])].slice(0, 50);
    sm.totalEarnings = (sm.totalEarnings ?? 0) + adRevenue;

    // Lifetime
    if (sm.lifetimeStats) {
      sm.lifetimeStats = {
        ...sm.lifetimeStats,
        peakFollowers: Math.max(sm.lifetimeStats.peakFollowers, sm.followers),
        peakInfluenceLevel:
          tierRank(sm.influenceLevel) > tierRank(sm.lifetimeStats.peakInfluenceLevel)
            ? sm.influenceLevel
            : sm.lifetimeStats.peakInfluenceLevel,
      };
    }

    // Register player-authored hashtags as trending
    if (args.hashtags && args.hashtags.length) {
      const existing = sm.trendingHashtags ?? [];
      const map = new Map(existing.map((t) => [t.tag.toLowerCase(), t]));
      for (const raw of args.hashtags) {
        const tag = raw.startsWith('#') ? raw : `#${raw}`;
        const key = tag.toLowerCase();
        const cur = map.get(key);
        if (cur) {
          cur.postCount += 1;
          cur.velocity = Math.min(100, cur.velocity + 5);
        } else {
          map.set(key, {
            tag,
            postCount: 1,
            source: 'player',
            velocity: 10,
            decayWeek: weeksLived + 2,
          });
        }
      }
      sm.trendingHashtags = Array.from(map.values()).slice(0, 20);
    }

    // Viral milestone notification
    if (isViral) {
      pushNotification(sm, 'milestone', `Your post went viral! +${followersGained} followers`, weeksLived, {
        refPostId: postId,
      });
    }

    // Stats & money fold in here so they cannot land without the post, and the
    // post cannot land without them.
    //
    // `lifetimeStatistics.totalPostsMade` / `totalViralPosts` had NO production
    // writer — `trackPost` in `lib/statistics/statisticsTracker.ts` was only
    // ever called from a stress test — so StatisticsApp's "Posts" counter read
    // a permanent 0 and the `viral` milestone (10 gems) was unearnable.
    // Incremented inside THIS updater, past the fresh weekly-cap guard above,
    // so a double-tapped compose cannot count a post that was refused
    // (CLAUDE.md §4.4). `socialMedia.totalPosts`/`viralPosts` are the
    // per-life counters; these are the lifetime ones the Statistics app reads.
    let next: GameState = {
      ...prev,
      socialMedia: sm,
      lifetimeStatistics: prev.lifetimeStatistics
        ? {
            ...prev.lifetimeStatistics,
            totalPostsMade: (prev.lifetimeStatistics.totalPostsMade ?? 0) + 1,
            totalViralPosts:
              (prev.lifetimeStatistics.totalViralPosts ?? 0) + (isViral ? 1 : 0),
          }
        : prev.lifetimeStatistics,
    };
    next = { ...next, ...applyStatsDelta(next, {
      energy: -getEnergyCost(args.contentType),
      health: -getHealthCost(args.contentType),
      happiness: getHappinessGain(args.contentType, isViral),
    }) };
    if (adRevenue > 0) {
      const credit = applyMoneyDelta(next, adRevenue, `Pulse: ad revenue from post`);
      if (credit) next = { ...next, ...credit };
    }
    return next;
  });

  log.info(`Composed ${args.contentType} post (viral=${isViral}, +${followersGained} followers)`);
  return {
    success: true,
    message: isViral
      ? `Your post went viral! +${followersGained} followers, +$${adRevenue}.`
      : `Posted. +${followersGained} followers.`,
    postId,
    isViral,
    followersGained,
  };
};

function tierRank(t: string): number {
  return ['novice', 'rising', 'popular', 'influencer', 'celebrity'].indexOf(t);
}

export const likePost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  postId: string,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.recentPosts = (sm.recentPosts ?? []).map((p) =>
      p.id === postId ? { ...p, isLiked: !p.isLiked, likes: p.likes + (p.isLiked ? -1 : 1) } : p,
    );
    return { ...prev, socialMedia: sm };
  });
};

export const repostPost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  postId: string,
  _deps: { updateStats: typeof updateStats } = { updateStats },
): { success: boolean; message: string } => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.recentPosts = (sm.recentPosts ?? []).map((p) =>
      p.id === postId
        ? { ...p, isReposted: !p.isReposted, reposts: (p.reposts ?? 0) + (p.isReposted ? -1 : 1) }
        : p,
    );
    return { ...prev, socialMedia: sm };
  });
  updateStats(setGameState, { energy: -2 });
  return { success: true, message: 'Reposted.' };
};

export const bookmarkPost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  postId: string,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.recentPosts = (sm.recentPosts ?? []).map((p) =>
      p.id === postId
        ? { ...p, isBookmarked: !p.isBookmarked, bookmarks: (p.bookmarks ?? 0) + (p.isBookmarked ? -1 : 1) }
        : p,
    );
    return { ...prev, socialMedia: sm };
  });
};

export const commentOnPost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  postId: string,
  content: string,
  _deps: { updateStats: typeof updateStats } = { updateStats },
): { success: boolean; message: string; commentId?: string } => {
  const trimmed = (content || '').trim();
  if (!trimmed) return { success: false, message: 'Comment cannot be empty.' };
  if (gameState.stats.energy < 3) return { success: false, message: 'Need 3 energy to comment.' };

  const weeksLived = gameState.weeksLived ?? 0;
  const commentId = genId('pc');
  const comment: PulseComment = {
    id: commentId,
    postId,
    authorId: 'player',
    authorHandle: gameState.userProfile?.handle ? `@${gameState.userProfile.handle}` : '@you',
    content: trimmed,
    likes: 0,
    timestamp: Date.now(),
    gameWeek: weeksLived,
    isPlayerComment: true,
    sentiment: 'neutral',
  };

  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const threads = { ...(sm.commentThreads ?? {}) };
    // Cap each thread to the last 50 comments so commentThreads can't grow
    // unbounded on a heavy commenter and bloat the save.
    threads[postId] = [...(threads[postId] ?? []), comment].slice(-50);
    sm.commentThreads = threads;
    // Bump parent post comment count if it's the player's own
    sm.recentPosts = (sm.recentPosts ?? []).map((p) =>
      p.id === postId ? { ...p, comments: p.comments + 1 } : p,
    );
    return { ...prev, socialMedia: sm };
  });

  updateStats(setGameState, { energy: -3, happiness: 1 });
  return { success: true, message: 'Commented.', commentId };
};

// ─────────────────────────────────────────────────────────────────────
// Follow graph
// ─────────────────────────────────────────────────────────────────────

export const followNpc = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  npcId: string,
): { success: boolean; message: string; mutualFollow?: boolean } => {
  /**
   * Already following — the OUTER mirror of the updater's guard. Without one,
   * a second tap said "Following." and did nothing.
   */
  if ((gameState.socialMedia?.followGraph?.followingNpcIds ?? []).includes(npcId)) {
    return { success: false, message: 'You already follow them.', mutualFollow: false };
  }

  /**
   * The follow-back roll happens HERE, once, not inside the updater.
   *
   * `mutualFollow` used to be assigned inside and read after — only reliable
   * for the FIRST functional update of a React batch, so a deferred dispatch
   * always reported the plain "Following." even when they followed back. Rolling
   * outside also makes the updater pure, which matters because React 19
   * StrictMode double-invokes updaters: a `Math.random()` in there could roll
   * differently on the second invocation.
   */
  const relForRoll = (gameState.relationships ?? []).find((r) => r.id === npcId);
  const followBackProb = (relForRoll?.relationshipScore ?? 0) >= 60 ? 0.95 : 0.7;
  const followsBack = Math.random() < followBackProb;
  const followerBoost = Math.floor(50 + Math.random() * 150);

  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const fg = sm.followGraph ?? { followingNpcIds: [], followedByNpcIds: [], lastUpdatedWeek: prev.weeksLived ?? 0 };
    if (fg.followingNpcIds.includes(npcId)) {
      return prev; // already following
    }
    const updated = {
      ...fg,
      followingNpcIds: [...fg.followingNpcIds, npcId],
      lastUpdatedWeek: prev.weeksLived ?? 0,
    };

    // Mutual-follow probability
    const rel = (prev.relationships ?? []).find((r) => r.id === npcId);
    if (followsBack && !updated.followedByNpcIds.includes(npcId)) {
      updated.followedByNpcIds = [...updated.followedByNpcIds, npcId];
      // ANTI-EXPLOIT: grant the one-time follower boost only the FIRST time this
      // NPC ever follows back. Re-following after an unfollow re-establishes the
      // mutual edge but must NOT re-pay the boost, otherwise a follow/unfollow
      // loop farms unlimited followers → influence → ad/brand income.
      const granted = updated.followBackGrantedNpcIds ?? [];
      if (!granted.includes(npcId)) {
        updated.followBackGrantedNpcIds = [...granted, npcId];
        // Followed back → small follower boost from their followers seeing the connection
        sm.followers = (sm.followers ?? 0) + followerBoost;
        sm.influenceLevel = getInfluenceLevel(sm.followers);
      }
      pushNotification(
        sm,
        'follow',
        `${rel?.name ?? 'Someone'} followed you back`,
        prev.weeksLived ?? 0,
        { fromId: npcId, fromHandle: rel ? `@${rel.name.toLowerCase().replace(/\s+/g, '')}` : undefined },
      );
    }
    sm.followGraph = updated;
    return { ...prev, socialMedia: sm };
  });
  // Reported from the roll made above, not from the updater.
  return {
    success: true,
    message: followsBack ? 'Followed — they followed back!' : 'Following.',
    mutualFollow: followsBack,
  };
};

export const unfollowNpc = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  npcId: string,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const fg = sm.followGraph;
    if (!fg) return prev;
    const wasMutual = fg.followedByNpcIds.includes(npcId);
    const updated = {
      ...fg,
      followingNpcIds: fg.followingNpcIds.filter((id) => id !== npcId),
      followedByNpcIds:
        wasMutual && Math.random() < 0.4
          ? fg.followedByNpcIds.filter((id) => id !== npcId)
          : fg.followedByNpcIds,
      lastUpdatedWeek: prev.weeksLived ?? 0,
    };
    sm.followGraph = updated;
    // Small relationship score penalty
    const rels = (prev.relationships ?? []).map((r) =>
      r.id === npcId ? { ...r, relationshipScore: Math.max(0, r.relationshipScore - 2) } : r,
    );
    return { ...prev, socialMedia: sm, relationships: rels };
  });
};

// ─────────────────────────────────────────────────────────────────────
// Scandals
// ─────────────────────────────────────────────────────────────────────

export interface RecoverScandalResult {
  success: boolean;
  message: string;
  reputationDelta: number;
  followersDelta?: number;
}

const SCANDAL_GEM_COST = 500;
const SCANDAL_LAWSUIT_COST = 5000;

export const recoverFromScandal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  method: PulseScandalResolution,
  _deps: { updateStats: typeof updateStats; updateMoney: typeof updateMoney } = { updateStats, updateMoney },
): RecoverScandalResult => {
  const scandal = gameState.socialMedia?.activeScandal;
  if (!scandal) return { success: false, message: 'No active scandal.', reputationDelta: 0 };

  let reputationDelta = 0;
  let followersDelta = 0;
  let message = '';

  switch (method) {
    case 'apology': {
      reputationDelta = 5;
      followersDelta = -Math.floor((gameState.socialMedia?.followers ?? 0) * 0.02);
      message = 'You apologized publicly. Lost a few followers, gained a little respect.';
      break;
    }
    case 'silence': {
      // No immediate impact — tick handles decay; small chance of resurge handled in tick.
      message = 'You stayed silent. The story will fade — unless it resurges.';
      break;
    }
    case 'gems': {
      if ((gameState.stats.gems ?? 0) < SCANDAL_GEM_COST) {
        return { success: false, message: `Need ${SCANDAL_GEM_COST} gems for crisis PR.`, reputationDelta: 0 };
      }
      message = 'PR firm cleaned the slate.';
      break;
    }
    case 'lawsuit': {
      if (scandal.type !== 'deepfake' && scandal.type !== 'cancel') {
        return {
          success: false,
          message: 'A lawsuit only works for deepfakes and false-accusation scandals.',
          reputationDelta: 0,
        };
      }
      if ((gameState.stats.money ?? 0) < SCANDAL_LAWSUIT_COST) {
        return { success: false, message: `Need $${SCANDAL_LAWSUIT_COST} to sue.`, reputationDelta: 0 };
      }
      const won = Math.random() < 0.7;
      if (won) {
        reputationDelta = 10;
        message = 'You won the lawsuit. Vindicated.';
      } else {
        reputationDelta = -5;
        message = 'The lawsuit failed. Backfired.';
      }
      break;
    }
  }

  setGameState((prev) => {
    // H-8 (R8): for the gems method, debit gems INSIDE the updater and reject if
    // insufficient (updateStats clamps instead of rejecting → free scandal clear).
    if (method === 'gems' && (prev.stats?.gems ?? 0) < SCANDAL_GEM_COST) {
      return prev;
    }
    /**
     * R4-MON-3: the scandal must still be ACTIVE.
     *
     * The gem re-check above was added for exactly this class, but the whole
     * body works off the `scandal` captured from the stale outer `gameState`,
     * and nothing re-checked `prev.socialMedia?.activeScandal`.
     * `ScandalRecoveryModal.handleChoice` has no in-flight guard and its four
     * options are plain `Pressable`s in a ScrollView, so two taps in one React
     * batch both cleared the same scandal: 500 gems debited twice, a duplicate
     * `scandalHistory` entry, and `totalScandalsSurvived` double-incremented.
     * The `lawsuit` branch was worse — it charges $5,000 through `updateMoney`
     * OUTSIDE this updater, so a double tap was $10,000 for one clear.
     * CLAUDE.md §4.4.
     */
    if (!prev.socialMedia?.activeScandal) {
      return prev;
    }
    const sm = { ...ensureSocial(prev) };
    const ws = prev.weeksLived ?? 0;
    if (method === 'gems') {
      // Instant clear: severity 0, move to history, increment counter.
      // R3-E: cap to 30 — was unbounded; an influencer with many scandals over
      // a long life would accumulate hundreds of entries.
      sm.scandalHistory = [
        ...(sm.scandalHistory ?? []),
        {
          id: scandal.id,
          type: scandal.type,
          severity: scandal.severity,
          survivedAtWeek: ws,
          finalReputationLoss: scandal.reputationLossThisWeek,
          resolutionMethod: 'gems',
        },
      ].slice(-30);
      sm.activeScandal = null;
      if (sm.lifetimeStats) {
        sm.lifetimeStats = {
          ...sm.lifetimeStats,
          totalScandalsSurvived: sm.lifetimeStats.totalScandalsSurvived + 1,
          totalGemsBoostsUsed: sm.lifetimeStats.totalGemsBoostsUsed + 1,
        };
      }
    } else if (method === 'lawsuit') {
      // Lawsuit always resolves the scandal regardless of outcome.
      // R3-E: cap to 30 (see above).
      sm.scandalHistory = [
        ...(sm.scandalHistory ?? []),
        {
          id: scandal.id,
          type: scandal.type,
          severity: scandal.severity,
          survivedAtWeek: ws,
          finalReputationLoss: scandal.reputationLossThisWeek,
          resolutionMethod: 'lawsuit',
        },
      ].slice(-30);
      sm.activeScandal = null;
      if (sm.lifetimeStats) {
        sm.lifetimeStats = {
          ...sm.lifetimeStats,
          totalScandalsSurvived: sm.lifetimeStats.totalScandalsSurvived + 1,
        };
      }
    } else {
      // Apology / silence — store method on scandal so tick can adjust decay rate
      sm.activeScandal = { ...scandal, resolutionMethod: method };
    }
    return {
      ...prev,
      stats: method === 'gems'
        ? { ...prev.stats, gems: (prev.stats.gems ?? 0) - SCANDAL_GEM_COST }
        : prev.stats,
      socialMedia: sm,
    };
  });

  // Cost / stat side-effects (gems are debited atomically inside the updater above).
  if (method === 'lawsuit') {
    updateMoney(setGameState, -SCANDAL_LAWSUIT_COST, 'Scandal lawsuit fees');
  } else if (method === 'apology') {
    updateStats(setGameState, { energy: -10 });
  }
  if (reputationDelta !== 0) {
    updateStats(setGameState, { reputation: reputationDelta });
  }
  if (followersDelta !== 0) {
    setGameState((prev) => {
      const sm = { ...ensureSocial(prev) };
      sm.followers = Math.max(0, (sm.followers ?? 0) + followersDelta);
      sm.influenceLevel = getInfluenceLevel(sm.followers);
      return { ...prev, socialMedia: sm };
    });
  }

  return { success: true, message, reputationDelta, followersDelta };
};

// ─────────────────────────────────────────────────────────────────────
// Brand deals
// ─────────────────────────────────────────────────────────────────────

/**
 * PURE: what does accepting `dealId` do to `state`?
 *
 * `next: null` means refuse. Used for BOTH the caller-facing outcome (against
 * the snapshot) and the commit (against `prev`), so no variable is read across
 * the updater boundary — the defect behind the 2026-08-15 player report.
 */
function resolveAcceptBrandDeal(
  state: GameState,
  dealId: string,
): { result: { success: boolean; message: string }; next: GameState | null } {
  const sm = { ...ensureSocial(state) };
  const inbox = sm.brandInbox ?? { pending: [], declined: [], history: [] };
  const offer = inbox.pending.find((o) => o.id === dealId);
  if (!offer) return { result: { success: false, message: 'Offer not found.' }, next: null };

  const ws = state.weeksLived ?? 0;
  const active: PulseActiveBrandDeal = {
    id: offer.id,
    brandName: offer.brandName,
    payment: offer.payment,
    expiresAt: ws + offer.duration,
    expiresIn: offer.duration,
    postsRequired: offer.postsRequired,
    postsDelivered: 0,
    // P0-1: stream 75% of the contract over the duration. The 25% signing
    // bonus paid below is an advance against the total, so total payout is
    // 100% of `payment` (previously: 25% bonus + 100% stream = 125%).
    // Recomputed here (not trusting offer.weeklyPayment) so any in-flight
    // offer minted before this fix still pays correctly.
    weeklyPayment: Math.floor((offer.payment * 0.75) / Math.max(1, offer.duration)),
    category: offer.category,
    riskOfBreach: 0,
    logoColor1: offer.logoColor1,
    logoColor2: offer.logoColor2,
  };

  sm.activeBrandDeals = [...(sm.activeBrandDeals ?? []), active];
  sm.brandPartnerships = (sm.brandPartnerships ?? 0) + 1;
  sm.brandInbox = { ...inbox, pending: inbox.pending.filter((o) => o.id !== dealId) };

  // Signing bonus = 25% of total payment, paid immediately
  const bonus = Math.floor(offer.payment * 0.25);
  sm.totalEarnings = (sm.totalEarnings ?? 0) + bonus;

  pushNotification(sm, 'brand_offer', `Accepted ${offer.brandName} deal — $${bonus} signing bonus paid`, ws, {
    refDealId: dealId,
  });

  // M-batch-B (R8): credit the signing bonus into stats.money IN THE SAME
  // transition. The prior code only bumped the `totalEarnings` display counter
  // and left a `prev => prev` no-op, so the player was never paid.
  const credit = applyMoneyDelta(state, bonus, 'Brand deal signing bonus');
  return {
    result: { success: true, message: `Accepted ${offer.brandName} ($${bonus} signing bonus).` },
    next: { ...state, ...(credit ?? {}), socialMedia: sm },
  };
}

export const acceptBrandDeal = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
): { success: boolean; message: string } => {
  const preview = resolveAcceptBrandDeal(gameState, dealId);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveAcceptBrandDeal(prev, dealId).next ?? prev);
  return preview.result;
};

export const declineBrandDeal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const inbox = sm.brandInbox ?? { pending: [], declined: [], history: [] };
    const newDeclined = [
      ...inbox.declined,
      { id: dealId, declinedWeek: prev.weeksLived ?? 0 },
    ].slice(-20);
    sm.brandInbox = {
      ...inbox,
      pending: inbox.pending.filter((o) => o.id !== dealId),
      declined: newDeclined,
    };
    return { ...prev, socialMedia: sm };
  });
};

/**
 * PURE: what does delivering `postId` against `dealId` do to `state`?
 *
 * `next: null` means refuse. The mutable `result` below is a LOCAL of this pure
 * function — that is fine; what was not fine is the previous shape, where it
 * lived outside a `setGameState` updater and was assigned from inside it. React
 * runs only the FIRST functional update of a batch eagerly, so any deferred
 * dispatch returned the initial "Deal not found." for a delivery that had
 * landed (the 2026-08-15 player-report defect).
 */
function resolveDeliverBrandDealPost(
  state: GameState,
  dealId: string,
  postId: string,
): { result: { success: boolean; message: string }; next: GameState | null } {
  let result = { success: false, message: 'Deal not found.' };
  const sm = { ...ensureSocial(state) };
  let completionPayout = 0;

  // ONE POST COUNTS ONCE. The counter was incremented unconditionally, with
  // the "already used" check living only in the caller's render closure —
  // `BrandDealsScreen.handleDeliver` picks `recent.find(p =>
  // !p.sponsoredByDealId)` from a stale snapshot, so two taps in one batch
  // both chose the SAME post and the reducer counted two deliveries. Once
  // `postsDelivered >= postsRequired` the deal completes early and pays every
  // remaining installment at once, so a multi-post multi-week contract
  // collapsed into one post and one week — not over-payment, but a large rate
  // exploit that also churned the offer inbox far faster than designed.
  //
  // Every other Pulse action carries an explicit same-batch guard; this was
  // the one that did not. 2026-07-30 audit ECON-4.
  const alreadySponsored = (sm.recentPosts ?? []).find((p) => p.id === postId)?.sponsoredByDealId;
  if (alreadySponsored) {
    result = {
      success: false,
      message: alreadySponsored === dealId
        ? 'That post has already been delivered for this deal.'
        : 'That post is already sponsored by another deal.',
    };
    return { result, next: null };
  }

  const deals = (sm.activeBrandDeals ?? []).map((d) => {
    if (d.id !== dealId) return d;
    const delivered = (d.postsDelivered ?? 0) + 1;
    return { ...d, postsDelivered: delivered };
  });
  sm.activeBrandDeals = deals;

  const deal = deals.find((d) => d.id === dealId);
  if (!deal) {
    result = { success: false, message: 'Deal not found.' };
    return { result, next: null };
  }

  // Tag the post as sponsored if it isn't already
  sm.recentPosts = (sm.recentPosts ?? []).map((p) =>
    p.id === postId
      ? { ...p, sponsoredByDealId: dealId, sponsoredBrandName: deal.brandName }
      : p,
  );

  if ((deal.postsDelivered ?? 0) >= (deal.postsRequired ?? 1)) {
    // Complete — move to history
    const ws = state.weeksLived ?? 0;
    // M-batch-B (R8): finishing early removes the deal, which stops the weekly
    // installments the tick would otherwise pay (pulseTick pays weeklyPayment
    // while active). Pay the remaining unpaid installments now so delivering
    // all posts pays out in full (matches the "full payment received" message)
    // instead of shorting the player the weeks they cut short. Total payout is
    // identical to riding the deal to expiry — no double-pay, no exploit.
    const remainingWeeks = Math.max(0, (deal.expiresAt ?? ws) - ws);
    const weeklyPay = deal.weeklyPayment ?? Math.floor(((deal.payment ?? 0) * 0.75) / Math.max(1, deal.expiresIn ?? 1));
    completionPayout = Math.max(0, weeklyPay * remainingWeeks);
    sm.activeBrandDeals = deals.filter((d) => d.id !== dealId);
    sm.brandInbox = {
      ...(sm.brandInbox ?? { pending: [], declined: [], history: [] }),
      history: [
        ...(sm.brandInbox?.history ?? []),
        {
          id: dealId,
          brandName: deal.brandName,
          totalPaid: deal.payment,
          completedWeek: ws,
          result: 'success',
        },
      ],
    };
    if (sm.lifetimeStats) {
      sm.lifetimeStats = {
        ...sm.lifetimeStats,
        totalBrandDealsCompleted: sm.lifetimeStats.totalBrandDealsCompleted + 1,
      };
    }
    pushNotification(sm, 'brand_offer', `${deal.brandName} campaign completed — full payment received`, ws, {
      refDealId: dealId,
    });
    result = { success: true, message: `${deal.brandName} campaign completed!` };
  } else {
    result = { success: true, message: `Delivered post (${deal.postsDelivered}/${deal.postsRequired}).` };
  }
  // M-batch-B (R8): credit the remaining brand-deal balance on early completion
  // IN THE SAME updater. Finishing early removes the deal (above), so the
  // tick's weekly installments stop — paying the remainder makes the total
  // identical to riding the deal to expiry. applyMoneyDelta never rejects a
  // positive credit; folding it in avoids a post-setState read.
  const credit =
    completionPayout > 0 ? applyMoneyDelta(state, completionPayout, 'Brand deal completion payout') : null;
  return { result, next: { ...state, ...(credit ?? {}), socialMedia: sm } };
}

export const deliverBrandDealPost = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
  postId: string,
): { success: boolean; message: string } => {
  const preview = resolveDeliverBrandDealPost(gameState, dealId, postId);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveDeliverBrandDealPost(prev, dealId, postId).next ?? prev);
  return preview.result;
};

/**
 * What breaching `dealId` costs, computed from a state snapshot.
 *
 * Extracted so the CONFIRM SCREEN can quote the real number and refuse up front.
 * `breachBrandDeal` returns its outcome from inside a `setGameState` updater,
 * and React is free to defer an updater past the point the caller reads that
 * return — so the refusal added below could not be reported to the player
 * through the return value alone. `BrandDealsScreen` ignored it outright, which
 * meant a player who could not afford the penalty tapped "Breach" on a
 * confirmation dialog and got silence. The alert also quoted `payment * 0.5`,
 * a different number from the one actually charged.
 *
 * Returns `null` when the deal is not active. The updater still re-checks
 * everything against `prev` — this is for the copy and the pre-flight, never
 * the authority. 2026-07-30 review of ECON-R1-03.
 */
export const brandDealBreachPenalty = (state: GameState, dealId: string): number | null => {
  const deal = (state.socialMedia?.activeBrandDeals ?? []).find((d) => d.id === dealId);
  if (!deal) return null;
  const ws = state.weeksLived ?? 0;
  const remainingPayment = deal.weeklyPayment
    ? Math.max(0, deal.weeklyPayment * (deal.expiresAt - ws))
    : Math.floor(deal.payment * 0.5);
  return Math.floor(remainingPayment * 1.5);
};

/**
 * Breach `dealId`, charging the penalty atomically.
 *
 * The return value IS trustworthy as of 2026-08-15.
 *
 * It used to carry a warning not to read it: the outcome was assembled inside
 * the `setGameState` updater, and React may run that updater after this
 * function has returned — so the caller could see the initial
 * `{ success: false, message: 'Deal not found.' }` for a breach that then
 * succeeded. Measured, not assumed: `__tests__/refactor/updaterTimingContract`
 * shows the first updater of a batch runs eagerly and a second is deferred.
 *
 * That warning has been replaced by the fix it asked for — a pure reducer with
 * an explicit result (`resolveBreachBrandDeal`), called once against the
 * caller's snapshot for the outcome and once against `prev` for the state.
 * Nothing is read across the updater boundary, so the report no longer depends
 * on React's batching order.
 *
 * `brandDealBreachPenalty` stays: quoting the real penalty on the confirm
 * dialog is worth doing on its own, independently of who can read this return.
 */
function resolveBreachBrandDeal(
  state: GameState,
  dealId: string,
): { result: { success: boolean; message: string; penalty: number }; next: GameState | null } {
  const sm = { ...ensureSocial(state) };
  const deal = (sm.activeBrandDeals ?? []).find((d) => d.id === dealId);
  if (!deal) return { result: { success: false, message: 'Deal not found.', penalty: 0 }, next: null };

  const ws = state.weeksLived ?? 0;
  const penalty = brandDealBreachPenalty(state, dealId) ?? 0;
  sm.activeBrandDeals = (sm.activeBrandDeals ?? []).filter((d) => d.id !== dealId);
  sm.brandInbox = {
    ...(sm.brandInbox ?? { pending: [], declined: [], history: [] }),
    history: [
      ...(sm.brandInbox?.history ?? []),
      { id: dealId, brandName: deal.brandName, totalPaid: 0, completedWeek: ws, result: 'breached' },
    ],
  };

  // CHARGE INSIDE THE TRANSITION, and let an unaffordable penalty REFUSE the
  // breach rather than waive it.
  //
  // The penalty used to be applied afterwards via `updateMoney`, which is
  // all-or-nothing: it returns `prev` unchanged when the debit would go
  // negative. So the breach had already landed — deal removed, history row
  // written — and the charge silently did nothing. A player who moved their
  // cash into a bank account first breached every contract for FREE, kept the
  // 25% signing bonus `acceptBrandDeal` paid up front, and was told
  // "Contract breached. -$X" while paying nothing. 2026-07-30 audit ECON-R1-03.
  const debit = applyMoneyDelta(state, -penalty, 'Brand deal breach penalty');
  if (!debit) {
    return {
      result: {
        success: false,
        message: `You cannot afford the $${penalty.toLocaleString()} breach penalty. Free up cash first.`,
        penalty,
      },
      next: null,
    };
  }

  pushNotification(sm, 'brand_offer', `${deal.brandName} contract breached — $${penalty} penalty`, ws, {
    refDealId: dealId,
  });
  return {
    result: { success: true, message: `Contract breached. -$${penalty}, reputation -10.`, penalty },
    next: {
      ...state,
      ...debit,
      socialMedia: sm,
      stats: { ...(debit.stats ?? state.stats), reputation: Math.max(0, (state.stats?.reputation ?? 0) - 10) },
    },
  };
}

export const breachBrandDeal = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
  _deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats } = { updateMoney, updateStats },
): { success: boolean; message: string; penalty: number } => {
  void _deps;
  const preview = resolveBreachBrandDeal(gameState, dealId);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveBreachBrandDeal(prev, dealId).next ?? prev);
  return preview.result;
};

// ─────────────────────────────────────────────────────────────────────
// Live streaming
// ─────────────────────────────────────────────────────────────────────

export const startLiveStream = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  topic: string,
  _deps: { updateStats: typeof updateStats } = { updateStats },
): { success: boolean; message: string } => {
  const followers = gameState.socialMedia?.followers ?? 0;
  if (followers < 100) {
    return { success: false, message: 'Need at least 100 followers to go live.' };
  }
  if ((gameState.stats.energy ?? 0) < 30) {
    return { success: false, message: 'Need 30 energy to start a live stream.' };
  }
  if (gameState.socialMedia?.liveSession?.active) {
    return { success: false, message: 'You’re already live.' };
  }

  const initialViewers = Math.max(
    1,
    Math.floor(followers * 0.02 * (0.5 + Math.random())),
  );

  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.liveSession = {
      active: true,
      topic: topic.trim() || 'Live stream',
      startedTimestamp: Date.now(),
      startedWeek: prev.weeksLived ?? 0,
      currentViewers: initialViewers,
      peakViewers: initialViewers,
      minutesElapsed: 0,
      donationsEarned: 0,
      npcChatters: [],
    };
    return { ...prev, socialMedia: sm };
  });
  updateStats(setGameState, { energy: -30 });
  return { success: true, message: 'Live!' };
};

export const tickLiveStream = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  realSecondsElapsed: number = 30,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const live = sm.liveSession;
    if (!live || !live.active) return prev;

    // P1-3: clamp the elapsed time so a backgrounded app (or a remounted screen
    // that resumes the stream) can't pass a huge wall-clock delta and harvest
    // unbounded tips in one tick.
    const MAX_TICK_SECONDS = 60;
    const MAX_STREAM_MINUTES = 30; // a session only earns for its first 30 minutes
    const clampedSeconds = Math.max(0, Math.min(MAX_TICK_SECONDS, realSecondsElapsed));
    const minutesDelta = clampedSeconds / 60;
    const overCap = live.minutesElapsed >= MAX_STREAM_MINUTES;

    const followerScale = Math.max(1, (sm.followers ?? 0) / 1000);
    // Past the cap, viewers decay toward 0 and donations stop.
    const drift = overCap ? -followerScale * 2 : (Math.random() - 0.4) * followerScale; // bias upward
    const newViewers = overCap
      ? Math.max(0, Math.floor(live.currentViewers * 0.7))
      : Math.max(0, Math.floor(live.currentViewers + drift));
    const peak = Math.max(live.peakViewers, newViewers);
    const newMinutes = live.minutesElapsed + minutesDelta;
    const donationDelta = overCap
      ? 0
      : calculateLiveStreamDonations(newViewers, minutesDelta, sm.followers ?? 0);

    // P1-3: hard-cap total session tips at a follower-based ceiling so a long
    // stream can't print money beyond what the audience could plausibly tip.
    const sessionDonationCap = Math.max(50, (sm.followers ?? 0) * 2);
    const newDonations = Math.min(sessionDonationCap, live.donationsEarned + donationDelta);

    sm.liveSession = {
      ...live,
      currentViewers: newViewers,
      peakViewers: peak,
      minutesElapsed: newMinutes,
      donationsEarned: newDonations,
    };
    return { ...prev, socialMedia: sm };
  });
};

export interface EndLiveResult {
  success: boolean;
  message: string;
  totalDonations: number;
  newFollowers: number;
  peakViewers: number;
  minutesElapsed: number;
}

export const endLiveStream = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  _deps: { updateStats: typeof updateStats; updateMoney: typeof updateMoney } = { updateStats, updateMoney },
): EndLiveResult => {
  const live = gameState.socialMedia?.liveSession;
  if (!live || !live.active) {
    return { success: false, message: 'Not live.', totalDonations: 0, newFollowers: 0, peakViewers: 0, minutesElapsed: 0 };
  }

  // Reported from the snapshot the player acted on; the updater re-derives the
  // same figures from `prev` for the state.
  const reportedDonations = live.donationsEarned;
  const reportedFollowers = Math.floor(live.peakViewers * 0.05);

  /**
   * ANTI-EXPLOIT: end the session and pay it out in ONE updater, guarded on the
   * FRESH `prev.socialMedia.liveSession.active`. The outer guard reads the
   * stale snapshot, so two rapid "End" taps both saw active===true.
   *
   * The tips and the stat deltas used to be separate dispatches gated on a
   * `let applied` flag read back from here. That read is only reliable for the
   * FIRST functional update of a React batch — so a deferred dispatch ended the
   * stream, banked the follower count, and never paid the tips, while telling
   * the player "Not live."
   */
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const ls = sm.liveSession;
    if (!ls || !ls.active) return prev; // already ended by a prior tap → reject
    const appliedDonations = ls.donationsEarned;
    const appliedFollowers = Math.floor(ls.peakViewers * 0.05);
    sm.totalLiveStreams = (sm.totalLiveStreams ?? 0) + 1;
    sm.totalLiveViewers = (sm.totalLiveViewers ?? 0) + ls.peakViewers;
    sm.totalLiveDuration = (sm.totalLiveDuration ?? 0) + ls.minutesElapsed;
    sm.peakLiveViewers = Math.max(sm.peakLiveViewers ?? 0, ls.peakViewers);
    sm.followers = (sm.followers ?? 0) + appliedFollowers;
    sm.influenceLevel = getInfluenceLevel(sm.followers);
    sm.totalEarnings = (sm.totalEarnings ?? 0) + ls.donationsEarned;
    sm.liveSession = null;
    pushNotification(
      sm,
      'milestone',
      `Stream ended. Peak ${ls.peakViewers} viewers, +${appliedFollowers} followers, $${ls.donationsEarned.toFixed(2)} in tips`,
      prev.weeksLived ?? 0,
    );
    let next: GameState = { ...prev, socialMedia: sm };
    const tips = applyMoneyDelta(next, appliedDonations, 'Pulse live stream tips');
    if (tips) next = { ...next, ...tips };
    return { ...next, ...applyStatsDelta(next, { energy: -20, happiness: 15 }) };
  });

  return {
    success: true,
    message: 'Stream ended.',
    totalDonations: reportedDonations,
    newFollowers: reportedFollowers,
    peakViewers: live.peakViewers,
    minutesElapsed: live.minutesElapsed,
  };
};

// ─────────────────────────────────────────────────────────────────────
// Monetization
// ─────────────────────────────────────────────────────────────────────

export const boostPostWithGems = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  postId: string,
  gemCost: number = 200,
): { success: boolean; message: string } => {
  if ((gameState.stats.gems ?? 0) < gemCost) {
    return { success: false, message: `Need ${gemCost} gems to boost.` };
  }

  setGameState((prev) => {
    // H-8 (R8): debit gems INSIDE the updater and reject if insufficient.
    // updateStats clamps gems to >=0 (never rejects), so grant-then-charge let
    // two rapid taps both boost the post while gems floored at 0.
    if ((prev.stats?.gems ?? 0) < gemCost) {
      return prev;
    }
    const sm = { ...ensureSocial(prev) };
    sm.recentPosts = (sm.recentPosts ?? []).map((p) => {
      if (p.id !== postId) return p;
      // Tripled-virality re-roll — distinct nonces so the three rolls are
      // genuinely independent (≈ 3× the base viral chance), not one repeated.
      const viral = checkViralChance(sm.influenceLevel, p.contentType, 0) ||
        checkViralChance(sm.influenceLevel, p.contentType, 1) ||
        checkViralChance(sm.influenceLevel, p.contentType, 2);
      const eng = calculatePostEngagement(sm.followers ?? 0, p.contentType, viral);
      return {
        ...p,
        isViral: viral || p.isViral,
        likes: Math.max(p.likes, eng.likes),
        reposts: Math.max(p.reposts ?? 0, eng.reposts),
        views: Math.max(p.views ?? 0, eng.views),
      };
    });
    sm.pendingBoosts = [
      ...(sm.pendingBoosts ?? []),
      { type: 'post', postId, appliedWeek: prev.weeksLived ?? 0 },
    ];
    if (sm.lifetimeStats) {
      sm.lifetimeStats = {
        ...sm.lifetimeStats,
        totalGemsBoostsUsed: sm.lifetimeStats.totalGemsBoostsUsed + 1,
      };
    }
    return {
      ...prev,
      stats: { ...prev.stats, gems: (prev.stats.gems ?? 0) - gemCost },
      socialMedia: sm,
    };
  });
  return { success: true, message: 'Post boosted!' };
};

/**
 * Subscribe to Pulse Verified Pro as an IN-GAME cash subscription (NOT a real
 * IAP). Debits `stats.money` immediately via the canonical `applyMoneyDelta`
 * (overdraft-reject + NaN-guard) in the SAME updater that grants the perks, and
 * records the weekly price so the tick can auto-renew it (applySubscriptionsForWeek).
 *
 * - plan 'weekly': charge the weekly fee now; auto-renews weekly on the tick.
 * - plan 'annual': charge the 52-week prepay now (discounted); weekly billing is
 *   skipped until the prepaid term ends, then normal weekly auto-renew resumes.
 *
 * Returns `{ success:false }` with a clear message when the player can't afford it.
 */
export const subscribeVerifiedPro = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  plan: InGameSubscriptionPlan = 'weekly',
): { success: boolean; message: string } => {
  const price = plan === 'annual' ? VERIFIED_PRO_ANNUAL_PRICE : VERIFIED_PRO_WEEKLY_PRICE;
  // Re-entry guard: subscribing to the plan you ALREADY hold re-charges the full
  // price and (for annual) resets paidThroughWeek to now+52 instead of extending
  // it — a pure loss. The modal normally hides the CTA, but a double-tap or a
  // stale render can still land here. Switching plan (weekly ⇄ annual) stays
  // allowed. Filed as a non-blocking LOW by the 2026-07-16 weekly audit.
  const activePro = gameState.socialMedia?.verifiedPro;
  if (activePro?.active === true && (activePro.plan ?? 'weekly') === plan) {
    return {
      success: false,
      message: 'Pulse Verified Pro is already active — no need to buy it again.',
    };
  }
  // Derive the caller-facing result from the CURRENT snapshot BEFORE dispatching.
  // setGameState is a plain (wrapped) React useState setter — it may defer the
  // updater, so reading a value the updater assigns is unreliable. The atomic
  // charge+grant still lives inside the updater below (applyMoneyDelta overdraft-
  // reject), which remains the source of truth for money safety.
  if ((gameState.stats?.money ?? 0) < price) {
    return {
      success: false,
      message: `You can't afford Pulse Verified Pro ($${price.toLocaleString()}).`,
    };
  }
  setGameState((prev) => {
    // Same re-entry guard re-checked against `prev` — two taps in one React batch
    // both see the pre-dispatch snapshot, so only the in-updater check can stop
    // the second from paying twice.
    const prevPro = prev.socialMedia?.verifiedPro;
    if (prevPro?.active === true && (prevPro.plan ?? 'weekly') === plan) return prev;
    // Charge in-game cash atomically (overdraft-reject) in the same updater that
    // grants the perks — closes the charge-then-grant race and never overdrafts.
    const spend = applyMoneyDelta(prev, -price, `Pulse Verified Pro (${plan})`);
    if (!spend) return prev; // funds dropped since the preview → reject atomically
    const sm = { ...ensureSocial(prev) };
    const ws = prev.weeksLived ?? 0;
    sm.verifiedPro = {
      active: true,
      plan,
      weeklyPrice: VERIFIED_PRO_WEEKLY_PRICE,
      startedWeek: ws,
      paidThroughWeek: plan === 'annual' ? ws + 52 : undefined,
      subscribedTimestamp: Date.now(),
      perksUnlocked: {
        blueCheckmark: true,
        postBoostMultiplier: 1.25,
        analyticsUnlocked: true,
        noAdsInFeed: true,
        longerPosts: true,
      },
    };
    // Signup boost — ONCE per save (sticky flag survives cancel→resubscribe).
    if (!sm.verifiedProWelcomeClaimed) {
      sm.verifiedProWelcomeClaimed = true;
      sm.followers = (sm.followers ?? 0) + 500;
      sm.influenceLevel = getInfluenceLevel(sm.followers);
      pushNotification(sm, 'verified_pro_renewal', 'Welcome to Pulse Verified Pro — +500 signup followers', ws);
    }

    // Flip userProfile.verified
    const userProfile = { ...prev.userProfile, verified: true };
    return { ...prev, ...spend, socialMedia: sm, userProfile };
  });
  return {
    success: true,
    message:
      plan === 'annual'
        ? `Pulse Verified Pro active — $${price.toLocaleString()} for 52 weeks.`
        : `Pulse Verified Pro active — $${price}/week.`,
  };
};

export const cancelVerifiedPro = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    if (sm.verifiedPro) {
      sm.verifiedPro = {
        ...sm.verifiedPro,
        active: false,
        perksUnlocked: {
          blueCheckmark: false,
          postBoostMultiplier: 1.0,
          analyticsUnlocked: false,
          noAdsInFeed: false,
          longerPosts: false,
        },
      };
    }
    // The blue check is derived from an ACTIVE Verified Pro subscription. Cancelling
    // must clear userProfile.verified too — otherwise the checkmark survived forever.
    const userProfile = prev.userProfile?.verified
      ? { ...prev.userProfile, verified: false }
      : prev.userProfile;
    return { ...prev, socialMedia: sm, userProfile };
  });
};

export interface AdBoostResult {
  success: boolean;
  message: string;
  followersGained: number;
}

/**
 * Is the weekly ad-boost available? Checked BEFORE an ad is presented.
 *
 * `RewardedAdModal` used to present a full rewarded video and only then call
 * `watchAdForFollowerBoost`, which refuses when the boost was already used this
 * game week. So a player watched a real 30-second ad, received nothing, and was
 * told nothing — the sheet had already been dismissed to present the ad, and
 * the failure branch fired a haptic and dropped `result.message` on the floor.
 * 2026-07-30 audit UX-1.
 */
export const canBoostFollowersWithAd = (gameState: GameState): boolean => {
  const ws = gameState.weeksLived ?? 0;
  const lastBoost = gameState.socialMedia?.lastAdBoostWeek ?? -Infinity;
  return ws - lastBoost >= 1;
};

export const watchAdForFollowerBoost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): AdBoostResult => {
  if (!canBoostFollowersWithAd(gameState)) {
    return { success: false, message: 'Already used your ad-boost this week.', followersGained: 0 };
  }
  const proActive = gameState.socialMedia?.verifiedPro?.active === true;
  const gained = proActive ? 150 : 50;

  /**
   * `canBoostFollowersWithAd` above is the reported outcome; the re-check below
   * is the same-batch RACE guard for STATE.
   *
   * A `let granted` flag used to be read back here. It is only reliable for the
   * FIRST functional update of a React batch, and this path is reached straight
   * out of `RewardedAdModal` — so a player who had genuinely watched an ad
   * could be told "Already used your ad-boost this week" while the followers
   * landed. Of all the sites in this class that is the worst one to get wrong.
   */
  setGameState((prev) => {
    // Atomic gate: re-check the weekly cooldown against prev. Two same-batch
    // taps both pass the stale outer check; without this, both add followers
    // (the only non-atomic gate→grant left in Pulse).
    const prevWs = prev.weeksLived ?? 0;
    const prevLast = prev.socialMedia?.lastAdBoostWeek ?? -Infinity;
    if (prevWs - prevLast < 1) return prev;
    const sm = { ...ensureSocial(prev) };
    sm.followers = (sm.followers ?? 0) + gained;
    sm.influenceLevel = getInfluenceLevel(sm.followers);
    sm.lastAdBoostWeek = prevWs;
    pushNotification(sm, 'milestone', `Watched ad → +${gained} followers`, prevWs);
    return { ...prev, socialMedia: sm };
  });

  return { success: true, message: `+${gained} followers from ad reward.`, followersGained: gained };
};

// ─────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────

export const markNotificationRead = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  notificationId: string,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.notifications = (sm.notifications ?? []).map((n) =>
      n.id === notificationId ? { ...n, read: true } : n,
    );
    return { ...prev, socialMedia: sm };
  });
};

export const markAllNotificationsRead = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.notifications = (sm.notifications ?? []).map((n) => ({ ...n, read: true }));
    return { ...prev, socialMedia: sm };
  });
};

export const clearAllNotifications = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
): void => {
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    sm.notifications = [];
    return { ...prev, socialMedia: sm };
  });
};
