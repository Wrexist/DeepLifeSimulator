/**
 * Weekly channel memberships (v22, shared YouVideo + Streamly). Pins the money-
 * printing guardrails: paid members ≤ 5% of subscribers, revenue capped at
 * $75K/wk, rate clamped, and idempotent per week via lastMemberWeek.
 */
import {
  applyContentMemberships,
  MEMBERSHIP_SUB_FRACTION,
  MEMBERSHIP_WEEKLY_CAP,
  MEMBERSHIP_MEMBER_CEILING,
  MEMBERSHIP_RATE_MAX,
} from '../applyContentMemberships';
import type { GamingStreamingState } from '@/contexts/game/types';

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
