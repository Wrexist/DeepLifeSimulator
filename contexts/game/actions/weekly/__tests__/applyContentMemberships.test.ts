/**
 * Weekly channel memberships (v22, shared YouVideo + Streamly). Pins the money-
 * printing guardrails: paid members ≤ 5% of subscribers, revenue capped at
 * $75K/wk, rate clamped, and idempotent per week via lastMemberWeek.
 */
import {
  applyContentMemberships,
  membershipSoftCapEfficiency,
  noMembershipPayout,
  MEMBERSHIP_SUB_FRACTION,
  MEMBERSHIP_WEEKLY_CAP,
  MEMBERSHIP_MEMBER_CEILING,
  MEMBERSHIP_RATE_MAX,
} from '../applyContentMemberships';
import type { GamingStreamingState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { passiveIncomeEfficiency } from '@/lib/economy/passiveIncome';

function gs(over: Partial<GamingStreamingState> = {}): GamingStreamingState {
  return {
    followers: 0, subscribers: 0, totalViews: 0, totalEarnings: 0, totalDonations: 0,
    totalSubEarnings: 0, level: 1, experience: 0, gamesPlayed: [], streamHours: 0,
    averageViewers: 0, bestStream: null, currentStream: null,
    equipment: {} as any, pcComponents: {} as any, pcUpgradeLevels: {} as any,
    unlockedGames: [], ownedGames: [], streamHistory: [], videoTitleCounters: {},
    membershipRate: 4,
    ...over,
  };
}

describe('applyContentMemberships', () => {
  it('converts ≤5% of subscribers to paid members', () => {
    const res = applyContentMemberships({ gamingStreaming: gs({ subscribers: 10000 }), currentWeek: 5 });
    expect(res.paidMembers).toBe(Math.floor(10000 * MEMBERSHIP_SUB_FRACTION)); // 500
    expect(res.cashDelta).toBe(500 * 4); // members * rate
    expect(res.gamingStreaming!.totalSubEarnings).toBe(2000);
    expect(res.gamingStreaming!.lastMemberWeek).toBe(5);
  });

  it('caps weekly revenue at $75K even for a mega-channel', () => {
    const res = applyContentMemberships({ gamingStreaming: gs({ subscribers: 500_000_000 }), currentWeek: 2 });
    expect(res.cashDelta).toBe(MEMBERSHIP_WEEKLY_CAP);
    expect(res.gamingStreaming!.totalSubEarnings).toBe(MEMBERSHIP_WEEKLY_CAP);
  });

  it('bounds paid members by the absolute ceiling', () => {
    // 5% of 2B = 100M, clamped to the member ceiling.
    const res = applyContentMemberships({ gamingStreaming: gs({ subscribers: 2_000_000_000 }), currentWeek: 1 });
    expect(res.paidMembers).toBe(MEMBERSHIP_MEMBER_CEILING);
  });

  it('clamps a tampered membership rate', () => {
    const res = applyContentMemberships({ gamingStreaming: gs({ subscribers: 1000, membershipRate: 999999 }), currentWeek: 1 });
    // 50 members * clamped rate, still ≤ the weekly cap.
    expect(res.cashDelta).toBe(Math.min(50 * MEMBERSHIP_RATE_MAX, MEMBERSHIP_WEEKLY_CAP));
  });

  it('is idempotent within the same week', () => {
    const first = applyContentMemberships({ gamingStreaming: gs({ subscribers: 10000 }), currentWeek: 5 });
    const second = applyContentMemberships({ gamingStreaming: first.gamingStreaming, currentWeek: 5 });
    expect(second.cashDelta).toBe(0);
    expect(second.totalSubEarningsDelta).toBe(0);
    // Next week pays again.
    const third = applyContentMemberships({ gamingStreaming: first.gamingStreaming, currentWeek: 6 });
    expect(third.cashDelta).toBeGreaterThan(0);
  });

  it('pays nothing with too few subscribers to make one member, and no-ops when undefined', () => {
    expect(applyContentMemberships({ gamingStreaming: gs({ subscribers: 10 }), currentWeek: 1 }).cashDelta).toBe(0);
    expect(applyContentMemberships({ gamingStreaming: undefined, currentWeek: 1 }).cashDelta).toBe(0);
  });
});

describe('applyContentMemberships - net-worth soft cap', () => {
  // 15,000 members x $4.99 = $74,850, just under the $75K per-source cap.
  const channel = () => gs({ subscribers: 300_000, membershipRate: 4.99 });

  it('pays the full capped figure when no efficiency is given (byte-identical default)', () => {
    const res = applyContentMemberships({ gamingStreaming: channel(), currentWeek: 3 });
    expect(res.cashDelta).toBeCloseTo(74_850, 6);
  });

  it('scales the payout and totalSubEarnings by the efficiency, AFTER the $75K cap', () => {
    const res = applyContentMemberships({ gamingStreaming: channel(), currentWeek: 3, softCapEfficiency: 0.9 });
    expect(res.cashDelta).toBe(Math.round(74_850 * 0.9)); // 67,365
    expect(res.gamingStreaming!.totalSubEarnings).toBe(res.cashDelta);
    // A mega-channel is capped first, then dragged - never dragged then capped.
    const mega = applyContentMemberships({
      gamingStreaming: gs({ subscribers: 500_000_000 }), currentWeek: 3, softCapEfficiency: 0.5,
    });
    expect(mega.cashDelta).toBe(MEMBERSHIP_WEEKLY_CAP * 0.5);
  });

  it('never lets a garbage efficiency amplify or poison the payout', () => {
    for (const bad of [2, Infinity, NaN, -1]) {
      const res = applyContentMemberships({ gamingStreaming: channel(), currentWeek: 3, softCapEfficiency: bad });
      expect(Number.isFinite(res.cashDelta)).toBe(true);
      expect(res.cashDelta).toBeLessThanOrEqual(74_850);
      expect(res.cashDelta).toBeGreaterThanOrEqual(0);
    }
  });

  it('still stamps the week, so a re-run pays nothing even when dragged', () => {
    const first = applyContentMemberships({ gamingStreaming: channel(), currentWeek: 9, softCapEfficiency: 0.81 });
    const again = applyContentMemberships({ gamingStreaming: first.gamingStreaming, currentWeek: 9, softCapEfficiency: 0.81 });
    expect(first.gamingStreaming!.lastMemberWeek).toBe(9);
    expect(again.cashDelta).toBe(0);
  });

  it('reads the SAME efficiency the passive-income soft cap uses', () => {
    const poor = createTestGameState({ stats: { ...createTestGameState().stats, money: 50_000 } });
    const rich = createTestGameState({ stats: { ...createTestGameState().stats, money: 25_000_000 } });
    expect(membershipSoftCapEfficiency(poor)).toBe(1);
    expect(membershipSoftCapEfficiency(rich)).toBeCloseTo(passiveIncomeEfficiency(25_000_000), 10);
    expect(membershipSoftCapEfficiency(rich)).toBeCloseTo(0.9, 10);
  });

  it('the guard fallback is a $0, untouched-slice no-op', () => {
    const slice = channel();
    const res = noMembershipPayout(slice);
    expect(res.cashDelta).toBe(0);
    expect(res.gamingStreaming).toBe(slice);
  });
});
