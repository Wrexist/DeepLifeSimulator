/**
 * Weekly channel-memberships payout (STATE_VERSION 22, shared by YouVideo +
 * Streamly). Turns the two creator apps' "Members" / "Sub earn" figures into a
 * real, bounded income stream: a capped fraction of subscribers convert to paid
 * members, each paying the channel's membership rate weekly.
 *
 * ── Money-printing guardrails (all enforced here) ──────────────────────────
 *   - Paid members ≤ 5% of subscribers AND ≤ an absolute member ceiling.
 *   - Membership rate is clamped to a sane band so a tampered rate can't explode.
 *   - Weekly revenue is capped at $75K/wk — the SAME per-source cap the passive
 *     income aggregator applies to gaming/streaming.
 *   - Idempotent per week via `lastMemberWeek`: a re-run in the same week pays $0.
 *
 * Writes cash (with a reason) and accumulates `totalSubEarnings`. Pure function —
 * no React, no setGameState, no wall-clock (uses `currentWeek`).
 */
import type { GamingStreamingState } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Max fraction of subscribers that can be paid members. */
export const MEMBERSHIP_SUB_FRACTION = 0.05;
/** Absolute ceiling on paid members (bounds a mega-channel's 5%). */
export const MEMBERSHIP_MEMBER_CEILING = 50000;
/** Membership rate clamp band ($/member/week). */
export const MEMBERSHIP_RATE_MIN = 1;
export const MEMBERSHIP_RATE_MAX = 50;
/** $75K/wk per-source revenue cap — matches the gaming/streaming income cap. */
export const MEMBERSHIP_WEEKLY_CAP = 75000;

export interface ContentMembershipsInput {
  gamingStreaming: GamingStreamingState | undefined;
  currentWeek: number;
}

export interface ContentMembershipsResult {
  gamingStreaming: GamingStreamingState | undefined;
  /** Cash to credit the player this week. */
  cashDelta: number;
  /** Reason string for the money helper / day summary. */
  reason: string;
  /** Paid members resolved this week (post-cap). */
  paidMembers: number;
  /** Revenue added to totalSubEarnings this week. */
  totalSubEarningsDelta: number;
}

const noop = (gs: GamingStreamingState | undefined): ContentMembershipsResult => ({
  gamingStreaming: gs,
  cashDelta: 0,
  reason: 'Channel memberships',
  paidMembers: 0,
  totalSubEarningsDelta: 0,
});

export function applyContentMemberships(input: ContentMembershipsInput): ContentMembershipsResult {
  const gs = input.gamingStreaming;
  if (!gs) return noop(gs);

  // Idempotence: already paid this week → no-op.
  if (safe(gs.lastMemberWeek, -1) === input.currentWeek) return noop(gs);

  const subscribers = Math.max(0, safe(gs.subscribers));
  // ≤ 5% of subscribers, and ≤ the absolute ceiling.
  const paidMembers = Math.min(
    Math.floor(subscribers * MEMBERSHIP_SUB_FRACTION),
    MEMBERSHIP_MEMBER_CEILING,
  );

  const rate = Math.max(MEMBERSHIP_RATE_MIN, Math.min(MEMBERSHIP_RATE_MAX, safe(gs.membershipRate, 4)));
  const gross = paidMembers * rate;
  const revenue = Math.max(0, Math.min(gross, MEMBERSHIP_WEEKLY_CAP));

  const nextGs: GamingStreamingState = {
    ...gs,
    paidMembers,
    totalSubEarnings: safe(gs.totalSubEarnings) + revenue,
    lastMemberWeek: input.currentWeek,
  };

  return {
    gamingStreaming: nextGs,
    cashDelta: revenue,
    reason: 'Channel memberships',
    paidMembers,
    totalSubEarningsDelta: revenue,
  };
}
