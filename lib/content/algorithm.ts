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

export interface VideoOutcomeInput {
  quality: QualityBreakdown | number;
  subscribers: number;
  /** RNG roll 0..1 (caller seeds for determinism). */
  rollViral: number;
  /** Optional bonus for hot games. */
  trendBonus?: number;
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

  const views = Math.max(0, Math.round(baseReach * qMult * trend * viralMult));
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
  const viewers = Math.max(0, Math.round(baseViewers * qMult * durationFactor));

  // ~8% chance of a "hype train" — small viewer/donation burst.
  const hypeTrain = input.rollHype < 0.08;
  const hypeMult = hypeTrain ? 2.5 : 1;

  // Follower / sub conversion.
  const newFollowers = Math.max(0, Math.round(viewers * 0.02 * qMult));
  const newSubs = Math.max(0, Math.round(viewers * 0.004 * qMult * hypeMult));

  // Donations: per-viewer * tier * hype.
  const donations = Math.max(0, Math.round(viewers * 0.6 * qMult * hypeMult));

  return { viewers, newFollowers, newSubs, donations, hypeTrain };
}
