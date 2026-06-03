/**
 * Pulse weekly tick — v13.
 *
 * Single entry point `processPulseWeeklyTick(state, nextWeeksLived, preRolls)`
 * called from inside `GameActionsContext::nextWeek`'s `setGameState(prev=>…)`
 * updater (after relationship-score processing, before passive income).
 *
 * Returns a structured result rather than `Partial<GameState>` so the caller
 * can merge weekly earnings into the final money calc explicitly.
 *
 * Hard rules (CLAUDE.md + tasks/lessons.md):
 *   - All time math uses `nextWeeksLived` (NEVER the cyclic week-of-month counter).
 *   - Pure function: no setGameState, no Date.now() side effects on `state`.
 *   - Defensive about missing socialMedia / sub-objects (v12 saves arrive
 *     pre-migration in some edge cases).
 */

import type { GameState } from '@/contexts/game/types';
import type {
  PulseActiveBrandDeal,
  PulseActiveScandal,
  PulseBrandOffer,
  PulseDealHistoryEntry,
  PulseNotification,
  PulseNotificationType,
  PulseTrendingHashtag,
  PulseVerifiedPro,
  PulseLifetimeStats,
  PulseScandalRecord,
  PulseInfluenceLevel,
} from '@/contexts/game/types';
import {
  calculateEngagementRate,
  calculateFollowerDecay,
  calculateWeeklyImpressionEarnings,
} from './socialMedia';
import { generateBrandOffersExtended } from './brandPartnerships';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface PulseTickResult {
  /** Replacement socialMedia object (caller spreads into the final state). */
  socialMedia: NonNullable<GameState['socialMedia']>;
  /** Money to credit the player this tick (impression earnings + brand-deal payments). */
  pulseEarnings: number;
  /** Reputation delta from scandal cascade (negative when a scandal is active). */
  reputationDelta: number;
  /** Follower loss from scandal cascade (already subtracted from socialMedia.followers). */
  scandalFollowerLoss: number;
}

interface PreRolls {
  pulseSeed?: number;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────

const TRENDING_CAP = 10;
const NOTIFICATION_CAP = 100;
const SCANDAL_PROGRESS_DECAY = 10;        // severity drop per tick
const SCANDAL_APOLOGY_BONUS = 15;         // extra drop if resolutionMethod === 'apology'
const SCANDAL_REP_CASCADE_DIVISOR = 10;   // rep loss = floor(severity / 10)
const SCANDAL_FOLLOWER_CASCADE_PCT = 0.005; // 0.5% loss per tick per scandal week
const BRAND_OFFER_MAX_PER_TICK = 3;
const BRAND_OFFER_FOLLOWER_GATE = 10_000;

const newNotificationId = (week: number, kind: string): string =>
  `notif_${week}_${kind}_${Math.floor(Math.random() * 1e6).toString(36)}`;

const influenceLevelForFollowers = (followers: number): PulseInfluenceLevel => {
  if (followers >= 1_000_000) return 'celebrity';
  if (followers >= 100_000) return 'influencer';
  if (followers >= 10_000) return 'popular';
  if (followers >= 1_000) return 'rising';
  return 'novice';
};

const pushNotification = (
  list: PulseNotification[],
  type: PulseNotificationType,
  text: string,
  weeksLived: number,
  extra: Partial<PulseNotification> = {},
): PulseNotification[] => {
  return [
    {
      id: newNotificationId(weeksLived, type),
      type,
      timestamp: Date.now(),
      gameWeek: weeksLived,
      read: false,
      text,
      ...extra,
    },
    ...list,
  ].slice(0, NOTIFICATION_CAP);
};

const isVerifiedProActive = (vp: PulseVerifiedPro | undefined): boolean => {
  if (!vp || !vp.active) return false;
  if (vp.expiresTimestamp && vp.expiresTimestamp < Date.now()) return false;
  return true;
};

// ──────────────────────────────────────────────────────────────────────────
// Main tick
// ──────────────────────────────────────────────────────────────────────────

export function processPulseWeeklyTick(
  state: GameState,
  nextWeeksLived: number,
  _preRolls?: PreRolls,
): PulseTickResult {
  // Safe defaults if socialMedia missing (pre-v13 save edge case).
  const sm = state.socialMedia ?? {
    followers: 0,
    influenceLevel: 'novice' as PulseInfluenceLevel,
    totalPosts: 0,
    viralPosts: 0,
    brandPartnerships: 0,
    engagementRate: 0,
  };

  let followers = sm.followers || 0;
  let notifications = [...(sm.notifications || [])];
  let pulseEarnings = 0;
  let reputationDelta = 0;
  let scandalFollowerLoss = 0;

  const verifiedProActive = isVerifiedProActive(sm.verifiedPro);
  const proMultiplier = verifiedProActive ? 1.25 : 1.0;

  // ── 1. Engagement rate recompute ────────────────────────────────────────
  const lastPostWeek = sm.lastPostWeek ?? 0;
  const weeksSinceLastPost = Math.max(0, nextWeeksLived - lastPostWeek);
  const engagementRate = calculateEngagementRate(sm.totalPosts || 0, weeksSinceLastPost);

  // ── 2. Follower decay (>=2 weeks inactive) ──────────────────────────────
  if (weeksSinceLastPost >= 2 && followers > 0) {
    const decay = calculateFollowerDecay(followers, weeksSinceLastPost, verifiedProActive);
    followers = Math.max(0, followers - decay);
  }

  // ── 3. Trending hashtag rotation ────────────────────────────────────────
  let trending: PulseTrendingHashtag[] = (sm.trendingHashtags || [])
    .map(t => ({ ...t, velocity: t.velocity * 0.7, postCount: Math.max(0, t.postCount - 5) }))
    .filter(t => t.decayWeek > nextWeeksLived && t.postCount > 0);

  // Inject 3 organic trends (deterministic from week so re-runs are stable).
  const organicTags = [
    `#${['mood', 'today', 'life', 'vibes', 'thoughts'][nextWeeksLived % 5]}`,
    `#${['monday', 'tuesday', 'friday', 'weekend', 'morning'][nextWeeksLived % 5]}`,
    `#${['food', 'travel', 'work', 'love', 'gym'][nextWeeksLived % 5]}`,
  ];
  for (const tag of organicTags) {
    if (!trending.find(t => t.tag === tag)) {
      trending.push({
        tag,
        postCount: 50 + Math.floor(Math.random() * 200),
        source: 'organic',
        velocity: 0.5 + Math.random() * 0.5,
        decayWeek: nextWeeksLived + 3,
      });
    }
  }
  // Inject scandal hashtag if a scandal is active.
  if (sm.activeScandal) {
    const tag = `#${sm.activeScandal.type.replace(/_/g, '')}`;
    if (!trending.find(t => t.tag === tag)) {
      trending.push({
        tag,
        postCount: 500 + sm.activeScandal.severity * 10,
        source: 'scandal',
        velocity: 1.0,
        decayWeek: nextWeeksLived + (sm.activeScandal.weeksRemaining || 2),
      });
    }
  }
  trending = trending.slice(0, TRENDING_CAP);

  // ── 4. Scandal progression ──────────────────────────────────────────────
  let activeScandal: PulseActiveScandal | null = sm.activeScandal || null;
  const scandalHistory: PulseScandalRecord[] = [...(sm.scandalHistory || [])];
  let scandalsSurvivedThisTick = 0;

  if (activeScandal) {
    const decay = activeScandal.resolutionMethod === 'apology'
      ? SCANDAL_PROGRESS_DECAY + SCANDAL_APOLOGY_BONUS
      : SCANDAL_PROGRESS_DECAY;
    const newSeverity = Math.max(0, activeScandal.severity - decay);
    const repLoss = Math.floor(activeScandal.severity / SCANDAL_REP_CASCADE_DIVISOR);
    const follLoss = Math.floor(followers * SCANDAL_FOLLOWER_CASCADE_PCT);

    reputationDelta -= repLoss;
    scandalFollowerLoss += follLoss;
    followers = Math.max(0, followers - follLoss);

    if (newSeverity === 0) {
      // Survived — fold to history.
      scandalHistory.push({
        id: activeScandal.id,
        type: activeScandal.type,
        severity: activeScandal.severity,
        survivedAtWeek: nextWeeksLived,
        finalReputationLoss: repLoss,
        resolutionMethod: activeScandal.resolutionMethod || 'silence',
      });
      notifications = pushNotification(
        notifications,
        'scandal_update',
        '✅ Scandal blew over.',
        nextWeeksLived,
      );
      activeScandal = null;
      scandalsSurvivedThisTick++;
    } else {
      activeScandal = {
        ...activeScandal,
        severity: newSeverity,
        weeksRemaining: Math.max(0, activeScandal.weeksRemaining - 1),
        reputationLossThisWeek: repLoss,
        followerLossThisWeek: follLoss,
      };
    }
  }

  // ── 5. Generate brand offers (followers >= 10K) ─────────────────────────
  const brandInbox = sm.brandInbox ?? { pending: [], declined: [], history: [] };
  let pending: PulseBrandOffer[] = brandInbox.pending
    .map(o => ({ ...o, expiresInWeeks: o.expiresInWeeks - 1 }))
    .filter(o => o.expiresInWeeks > 0);

  if (followers >= BRAND_OFFER_FOLLOWER_GATE) {
    const generated = generateBrandOffersExtended(
      { ...state, socialMedia: { ...sm, followers, engagementRate } } as GameState,
      nextWeeksLived,
    );
    // Cap injection: respect BRAND_OFFER_MAX_PER_TICK so the inbox doesn't flood.
    for (const o of generated.slice(0, BRAND_OFFER_MAX_PER_TICK)) {
      if (!pending.find(p => p.id === o.id)) {
        pending.push(o);
        notifications = pushNotification(
          notifications,
          'brand_offer',
          `${o.brandName} offered you a deal — $${o.payment.toLocaleString()}`,
          nextWeeksLived,
          { refDealId: o.id, fromHandle: o.brandName },
        );
      }
    }
  }

  // ── 6. Process active brand deals ───────────────────────────────────────
  const activeDeals: PulseActiveBrandDeal[] = [];
  const history: PulseDealHistoryEntry[] = [...brandInbox.history];
  let dealsCompletedThisTick = 0;

  for (const deal of sm.activeBrandDeals || []) {
    const isExpired = deal.expiresAt <= nextWeeksLived;
    const postsDone = deal.postsDelivered || 0;
    const postsNeeded = deal.postsRequired || 1;
    const breached = (deal.riskOfBreach || 0) > 50 && activeScandal;

    if (breached) {
      const penalty = Math.floor((deal.payment || 0) * 0.5);
      pulseEarnings -= penalty;
      history.push({
        id: deal.id,
        brandName: deal.brandName,
        totalPaid: 0,
        completedWeek: nextWeeksLived,
        result: 'breached',
      });
      notifications = pushNotification(
        notifications,
        'brand_offer',
        `Auto-breached ${deal.brandName} — scandal triggered. -$${penalty}`,
        nextWeeksLived,
      );
      continue;
    }
    if (isExpired) {
      const succeeded = postsDone >= postsNeeded;
      history.push({
        id: deal.id,
        brandName: deal.brandName,
        totalPaid: succeeded ? deal.payment : 0,
        completedWeek: nextWeeksLived,
        result: succeeded ? 'success' : 'failed',
      });
      if (succeeded) {
        dealsCompletedThisTick++;
        notifications = pushNotification(
          notifications,
          'brand_offer',
          `✅ ${deal.brandName} deal complete — $${(deal.payment || 0).toLocaleString()}`,
          nextWeeksLived,
        );
      } else {
        reputationDelta -= 5;
        notifications = pushNotification(
          notifications,
          'brand_offer',
          `${deal.brandName} deal expired without delivery. -5 reputation.`,
          nextWeeksLived,
        );
      }
      continue;
    }
    // Still active — pay weekly installment.
    const weekly = deal.weeklyPayment ?? Math.floor((deal.payment || 0) / Math.max(1, deal.expiresIn || 1));
    pulseEarnings += weekly;
    activeDeals.push({ ...deal, expiresIn: Math.max(0, deal.expiresIn - 1) });
  }

  // ── 9. Pay weekly impression earnings (skipping 7/8: NPC feed for now) ──
  const impressionEarnings = Math.floor(
    calculateWeeklyImpressionEarnings(
      followers,
      sm.influenceLevel || influenceLevelForFollowers(followers),
      sm.totalPosts || 0,
      sm.viralPosts || 0,
    ) * proMultiplier,
  );
  pulseEarnings += impressionEarnings;

  // ── 11. Verified Pro renewal/expiry check ───────────────────────────────
  let verifiedPro = sm.verifiedPro;
  let verifiedProWeeksDelta = 0;
  if (verifiedPro && verifiedPro.active && verifiedPro.expiresTimestamp) {
    if (verifiedPro.expiresTimestamp < Date.now()) {
      verifiedPro = {
        ...verifiedPro,
        active: false,
        perksUnlocked: {
          ...verifiedPro.perksUnlocked,
          postBoostMultiplier: 1.0,
          blueCheckmark: false,
          analyticsUnlocked: false,
          noAdsInFeed: false,
          longerPosts: false,
        },
      };
      notifications = pushNotification(
        notifications,
        'verified_pro_renewal',
        'Your Verified Pro subscription expired.',
        nextWeeksLived,
      );
    } else {
      verifiedProWeeksDelta = 1;
    }
  }

  // ── 12. Lifetime stats ──────────────────────────────────────────────────
  const newInfluence = influenceLevelForFollowers(followers);
  const lifetimeStats: PulseLifetimeStats = {
    peakFollowers: Math.max(sm.lifetimeStats?.peakFollowers ?? 0, followers),
    peakInfluenceLevel: rankInfluence(sm.lifetimeStats?.peakInfluenceLevel ?? 'novice', newInfluence),
    totalScandalsSurvived: (sm.lifetimeStats?.totalScandalsSurvived ?? 0) + scandalsSurvivedThisTick,
    totalBrandDealsCompleted: (sm.lifetimeStats?.totalBrandDealsCompleted ?? 0) + dealsCompletedThisTick,
    totalGemsBoostsUsed: sm.lifetimeStats?.totalGemsBoostsUsed ?? 0,
    totalVerifiedProWeeks: (sm.lifetimeStats?.totalVerifiedProWeeks ?? 0) + verifiedProWeeksDelta,
  };

  // ── 13. Assemble new socialMedia state ──────────────────────────────────
  const newSocialMedia: NonNullable<GameState['socialMedia']> = {
    ...sm,
    followers,
    influenceLevel: newInfluence,
    engagementRate,
    trendingHashtags: trending,
    activeScandal,
    scandalHistory,
    brandInbox: { pending, declined: brandInbox.declined, history },
    activeBrandDeals: activeDeals,
    notifications: notifications.slice(0, NOTIFICATION_CAP),
    verifiedPro,
    lifetimeStats,
    totalEarnings: (sm.totalEarnings || 0) + Math.max(0, pulseEarnings),
  };

  return {
    socialMedia: newSocialMedia,
    pulseEarnings,
    reputationDelta,
    scandalFollowerLoss,
  };
}

const INFLUENCE_RANK: Record<PulseInfluenceLevel, number> = {
  novice: 0,
  rising: 1,
  popular: 2,
  influencer: 3,
  celebrity: 4,
};

function rankInfluence(a: PulseInfluenceLevel, b: PulseInfluenceLevel): PulseInfluenceLevel {
  return INFLUENCE_RANK[a] >= INFLUENCE_RANK[b] ? a : b;
}
