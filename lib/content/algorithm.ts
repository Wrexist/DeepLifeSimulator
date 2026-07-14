/**
 * Content algorithm — pure view + subscriber distribution model.
 *
 * Replaces the two divergent formulas that lived in GamingApp.tsx and
 * GamingStreamingApp.tsx with a single function that:
 *   1. Sets a base view count from creator's follower count.
 *   2. Applies a quality multiplier from gear.
 *   3. Rolls a viral coefficient (small probability of a 5–20× spike).
 *   4. Adds platform-specific factors (videos vs. streams).
 */

import { qualityMultiplier, QualityBreakdown } from './quality';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * Per-post ORGANIC reach multiplier from a 0..1 roll — the thing that makes
 * every upload/stream land a different, believable number instead of a fixed
 * value. Skewed (lognormal-ish) and centred near 1.0:
 *   • ~15% "flop" band  → 0.40×–0.72× (a post that under-performs)
 *   • ~70% typical band → 0.72×–1.45× (most posts, median ≈ 1.0×)
 *   • ~15% "pop" band   → 1.45×–2.20× (a post that over-performs)
 * This is INDEPENDENT of the rare viral spike, which multiplies on top.
 *
 * IMPORTANT (neutral default): callers pass `rollOrganic` as an OPTIONAL input.
 * When it is omitted the outcome functions use a multiplier of exactly 1.0, so
 * they reproduce the pre-variance result bit-for-bit — this is what keeps the
 * existing deterministic tests (and the weekly-tick snapshots) unchanged.
 */
export function organicMultiplier(roll: number): number {
  const r = Math.max(0, Math.min(0.999999, safe(roll, 0.5)));
  if (r < 0.15) {
    // Flop band: 0.40 .. 0.72
    return 0.4 + (r / 0.15) * 0.32;
  }
  if (r < 0.85) {
    // Typical band: 0.72 .. 1.45 (median lands just under 1.0)
    return 0.72 + ((r - 0.15) / 0.7) * 0.73;
  }
  // Pop band: 1.45 .. 2.20
  return 1.45 + ((r - 0.85) / 0.15) * 0.75;
}

/** Resolve the organic multiplier: neutral 1.0 when the roll is omitted. */
const resolveOrganic = (roll: number | undefined): number =>
  roll == null ? 1 : organicMultiplier(roll);

export interface VideoOutcomeInput {
  quality: QualityBreakdown | number;
  subscribers: number;
  /** RNG roll 0..1 (caller seeds for determinism). */
  rollViral: number;
  /** Optional bonus for hot games. */
  trendBonus?: number;
  /**
   * Optional per-post organic-reach roll 0..1. Omitted → neutral 1.0× (same
   * result as before variance existed). Live play passes Math.random() so each
   * upload lands a different, believable view count.
   */
  rollOrganic?: number;
}

export interface VideoOutcome {
  views: number;
  subscribersGained: number;
  viral: boolean;
}

/**
 * Compute the outcome of publishing a video. Base reach is ~5% of subscriber
 * count; quality and viral roll multiply that.
 */
export function projectVideoOutcome(input: VideoOutcomeInput): VideoOutcome {
  const subs = Math.max(0, safe(input.subscribers, 0));
  const baseReach = 200 + subs * 0.05;
  const qMult = qualityMultiplier(input.quality);
  const trend = 1 + Math.max(0, Math.min(0.5, safe(input.trendBonus, 0)));

  // ~5% chance of going viral — 5..20× burst.
  const viral = input.rollViral < 0.05;
  const viralMult = viral ? 5 + Math.floor((input.rollViral / 0.05) * 15) : 1;

  // Per-post organic variance (neutral 1.0 when the roll is omitted).
  const organic = resolveOrganic(input.rollOrganic);

  const views = Math.max(0, Math.round(baseReach * qMult * trend * organic * viralMult));
  // Subscriber conversion: 0.5% baseline, scaled by quality.
  const conversionRate = 0.005 * qMult;
  const subscribersGained = Math.max(0, Math.round(views * conversionRate));

  return { views, subscribersGained, viral };
}

export interface StreamOutcomeInput {
  quality: QualityBreakdown | number;
  followers: number;
  /** Duration in minutes. */
  duration: number;
  /** RNG roll 0..1 for raid/hype-train chance. */
  rollHype: number;
  /**
   * Probability of a hype train this stream. Defaults to 0.08 so existing
   * callers/tests are unchanged; the Streamly streak meter raises it. Clamped
   * to [0, 0.25] (the streak guardrail) so it can never explode income.
   */
  hypeChance?: number;
  /**
   * Optional per-stream organic-reach roll 0..1. Omitted → neutral 1.0× (same
   * result as before variance existed). Live play passes Math.random().
   */
  rollOrganic?: number;
  /**
   * Optional pre-determined concurrent-viewer count. When provided (e.g. the
   * accrued viewers from a real-time LIVE session) it overrides the
   * follower-derived estimate, and all downstream conversions (followers, subs,
   * donations) scale off it. Omitted → viewers are computed as before.
   */
  viewersOverride?: number;
}

export interface StreamOutcome {
  viewers: number;
  newFollowers: number;
  newSubs: number;
  donations: number;
  hypeTrain: boolean;
}

/**
 * Compute outcomes for a single stream. Concurrent viewers scale with
 * follower count and gear quality; longer streams get diminishing returns.
 */
export function projectStreamOutcome(input: StreamOutcomeInput): StreamOutcome {
  const followers = Math.max(0, safe(input.followers, 0));
  const qMult = qualityMultiplier(input.quality);
  const duration = Math.max(1, safe(input.duration, 1));

  // Diminishing returns on duration past 90 minutes.
  const durationFactor = duration <= 90 ? 1 : 1 + Math.log(duration / 90) * 0.2;
  const baseViewers = 5 + followers * 0.015;
  // Per-stream organic variance (neutral 1.0 when the roll is omitted).
  const organic = resolveOrganic(input.rollOrganic);
  const computedViewers = Math.max(0, Math.round(baseViewers * qMult * durationFactor * organic));
  // A LIVE session supplies its own accrued viewer count; everything downstream
  // scales off whichever viewer number is authoritative.
  const viewers =
    input.viewersOverride != null
      ? Math.max(0, Math.round(input.viewersOverride))
      : computedViewers;

  // Hype-train chance defaults to 8%; the Streamly streak meter can raise it,
  // but it's clamped to ≤25% so the 2.5× burst can't inflate income unbounded.
  const hypeChance = Math.max(0, Math.min(0.25, safe(input.hypeChance, 0.08)));
  const hypeTrain = input.rollHype < hypeChance;
  const hypeMult = hypeTrain ? 2.5 : 1;

  // Follower / sub conversion.
  const newFollowers = Math.max(0, Math.round(viewers * 0.02 * qMult));
  const newSubs = Math.max(0, Math.round(viewers * 0.004 * qMult * hypeMult));

  // Donations: per-viewer * tier * hype.
  const donations = Math.max(0, Math.round(viewers * 0.6 * qMult * hypeMult));

  return { viewers, newFollowers, newSubs, donations, hypeTrain };
}
