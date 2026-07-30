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
import { updateStats } from './StatsActions';
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

  let applied = false;
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
    applied = true;

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

    return { ...prev, socialMedia: sm };
  });

  // If a same-batch duplicate was rejected inside the updater, do NOT run the
  // money/stat side-effects (they would double-pay the rejected post).
  if (!applied) {
    return { success: false, message: 'You already posted that type this week.' };
  }

  // Side-effects: stats & money happen through the canonical actions so daily
  // summary tracking works.
  updateStats(setGameState, {
    energy: -getEnergyCost(args.contentType),
    health: -getHealthCost(args.contentType),
    happiness: getHappinessGain(args.contentType, isViral),
  });
  if (adRevenue > 0) {
    updateMoney(setGameState, adRevenue, `Pulse: ad revenue from post`);
  }

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
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  npcId: string,
): { success: boolean; message: string; mutualFollow?: boolean } => {
  let mutualFollow = false;
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
    const baseProb = (rel?.relationshipScore ?? 0) >= 60 ? 0.95 : 0.7;
    if (Math.random() < baseProb && !updated.followedByNpcIds.includes(npcId)) {
      updated.followedByNpcIds = [...updated.followedByNpcIds, npcId];
      mutualFollow = true;
      // ANTI-EXPLOIT: grant the one-time follower boost only the FIRST time this
      // NPC ever follows back. Re-following after an unfollow re-establishes the
      // mutual edge but must NOT re-pay the boost, otherwise a follow/unfollow
      // loop farms unlimited followers → influence → ad/brand income.
      const granted = updated.followBackGrantedNpcIds ?? [];
      if (!granted.includes(npcId)) {
        updated.followBackGrantedNpcIds = [...granted, npcId];
        // Followed back → small follower boost from their followers seeing the connection
        sm.followers = (sm.followers ?? 0) + Math.floor(50 + Math.random() * 150);
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
  return {
    success: true,
    message: mutualFollow ? 'Followed — they followed back!' : 'Following.',
    mutualFollow,
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

export const acceptBrandDeal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
): { success: boolean; message: string } => {
  let outcome: { success: boolean; message: string } = { success: false, message: 'Offer not found.' };
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const inbox = sm.brandInbox ?? { pending: [], declined: [], history: [] };
    const offer = inbox.pending.find((o) => o.id === dealId);
    if (!offer) return prev;

    const ws = prev.weeksLived ?? 0;
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
    sm.brandInbox = {
      ...inbox,
      pending: inbox.pending.filter((o) => o.id !== dealId),
    };

    // Signing bonus = 25% of total payment, paid immediately
    const bonus = Math.floor(offer.payment * 0.25);
    sm.totalEarnings = (sm.totalEarnings ?? 0) + bonus;

    pushNotification(sm, 'brand_offer', `Accepted ${offer.brandName} deal — $${bonus} signing bonus paid`, ws, {
      refDealId: dealId,
    });

    outcome = { success: true, message: `Accepted ${offer.brandName} ($${bonus} signing bonus).` };
    // M-batch-B (R8): credit the signing bonus into stats.money IN THE SAME
    // updater. The prior code only bumped the `totalEarnings` display counter and
    // left a `prev => prev` no-op, so the player was never paid. Folding the
    // credit in (applyMoneyDelta never rejects a positive amount) avoids relying
    // on a post-setState read that React may not run synchronously.
    const credit = applyMoneyDelta(prev, bonus, 'Brand deal signing bonus');
    return { ...prev, ...(credit ?? {}), socialMedia: sm };
  });
  return outcome;
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

export const deliverBrandDealPost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
  postId: string,
): { success: boolean; message: string } => {
  let result = { success: false, message: 'Deal not found.' };
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    let completionPayout = 0;
    const deals = (sm.activeBrandDeals ?? []).map((d) => {
      if (d.id !== dealId) return d;
      const delivered = (d.postsDelivered ?? 0) + 1;
      return { ...d, postsDelivered: delivered };
    });
    sm.activeBrandDeals = deals;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal) {
      result = { success: false, message: 'Deal not found.' };
      return prev;
    }

    // Tag the post as sponsored if it isn't already
    sm.recentPosts = (sm.recentPosts ?? []).map((p) =>
      p.id === postId
        ? { ...p, sponsoredByDealId: dealId, sponsoredBrandName: deal.brandName }
        : p,
    );

    if ((deal.postsDelivered ?? 0) >= (deal.postsRequired ?? 1)) {
      // Complete — move to history
      const ws = prev.weeksLived ?? 0;
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
      completionPayout > 0 ? applyMoneyDelta(prev, completionPayout, 'Brand deal completion payout') : null;
    return { ...prev, ...(credit ?? {}), socialMedia: sm };
  });
  return result;
};

export const breachBrandDeal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  dealId: string,
  _deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats } = { updateMoney, updateStats },
): { success: boolean; message: string; penalty: number } => {
  let outcome = { success: false, message: 'Deal not found.', penalty: 0 };
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const deal = (sm.activeBrandDeals ?? []).find((d) => d.id === dealId);
    if (!deal) return prev;
    const ws = prev.weeksLived ?? 0;
    const remainingPayment = deal.weeklyPayment
      ? Math.max(0, deal.weeklyPayment * (deal.expiresAt - ws))
      : Math.floor(deal.payment * 0.5);
    const penalty = Math.floor(remainingPayment * 1.5);
    sm.activeBrandDeals = (sm.activeBrandDeals ?? []).filter((d) => d.id !== dealId);
    sm.brandInbox = {
      ...(sm.brandInbox ?? { pending: [], declined: [], history: [] }),
      history: [
        ...(sm.brandInbox?.history ?? []),
        {
          id: dealId,
          brandName: deal.brandName,
          totalPaid: 0,
          completedWeek: ws,
          result: 'breached',
        },
      ],
    };
    // CHARGE INSIDE THE UPDATER, and let an unaffordable penalty REFUSE the
    // breach rather than waive it.
    //
    // The penalty used to be applied afterwards via `updateMoney`, which is
    // all-or-nothing: it returns `prev` unchanged when the debit would go
    // negative. So the breach had already landed — deal removed, history row
    // written — and the charge silently did nothing. A player who moved their
    // cash into a bank account first breached every contract for FREE, kept the
    // 25% signing bonus `acceptBrandDeal` paid up front, and was told
    // "Contract breached. -$X" while paying nothing. 2026-07-30 audit
    // ECON-R1-03; the gate-then-grant class this repo has shipped repeatedly.
    const debit = applyMoneyDelta(prev, -penalty, 'Brand deal breach penalty');
    if (!debit) {
      outcome = {
        success: false,
        message: `You cannot afford the $${penalty.toLocaleString()} breach penalty. Free up cash first.`,
        penalty,
      };
      return prev;
    }

    pushNotification(sm, 'brand_offer', `${deal.brandName} contract breached — $${penalty} penalty`, ws, {
      refDealId: dealId,
    });
    outcome = { success: true, message: `Contract breached. -$${penalty}, reputation -10.`, penalty };
    return {
      ...prev,
      ...debit,
      socialMedia: sm,
      stats: { ...(debit.stats ?? prev.stats), reputation: Math.max(0, (prev.stats?.reputation ?? 0) - 10) },
    };
  });
  return outcome;
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

  // ANTI-EXPLOIT: read the session and apply payout INSIDE the updater, guarded
  // on the FRESH `prev.socialMedia.liveSession.active`. The outer guard reads the
  // stale snapshot, so two rapid "End" taps both saw active===true and both
  // double-claimed tips + followers. We capture the applied figures and only run
  // the money/stat side-effects if this call actually ended the session.
  let applied = false;
  let appliedDonations = 0;
  let appliedFollowers = 0;
  setGameState((prev) => {
    const sm = { ...ensureSocial(prev) };
    const ls = sm.liveSession;
    if (!ls || !ls.active) return prev; // already ended by a prior tap → reject
    applied = true;
    appliedDonations = ls.donationsEarned;
    appliedFollowers = Math.floor(ls.peakViewers * 0.05);
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
    return { ...prev, socialMedia: sm };
  });

  if (!applied) {
    return { success: false, message: 'Not live.', totalDonations: 0, newFollowers: 0, peakViewers: 0, minutesElapsed: 0 };
  }

  updateMoney(setGameState, appliedDonations, 'Pulse live stream tips');
  updateStats(setGameState, { energy: -20, happiness: 15 });

  return {
    success: true,
    message: 'Stream ended.',
    totalDonations: appliedDonations,
    newFollowers: appliedFollowers,
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

export const watchAdForFollowerBoost = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): AdBoostResult => {
  const ws = gameState.weeksLived ?? 0;
  const lastBoost = gameState.socialMedia?.lastAdBoostWeek ?? -Infinity;
  if (ws - lastBoost < 1) {
    return { success: false, message: 'Already used your ad-boost this week.', followersGained: 0 };
  }
  const proActive = gameState.socialMedia?.verifiedPro?.active === true;
  const gained = proActive ? 150 : 50;

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
