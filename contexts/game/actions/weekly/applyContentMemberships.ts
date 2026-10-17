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
 *   - The capped revenue is then scaled by the net-worth soft cap
 *     (`softCapEfficiency`), the same multiplier the creator app's ad revenue
 *     gets inside `calcWeeklyPassiveIncome`.
 *   - Idempotent per week via `lastMemberWeek`: a re-run in the same week pays $0.
 *
 * ── It is TAXED, by the caller ─────────────────────────────────────────────
 * `cashDelta` is GROSS (pre-tax) income. The week loop computes it BEFORE the
 * income tax, adds it to the taxable base beside rent and luxury yield, and
 * credits it through the same cash line as salary — so it is taxed at the
 * margin and can settle its own tax. Until 2026-10-17 it was credited to cash
 * late in the tick, after tax had already been computed, so a $74,850/wk
 * channel paid $0 tax while the same app's ad revenue was taxed at up to 40%.
 *
 * Pure function — no React, no setGameState, no wall-clock (uses `currentWeek`).
 */
import type { GameState, GamingStreamingState } from '@/contexts/game/types';
import { managementLevels, passiveIncomeEfficiency } from '@/lib/economy/passiveIncome';
import { netWorth } from '@/lib/progress/achievements';

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
  /**
   * Net-worth soft-cap efficiency, 0..1 (1 = no drag). Pass
   * `membershipSoftCapEfficiency(state)`. Omitted → 1, so a caller that does
   * not know the player's wealth can never be paid MORE than the cap allows.
   */
  softCapEfficiency?: number;
}

export interface ContentMembershipsResult {
  gamingStreaming: GamingStreamingState | undefined;
  /** GROSS (pre-tax) cash this week. The caller taxes it with the rest of income. */
  cashDelta: number;
  /** Reason string for the money helper / day summary. */
  reason: string;
  /** Paid members resolved this week (post-cap). */
  paidMembers: number;
  /** Revenue added to totalSubEarnings this week. */
  totalSubEarningsDelta: number;
}

/** "Memberships did nothing this week" — also the guardTick fallback. */
export const noMembershipPayout = (gs: GamingStreamingState | undefined): ContentMembershipsResult => ({
  gamingStreaming: gs,
  cashDelta: 0,
  reason: 'Channel memberships',
  paidMembers: 0,
  totalSubEarningsDelta: 0,
});

/**
 * The net-worth soft-cap efficiency for this player — the SAME expression
 * `calcWeeklyPassiveIncome` and `companyIncomePaidWeekly` use, so memberships
 * and the ad revenue beside them are dragged by the same number.
 */
export function membershipSoftCapEfficiency(state: GameState): number {
  return passiveIncomeEfficiency(netWorth(state), managementLevels(state?.companies));
}

/**
 * The weekly GROSS (pre-tax) payout for `paidMembers` at `rate` — the one
 * formula both the tick and the creator apps' "Members / wk" readout use, so
 * the figure shown is the figure that enters the tax base.
 *
 * Rate clamped to the band, revenue capped at $75K/wk, then scaled by the
 * net-worth soft cap — AFTER the per-source cap, the order passive income
 * applies them. The efficiency is clamped to 0..1 so a garbage value can never
 * amplify the payout. At efficiency 1 (below the $10M threshold) the figure is
 * untouched, cents and all, so every pre-existing payout is byte-identical.
 */
export function membershipPayout(
  paidMembers: number,
  rate: number | undefined,
  softCapEfficiency: number = 1,
): number {
  const members = Math.max(0, safe(paidMembers));
  const clampedRate = Math.max(MEMBERSHIP_RATE_MIN, Math.min(MEMBERSHIP_RATE_MAX, safe(rate, 4)));
  const capped = Math.max(0, Math.min(members * clampedRate, MEMBERSHIP_WEEKLY_CAP));
  const efficiency = Math.max(0, Math.min(1, safe(softCapEfficiency, 1)));
  return efficiency < 1 ? Math.round(capped * efficiency) : capped;
}

export function applyContentMemberships(input: ContentMembershipsInput): ContentMembershipsResult {
  const gs = input.gamingStreaming;
  if (!gs) return noMembershipPayout(gs);

  // Idempotence: already paid this week → no-op.
  if (safe(gs.lastMemberWeek, -1) === input.currentWeek) return noMembershipPayout(gs);

  const subscribers = Math.max(0, safe(gs.subscribers));
  // ≤ 5% of subscribers, and ≤ the absolute ceiling.
  const paidMembers = Math.min(
    Math.floor(subscribers * MEMBERSHIP_SUB_FRACTION),
    MEMBERSHIP_MEMBER_CEILING,
  );

  const revenue = membershipPayout(paidMembers, gs.membershipRate, input.softCapEfficiency);

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
