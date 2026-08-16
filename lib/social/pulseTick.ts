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

import { fnv1a32 } from '@/utils/seededRoll';
import type { GameState ,
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
  PulseComment,
  PulseScandalType,
} from '@/contexts/game/types';
import {
  calculateEngagementRate,
  calculateFollowerDecay,
  calculateWeeklyImpressionEarnings,
} from './socialMedia';
import { generateBrandOffersExtended } from './brandPartnerships';
import { generateScandalPileOnComments } from './randomProfiles';

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
// 4, not 3: the generator emits up to 4 tiers (sponsored / deal / long_campaign
// / ambassador) and slice(0, N) previously dropped the top-tier ambassador deal
// (the premier endgame offer) every single week.
const BRAND_OFFER_MAX_PER_TICK = 4;
const BRAND_OFFER_FOLLOWER_GATE = 10_000;

// ── Organic scandal spawn (Wave A) ──────────────────────────────────────────
// Fame turns double-edged: once the player is popular+ (10K followers) a low
// weekly chance — scaled by an accumulating, decaying risk score — can erupt
// into a scandal the player must survive through the existing recovery flow.
// All caps mirror the audit guardrails: popular+ gate, post-resolution
// cooldown, one scandal at a time, and the existing 0.5%/wk follower cascade.
const SCANDAL_SPAWN_FOLLOWER_GATE = 10_000; // popular tier or above
const SCANDAL_COOLDOWN_WEEKS = 6;           // quiet period after a scandal blows over
const SCANDAL_RISK_DECAY = 0.85;            // weekly multiplicative decay of the risk accumulator
const SCANDAL_RISK_CAP = 100;               // risk score clamp
const SCANDAL_SPAWN_MAX_CHANCE = 0.1;       // hard ceiling on weekly spawn probability
// Per-tier weekly risk accrual — the more famous, the more scrutiny.
const SCANDAL_RISK_ACCRUAL: Record<PulseInfluenceLevel, number> = {
  novice: 0,
  rising: 0,
  popular: 2,
  influencer: 4,
  celebrity: 6,
};
const SCANDAL_TYPES: PulseScandalType[] = [
  'bad_take',
  'leaked_dm',
  'cancel',
  'deepfake',
  'brand_betrayal',
  'public_meltdown',
];
const SCANDAL_HEADLINES: Record<PulseScandalType, string[]> = {
  bad_take: ['Your old take resurfaces and the timeline turns', 'A hot take spirals out of control'],
  leaked_dm: ['Private DMs leak across the feed', 'Screenshots of your messages go viral'],
  cancel: ['A callout thread snowballs overnight', '#Cancelled starts trending with your name'],
  deepfake: ['A deepfake of you spreads faster than the debunk', 'A fabricated clip fools thousands'],
  brand_betrayal: ['A brand publicly cuts ties with you', 'Sponsors distance themselves after a leak'],
  public_meltdown: ['A public meltdown clip loops everywhere', 'You lose your cool on camera and it spreads'],
};
const PILE_ON_POSTS = 3;      // seed haters onto the most-recent N player posts
const PILE_ON_PER_POST = 3;   // hostile comments per targeted post
const COMMENT_THREAD_CAP = 50;
const FOLLOWER_HISTORY_CAP = 52;
const BOOST_LINGER_WEEKS = 2; // pendingBoosts entries expire after this many weeks

/**
 * Deterministic [0,1) roll from arbitrary seed parts (FNV-1a hash). Keeps the
 * scandal spawn pure so StrictMode double-invocation can't double-spawn and the
 * purity test stays green (no Math.random / Date.now in the spawn decision).
 */
const hashRoll = (...parts: (number | string)[]): number => {
  // FNV-1a body moved to the shared `fnv1a32` (audit H7c). Bit-identical to the
  // hand-rolled loop that was here, so every existing roll is unchanged.
  return (fnv1a32(parts.join('|')) % 100000) / 100000;
};

// Deterministic notification id. `seq` (the current list length at push time)
// discriminates multiple same-kind notifications within one tick, so ids are
// stable across reloads / StrictMode double-invoke instead of Math.random.
const newNotificationId = (week: number, kind: string, seq: number): string =>
  `notif_${week}_${kind}_${seq}`;

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
      id: newNotificationId(weeksLived, type, list.length),
      type,
      // Seeded from the game week (deterministic) rather than wall-clock
      // Date.now(), which was save-scummable + StrictMode-inconsistent.
      timestamp: weeksLived,
      gameWeek: weeksLived,
      read: false,
      text,
      ...extra,
    },
    ...list,
  ].slice(0, NOTIFICATION_CAP);
};

const isVerifiedProActive = (vp: PulseVerifiedPro | undefined): boolean => {
  // Perk gate is the in-game `active` flag. Weekly cash billing + lapse is owned
  // by applySubscriptionsForWeek in the nextWeek orchestrator (it bills real
  // post-income cash); the old wall-clock `expiresTimestamp` expiry is gone now
  // that Verified Pro is an in-game subscription rather than a real IAP.
  return vp?.active === true;
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
      // Deterministic from (week, tag) via hashRoll so re-runs / reloads are
      // stable — the comment above promised "deterministic from week" but the
      // body used Math.random(). Distinct seed suffixes keep postCount and
      // velocity independent.
      trending.push({
        tag,
        postCount: 50 + Math.floor(hashRoll('trendPosts', nextWeeksLived, tag) * 200),
        source: 'organic',
        velocity: 0.5 + hashRoll('trendVel', nextWeeksLived, tag) * 0.5,
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
        // Populate the previously-always-absent "Why is this trending?" branch.
        whyReason: `Fallout from your ${sm.activeScandal.type.replace(/_/g, ' ')} scandal.`,
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

  // ── 4b. Scandal-risk accrual + organic spawn ────────────────────────────
  // Risk decays multiplicatively each week and accrues by influence tier, so
  // dormant/small accounts are effectively immune and famous ones face a slow,
  // bounded build-up. A spawn only fires when: no active scandal, none resolved
  // THIS tick (no whiplash), popular+ tier, the post-resolution cooldown has
  // elapsed, and a deterministic roll lands under the risk-scaled chance.
  const spawnTier = influenceLevelForFollowers(followers);
  let scandalRiskScore = Math.min(
    SCANDAL_RISK_CAP,
    (sm.scandalRiskScore ?? 0) * SCANDAL_RISK_DECAY + (SCANDAL_RISK_ACCRUAL[spawnTier] ?? 0),
  );

  const lastSurvivedWeek = scandalHistory.length > 0
    ? Math.max(...scandalHistory.map(s => s.survivedAtWeek))
    : -Infinity;
  const cooldownElapsed = nextWeeksLived - lastSurvivedWeek >= SCANDAL_COOLDOWN_WEEKS;

  if (
    !activeScandal &&
    scandalsSurvivedThisTick === 0 &&
    followers >= SCANDAL_SPAWN_FOLLOWER_GATE &&
    cooldownElapsed
  ) {
    const spawnChance = Math.min(SCANDAL_SPAWN_MAX_CHANCE, scandalRiskScore / 1000);
    const roll = hashRoll('scandal', nextWeeksLived, followers, Math.round(scandalRiskScore));
    if (roll < spawnChance) {
      const typeIdx = Math.floor(hashRoll('type', nextWeeksLived, followers) * SCANDAL_TYPES.length) % SCANDAL_TYPES.length;
      const type = SCANDAL_TYPES[typeIdx];
      const headlines = SCANDAL_HEADLINES[type];
      const headline = headlines[Math.floor(hashRoll('headline', nextWeeksLived, type) * headlines.length) % headlines.length];
      const severity = 45 + Math.floor(hashRoll('sev', nextWeeksLived, followers) * 20); // 45–64
      activeScandal = {
        id: `scandal_organic_${nextWeeksLived}`,
        type,
        severity,
        weeksRemaining: 4,
        startedWeek: nextWeeksLived,
        reputationLossThisWeek: 0,
        followerLossThisWeek: 0,
        headline,
      };
      scandalRiskScore = 0; // risk spent on the eruption
      notifications = pushNotification(
        notifications,
        'scandal_update',
        `⚠️ Scandal breaking: ${headline}.`,
        nextWeeksLived,
      );
    }
  }

  // ── 4c. Seed hostile pile-on comments while a scandal is active ──────────
  // Reuses the built-but-dead generateScandalPileOnComments. Idempotent per
  // week per post (skip a post already seeded this week) and bounded by the
  // existing 50-comments-per-thread cap.
  let commentThreads: Record<string, PulseComment[]> | undefined = sm.commentThreads;
  if (activeScandal) {
    const threads: Record<string, PulseComment[]> = { ...(sm.commentThreads ?? {}) };
    const targets = (sm.recentPosts ?? []).slice(0, PILE_ON_POSTS);
    for (const post of targets) {
      const existing = threads[post.id] ?? [];
      const alreadySeededThisWeek = existing.some(
        c => c.isFromHater && c.gameWeek === nextWeeksLived,
      );
      if (alreadySeededThisWeek) continue;
      const haters = generateScandalPileOnComments(
        activeScandal,
        post.id,
        nextWeeksLived,
        PILE_ON_PER_POST,
      );
      threads[post.id] = [...existing, ...haters].slice(-COMMENT_THREAD_CAP);
    }
    commentThreads = threads;
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
    // riskOfBreach is only ever written as 0, so the old `> 50` guard made this
    // branch dead. Gate on an active scandal alone: sponsors drop you when a
    // scandal breaks.
    const breached = Boolean(activeScandal);

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
      // Seeded ±20% variation — deterministic from week + follower count.
      hashRoll('impressionVariation', nextWeeksLived, followers),
    ) * proMultiplier,
  );
  pulseEarnings += impressionEarnings;

  // ── 11. Verified Pro lifetime-week tally ────────────────────────────────
  // In-game weekly cash billing + lapse (on insufficient funds) is handled by
  // applySubscriptionsForWeek in the nextWeek orchestrator, which bills real
  // post-income cash. Here we only tally a week while the subscription is
  // active. (Legacy wall-clock `expiresTimestamp` expiry removed — Verified Pro
  // is now an in-game cash subscription, not a real App Store IAP.)
  const verifiedPro = sm.verifiedPro;
  const verifiedProWeeksDelta = verifiedProActive ? 1 : 0;

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

  // ── 12b. Follower-history sample (Creator Studio growth chart) ──────────
  // Append one {week, followers} sample, replacing an existing same-week entry
  // (idempotent under double-invoke) and trimming to the last 52 points.
  const priorHistory = sm.followerHistory ?? [];
  const lastSample = priorHistory[priorHistory.length - 1];
  const followerHistory = (
    lastSample && lastSample.week === nextWeeksLived
      ? [...priorHistory.slice(0, -1), { week: nextWeeksLived, followers }]
      : [...priorHistory, { week: nextWeeksLived, followers }]
  ).slice(-FOLLOWER_HISTORY_CAP);

  // ── 12c. Consume/expire pendingBoosts ───────────────────────────────────
  // The gem boost effect is applied inline at boost time; this ledger only
  // needs pruning so it stops being a write-only, ever-growing orphan.
  const pendingBoosts = (sm.pendingBoosts ?? []).filter(
    b => nextWeeksLived - b.appliedWeek < BOOST_LINGER_WEEKS,
  );

  // ── 13. Assemble new socialMedia state ──────────────────────────────────
  const newSocialMedia: NonNullable<GameState['socialMedia']> = {
    ...sm,
    followers,
    influenceLevel: newInfluence,
    engagementRate,
    trendingHashtags: trending,
    activeScandal,
    // Cap history growth between saves (documented 30-cap; was unbounded).
    scandalHistory: scandalHistory.slice(-30),
    scandalRiskScore,
    commentThreads,
    followerHistory,
    pendingBoosts,
    brandInbox: { pending, declined: brandInbox.declined, history: history.slice(-30) },
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
