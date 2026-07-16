/**
 * Weekly marriage-anniversary grant.
 *
 * Background: `checkAnniversary` (DatingActions) grants happiness, logs a
 * lifeMilestone, and auto-posts to Pulse on each 1-year marriage boundary — but
 * its ONLY runtime caller was a `useEffect` in ContactsApp, so the reward fired
 * ONLY if the Contacts app happened to be mounted during the exact anniversary
 * week and was silently missed otherwise. This helper moves that grant into the
 * weekly tick so it lands for every married player regardless of which screen is
 * open.
 *
 * Guarantees (matching the audit requirements):
 *   - DETERMINISTIC: no `Math.random()` / `Date.now()`. The milestone + post ids
 *     are keyed on the absolute anniversary week (`nextWeeksLived`) + spouse id,
 *     and the post timestamp is the tick's pre-rolled `preRolls.timestamp` — the
 *     same deterministic clock pulseTick consumes.
 *   - IDEMPOTENT: the same `alreadyCelebrated` guard the legacy code used (one
 *     'anniversary' milestone per spouse + yearsMarried), so a re-processed week
 *     or a StrictMode double-invoke can never double-grant.
 *
 * Pure: returns the pieces to fold into the tick's final state. The caller adds
 * `happinessBonus` into `newStats.happiness` (clamped), appends `milestone` to
 * `lifeMilestones`, and prepends `post` to `socialMedia.recentPosts`.
 */

import type { GameState, LifeMilestone, PulseRecentPost, Relationship } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { milestoneToPulsePost, shouldAutoPostMilestone } from '@/lib/dating/sparkPulseBridge';
import { logger } from '@/utils/logger';

export interface AnniversaryResult {
  isAnniversary: boolean;
  yearsMarried: number;
  /** Happiness to ADD to newStats (0 when no anniversary fires). */
  happinessBonus: number;
  /** Milestone to append to lifeMilestones, or null. */
  milestone: LifeMilestone | null;
  /** Deterministic Pulse post to prepend to socialMedia.recentPosts, or null
   *  (null when not an anniversary, or the player has never posted). */
  post: PulseRecentPost | null;
}

const NO_ANNIVERSARY: AnniversaryResult = {
  isAnniversary: false,
  yearsMarried: 0,
  happinessBonus: 0,
  milestone: null,
  post: null,
};

export function applyAnniversaries(params: {
  prevState: GameState;
  /** Post-tick relationships (spouse fields are preserved through the tick). */
  relationships: Relationship[];
  /** Absolute post-tick week — the anniversary is evaluated against this. */
  nextWeeksLived: number;
  nextYear: number;
  /** Deterministic tick clock (preRolls.timestamp) for the post timestamp. */
  timestamp: number;
}): AnniversaryResult {
  const { prevState, relationships, nextWeeksLived, nextYear, timestamp } = params;

  const spouse = relationships.find((r) => r && r.type === 'spouse');
  if (!spouse || !spouse.anniversaryWeek) return NO_ANNIVERSARY;

  const absoluteWeek = nextWeeksLived || 0;
  const marriageWeek = spouse.marriageWeek ?? spouse.anniversaryWeek;
  if (typeof marriageWeek !== 'number' || !isFinite(marriageWeek)) return NO_ANNIVERSARY;

  // P0-12: legacy saves stored marriageWeek as the cyclic 1-4 value. We can't
  // reconstruct the original absolute week, so skip those saves rather than fire
  // a wrong-week anniversary. (Preserved verbatim from checkAnniversary.)
  if (marriageWeek <= 4 && absoluteWeek > 4) return NO_ANNIVERSARY;

  const weeksMarried = Math.max(0, absoluteWeek - marriageWeek);
  if (!(weeksMarried > 0 && weeksMarried % WEEKS_PER_YEAR === 0)) return NO_ANNIVERSARY;

  const yearsMarried = Math.floor(weeksMarried / WEEKS_PER_YEAR);

  // IDEMPOTENT: one grant per (spouse, yearsMarried). Guards migrated saves that
  // already celebrated via the old ContactsApp path, and StrictMode re-invokes.
  const alreadyCelebrated = (prevState.lifeMilestones || []).some(
    (m) =>
      m.type === 'anniversary' &&
      m.partnerId === spouse.id &&
      (m.details as { yearsMarried?: number } | undefined)?.yearsMarried === yearsMarried,
  );
  if (alreadyCelebrated) return NO_ANNIVERSARY;

  const milestone: LifeMilestone = {
    id: `anniversary_${nextWeeksLived}_${spouse.id}`,
    type: 'anniversary',
    week: nextWeeksLived,
    year: nextYear,
    partnerId: spouse.id,
    details: { yearsMarried },
  };

  // Deterministic Pulse auto-post — only for players who already post (matching
  // shouldAutoPostMilestone). Unlike the interactive composePost path, this does
  // not roll viral chance / follower gains / energy cost (that lives in pulseTick
  // and would break tick determinism); it is a faithful, seed-free feed entry.
  let post: PulseRecentPost | null = null;
  if (shouldAutoPostMilestone(prevState)) {
    const args = milestoneToPulsePost({ kind: 'anniversary', partnerName: spouse.name, yearsMarried });
    if (args) {
      post = {
        id: `pp_anniversary_${nextWeeksLived}_${spouse.id}`,
        content: args.content,
        likes: 0,
        comments: 0,
        reposts: 0,
        views: 0,
        bookmarks: 0,
        timestamp,
        gameWeek: nextWeeksLived,
        contentType: args.contentType,
        category: args.category,
        hashtags: args.hashtags,
        isViral: false,
      };
    }
  }

  logger.info(
    `[ANNIVERSARY] ${yearsMarried}-year anniversary with ${spouse.name} — +${10 + yearsMarried} happiness`,
  );

  return {
    isAnniversary: true,
    yearsMarried,
    happinessBonus: 10 + yearsMarried,
    milestone,
    post,
  };
}
