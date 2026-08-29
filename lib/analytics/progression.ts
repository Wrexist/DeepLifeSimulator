/**
 * Progression stages and player segments — pure classifiers.
 *
 * WHAT THIS ANSWERS. "Where does the mid-game flatten?" is the single most
 * expensive unanswered question in a life sim, and it cannot be answered from
 * `week_advanced` counts alone: a raw week histogram tells you how many weeks
 * were played, not how many players got past the point where the game stops
 * giving them anything new. A STAGE turns a continuous counter into a funnel
 * with drop-off you can point at.
 *
 * WHY IT IS A PURE FUNCTION OF PRIMITIVES. It takes five numbers, not a
 * `GameState`. That keeps it testable without `createTestGameState`, keeps
 * `lib/analytics` off the game's type graph at runtime, and — the real reason —
 * makes the classification auditable: you can read the rule and recompute any
 * player's stage by hand from five values in the event.
 *
 * WHY WEEKS ARE MEASURED IN THIS LIFE, NOT ABSOLUTE. `weeksLived` is seeded
 * from the starting age (`(age - 18) * 52`), so an age-25 character begins at
 * 364 — every "has this player played N weeks" test against the raw counter is
 * already true before the first frame. That has caused three shipped bugs in
 * this repo (CLAUDE.md §4.2). The input here is weeks into THIS life, resolved
 * by the caller through `weeksSinceLifeStart`, and the field name says so.
 */

/**
 * The stage ladder, in order.
 *
 * `endgame` is separated from `late` because they fail differently: a player
 * who reaches late-game and stops has run out of CONTENT, while a player who
 * prestiges has opted into the loop again and stopping there is a LOOP problem.
 * Collapsing them would average the two into one uninterpretable number.
 */
export const PROGRESSION_STAGES = ['new', 'early', 'mid', 'late', 'endgame'] as const;
export type ProgressionStage = (typeof PROGRESSION_STAGES)[number];

/** Week boundaries, in weeks lived in the CURRENT life. */
export const STAGE_WEEK_THRESHOLDS = {
  /** Below this the player is still in the first-session window. */
  early: 4,
  /** One in-game year. */
  mid: 52,
  /** Five in-game years — where the careers/business ladders top out. */
  late: 260,
} as const;

export interface ProgressionInput {
  /** Weeks into the CURRENT life (NOT raw `weeksLived`). See the header. */
  weeksThisLife: number;
  /** `prestige.totalPrestiges` — 0 for a player who has never reset. */
  totalPrestiges: number;
}

/**
 * Classify a player into one stage.
 *
 * Prestige dominates the week count on purpose: a player on their second life
 * is in the endgame loop even at week 1 of that life, and classifying them as
 * `new` would put experienced players into the new-player funnel and make
 * onboarding drop-off look better than it is.
 */
export function resolveProgressionStage(input: ProgressionInput): ProgressionStage {
  const prestiges = Number.isFinite(input.totalPrestiges) ? input.totalPrestiges : 0;
  if (prestiges > 0) return 'endgame';

  const weeks = Number.isFinite(input.weeksThisLife) ? Math.max(0, input.weeksThisLife) : 0;
  if (weeks < STAGE_WEEK_THRESHOLDS.early) return 'new';
  if (weeks < STAGE_WEEK_THRESHOLDS.mid) return 'early';
  if (weeks < STAGE_WEEK_THRESHOLDS.late) return 'mid';
  return 'late';
}

/** Numeric rank, so "did the player move FORWARD" is a comparison. */
export function stageRank(stage: ProgressionStage): number {
  const index = PROGRESSION_STAGES.indexOf(stage);
  return index < 0 ? 0 : index;
}

// ── Segments (§24) ──────────────────────────────────────────────────────────

/**
 * Engagement segment, from the retention cohort's own counters.
 *
 * Deliberately three buckets, not seven. A segment earns its place by changing
 * a decision, and "sessions per day seen" supports exactly three: the player
 * who came once and left, the ordinary player, and the one whose behaviour is
 * worth understanding because it is what the others could become.
 */
export const ENGAGEMENT_SEGMENTS = ['one_session', 'casual', 'engaged'] as const;
export type EngagementSegment = (typeof ENGAGEMENT_SEGMENTS)[number];

export function resolveEngagementSegment(sessions: number, daysSeen: number): EngagementSegment {
  const s = Number.isFinite(sessions) ? Math.max(0, sessions) : 0;
  const d = Number.isFinite(daysSeen) ? Math.max(0, daysSeen) : 0;
  if (s <= 1) return 'one_session';
  // Per-day rate rather than a raw total, so a player who has been installed for
  // a month is not counted as engaged purely for having been around longer.
  const perDay = d > 0 ? s / d : s;
  return d >= 3 && perDay >= 2 ? 'engaged' : 'casual';
}

/**
 * Monetisation segment.
 *
 * `lapsed` is kept apart from `free` because they are different products: one
 * has never been asked, the other has answered and left. Treating a lapsed
 * subscriber as free is how win-back campaigns end up targeting people who
 * never converted in the first place.
 */
export const MONETISATION_SEGMENTS = ['free', 'trial', 'subscriber', 'lapsed'] as const;
export type MonetisationSegment = (typeof MONETISATION_SEGMENTS)[number];

export function resolveMonetisationSegment(input: {
  isSubscriber: boolean;
  isTrial: boolean;
  hasEverSubscribed: boolean;
}): MonetisationSegment {
  if (input.isTrial) return 'trial';
  if (input.isSubscriber) return 'subscriber';
  if (input.hasEverSubscribed) return 'lapsed';
  return 'free';
}
