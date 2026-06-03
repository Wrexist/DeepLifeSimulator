/**
 * Spark weekly tick — processes the dating app each game week.
 *
 * Called once per nextWeek() advance from GameActionsContext.tsx, inside the
 * setGameState updater. Pure function — no React, no side effects on input.
 *
 * Order of operations (all use `nextWeeksLived`, NEVER the cyclic 1-4 week):
 *   1. Swipe quota reset
 *   2. Super-like quota reset
 *   3. Boost expiry
 *   4. Premium subscription renewal/expiry
 *   5. Jealousy event spawn (probability based on swipes × partners)
 *   6. "Liked you" buffer top-up (premium-tier-gated)
 *   7. Lifetime premium-weeks tally
 */
import type {
  GameState,
  SparkAppState,
  SparkJealousyEvent,
  SparkLikedYouEntry,
} from '@/contexts/game/types';
import { perksForTier, calculateJealousyRisk } from './sparkLogic';
import { DATING_PROFILES } from './datingProfiles';

export interface SparkTickResult {
  sparkApp: NonNullable<GameState['sparkApp']>;
  /** Notifications surfaced by the tick (jealousy fired, premium expired). */
  notifications: string[];
}

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10_000) / 10_000;
}

export function processSparkWeeklyTick(
  state: GameState,
  nextWeeksLived: number,
): SparkTickResult {
  const baseSpark: SparkAppState = state.sparkApp ?? {
    profile: { bio: '', photos: [], interests: [], showAge: true, showJob: true, showWealth: false },
    swipes: [],
    matches: [],
    messages: {},
    swipeQuota: 30,
    swipesUsedThisWeek: 0,
    lastQuotaResetWeek: nextWeeksLived,
    superLikesUsedThisWeek: 0,
    premium: { active: false, tier: 'free', perks: perksForTier('free') },
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
  };

  // Defensive clone — never mutate input.
  const sp: SparkAppState = {
    ...baseSpark,
    matches: [...baseSpark.matches],
    swipes: [...baseSpark.swipes],
    likedYou: [...baseSpark.likedYou],
    premium: { ...baseSpark.premium, perks: { ...baseSpark.premium.perks } },
    lifetimeStats: { ...baseSpark.lifetimeStats },
    jealousyHistory: [...baseSpark.jealousyHistory],
  };

  const notifications: string[] = [];

  // 1. Swipe quota reset (every week)
  if (nextWeeksLived > sp.lastQuotaResetWeek) {
    sp.swipesUsedThisWeek = 0;
    sp.superLikesUsedThisWeek = 0;
    sp.lastQuotaResetWeek = nextWeeksLived;
  }

  // 3. Boost expiry
  if (sp.boost && sp.boost.expiresWeek <= nextWeeksLived) {
    sp.boost = null;
  }

  // 4. Premium renewal / expiry
  if (sp.premium.active && sp.premium.expiresTimestamp) {
    if (sp.premium.expiresTimestamp < Date.now()) {
      sp.premium = {
        active: false,
        tier: 'free',
        perks: perksForTier('free'),
      };
      notifications.push('Your Spark Premium expired');
    } else {
      sp.lifetimeStats.totalPremiumWeeks += 1;
    }
  }

  // 5. Jealousy event spawn — at most 1 active at a time, deterministic per week
  if (!sp.activeJealousy) {
    const risk = calculateJealousyRisk(state);
    if (risk > 0) {
      const rng = seededRandom(`spark-jealousy|${state.lineageId ?? 'init'}|${nextWeeksLived}`);
      if (rng < risk) {
        const partners = (state.relationships ?? []).filter(
          (r) => (r.type === 'partner' || r.type === 'spouse') && (r.relationshipScore ?? 0) > 40,
        );
        if (partners.length > 0) {
          const partner = partners[Math.floor(rng * partners.length)];
          const triggers: SparkJealousyEvent['triggerType'][] =
            ['spotted_swiping', 'rumored_affair', 'multiple_dating', 'flirty_dm'];
          const trigger = triggers[Math.floor((rng * 10_000) % triggers.length)];
          sp.activeJealousy = {
            id: `sj-${nextWeeksLived}-${partner.id}`,
            partnerId: partner.id,
            triggerType: trigger,
            severity: Math.floor(40 + rng * 50),
            startedWeek: nextWeeksLived,
            resolved: false,
          };
          notifications.push(`${partner.name} is suspicious about Spark activity`);
        }
      }
    }
  }

  // 6. Liked-you top-up — Ultra sees who likes them, Plus sees a count only
  if (sp.premium.perks.seeWhoLikedYou) {
    // Seed 1-3 fresh "liked you" entries from random profiles each week
    const targetCount = Math.min(20, sp.likedYou.length + 1 + Math.floor(Math.random() * 3));
    while (sp.likedYou.length < targetCount) {
      const p = DATING_PROFILES[Math.floor(Math.random() * DATING_PROFILES.length)];
      if (!sp.likedYou.some((l) => l.profileId === p.id)) {
        const entry: SparkLikedYouEntry = {
          profileId: p.id,
          likedAtWeek: nextWeeksLived,
          superLiked: Math.random() < 0.1,
        };
        sp.likedYou.push(entry);
      } else {
        break; // avoid infinite loop if all profiles already in the list
      }
    }
  } else {
    // Even free users accumulate hidden "liked you" entries — Plus upsell teaser
    if (Math.random() < 0.5 && sp.likedYou.length < 20) {
      const p = DATING_PROFILES[Math.floor(Math.random() * DATING_PROFILES.length)];
      if (!sp.likedYou.some((l) => l.profileId === p.id)) {
        sp.likedYou.push({ profileId: p.id, likedAtWeek: nextWeeksLived, superLiked: false });
      }
    }
  }

  return { sparkApp: sp, notifications };
}
