/**
 * Content monetization — pure RPM / donation / membership math.
 *
 * Centralises the per-view, per-viewer and per-sub revenue rates that were
 * previously hard-coded inside both apps and the income calc.
 */

import { qualityMultiplier, QualityBreakdown } from './quality';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Base RPM (revenue per 1,000 views) before quality multiplier. */
export const BASE_RPM = 4;
/** Base $ per viewer per stream before quality / hype multipliers. */
export const BASE_VIEWER_PAY = 0.005;
/** $ per minute of streaming (subscription airtime). */
export const BASE_DURATION_PAY = 0.02;
/** Monthly membership rate per paid member. */
export const BASE_MEMBERSHIP_RATE = 4.99;

/**
 * Compute the realised earnings for a freshly-published video.
 */
export function videoEarnings(views: number, quality: QualityBreakdown | number): number {
  const rpm = BASE_RPM * qualityMultiplier(quality);
  return Math.round((Math.max(0, safe(views, 0)) / 1000) * rpm);
}

/**
 * Compute realised earnings for a completed stream.
 *
 *   viewer revenue   + duration revenue + tipped donations
 */
export function streamEarnings(
  viewers: number,
  durationMinutes: number,
  donations: number,
  quality: QualityBreakdown | number
): number {
  const qMult = qualityMultiplier(quality);
  const viewerRev = Math.max(0, safe(viewers, 0)) * BASE_VIEWER_PAY * qMult;
  const durationRev = Math.max(0, safe(durationMinutes, 0)) * BASE_DURATION_PAY;
  return Math.round(viewerRev + durationRev + Math.max(0, safe(donations, 0)));
}

/**
 * Weekly recurring revenue from paid members. Each paid member pays `rate` per
 * week — the SAME formula the weekly `applyContentMemberships` payout uses — so
 * the "Members/wk" figure the UI shows matches what actually lands in cash.
 */
export function membershipWeeklyRevenue(members: number, rate = BASE_MEMBERSHIP_RATE): number {
  return Math.round(Math.max(0, safe(members, 0)) * Math.max(0, safe(rate, BASE_MEMBERSHIP_RATE)));
}

export interface MonetizationSummary {
  rpm: number;
  viewerPay: number;
  membershipWeekly: number;
}

/**
 * Surface the player's current monetization rates for a UI breakdown.
 */
export function monetizationSummary(
  quality: QualityBreakdown | number,
  paidMembers: number,
  membershipRate: number = BASE_MEMBERSHIP_RATE
): MonetizationSummary {
  const q = qualityMultiplier(quality);
  return {
    rpm: Math.round(BASE_RPM * q * 100) / 100,
    viewerPay: Math.round(BASE_VIEWER_PAY * q * 1000) / 1000,
    membershipWeekly: membershipWeeklyRevenue(paidMembers, membershipRate),
  };
}
