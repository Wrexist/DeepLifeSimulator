/**
 * A Time Machine rewind must not re-open a reward the player was already paid.
 *
 * `rewindToCheckpoint` carried gems, Live Ops and the IAP ledger from the LIVE
 * state but restored the daily-login claim marks (day key, epoch mark, week
 * marker, streak), the claimed milestone rewards and the Legacy Pass claimed
 * tiers from the SNAPSHOT - so a rewind re-armed the daily gem claim the
 * player had just collected, with the gems it paid carried forward.
 */
import { createCheckpoint, rewindToCheckpoint } from '@/lib/timeMachine/checkpointSystem';
import { canClaimDailyGemsFor, canClaimDailyGems } from '@/contexts/game/actions/SubscriptionActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const TODAY = '2026-10-17';
const NOW = Date.parse('2026-10-17T12:00:00Z');
const TOMORROW = '2026-10-18';
const TOMORROW_MS = NOW + 24 * 60 * 60 * 1000;

/** The life as it was a year ago: last claim long before today. */
function snapshotLife(): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 468,
    lineageId: 'initial-lineage',
    lastLoginRewardDate: '2025-10-01',
    lastLoginRewardAt: Date.parse('2025-10-01T12:00:00Z'),
    lastLoginRewardWeek: 460,
    loginStreak: 2,
    claimedMilestoneRewards: ['m-first'],
    legacyPass: { seasonId: 's1', xp: 0, premiumOwned: false, claimedFreeTiers: [1], claimedPremiumTiers: [], ownedCosmetics: [] },
    settings: {
      ...base.settings,
      deepLifePlusLastGemClaim: '2025-10-01',
      deepLifePlusLastGemClaimAt: Date.parse('2025-10-01T12:00:00Z'),
      deepLifePlusLastGemClaimWeek: 460,
    },
  });
}

/** Today: both faucets claimed this morning, more milestones and tiers since. */
function liveLife(): GameState {
  const snap = snapshotLife();
  const checkpoint = createCheckpoint(snap, 'Age 27');
  return {
    ...snap,
    weeksLived: 520,
    lineageId: 'life_live_lineage',
    stats: { ...snap.stats, gems: 5_000 },
    lastLoginRewardDate: TODAY,
    lastLoginRewardAt: NOW,
    lastLoginRewardWeek: 520,
    loginStreak: 7,
    claimedMilestoneRewards: ['m-first', 'm-second'],
    legacyPass: { ...snap.legacyPass!, claimedFreeTiers: [1, 2, 3] },
    settings: {
      ...snap.settings,
      deepLifePlusLastGemClaim: TODAY,
      deepLifePlusLastGemClaimAt: NOW,
      deepLifePlusLastGemClaimWeek: 520,
    },
    checkpoints: [checkpoint],
  };
}

const loginClaimable = (s: GameState, day: string, nowMs: number) =>
  canClaimDailyGemsFor(s.lastLoginRewardDate, s.lastLoginRewardAt, day, nowMs, {
    current: s.weeksLived,
    lastClaim: s.lastLoginRewardWeek,
  });

function rewound(): GameState {
  const live = liveLife();
  const restored = rewindToCheckpoint(live, live.checkpoints![0].id);
  expect(restored).not.toBeNull();
  return restored!;
}

describe('rewind keeps the claim ledgers from the LIVE state', () => {
  it('the live state cannot claim again today (control)', () => {
    expect(loginClaimable(liveLife(), TODAY, NOW)).toBe(false);
  });

  it('the snapshot alone WOULD claim today - which is the bug being closed', () => {
    expect(loginClaimable(snapshotLife(), TODAY, NOW)).toBe(true);
  });

  it('after a rewind the daily login claim is refused', () => {
    const restored = rewound();
    expect(restored.weeksLived).toBe(468);
    expect(loginClaimable(restored, TODAY, NOW)).toBe(false);
    expect(restored.loginStreak).toBe(7);
  });

  it('after a rewind the daily gem drop is refused too', () => {
    expect(canClaimDailyGems(rewound(), TODAY, NOW)).toBe(false);
  });

  it('is not a permanent lockout: one played week and a new day re-arm it', () => {
    const restored = rewound();
    // The week marker is clamped to the restored life, not left in its future.
    expect(restored.lastLoginRewardWeek).toBe(468);
    expect(loginClaimable(restored, TOMORROW, TOMORROW_MS)).toBe(false); // no week played yet
    const playedAWeek = { ...restored, weeksLived: 469 };
    expect(loginClaimable(playedAWeek, TOMORROW, TOMORROW_MS)).toBe(true);
    expect(canClaimDailyGems(playedAWeek, TOMORROW, TOMORROW_MS)).toBe(true);
  });

  it('keeps milestone rewards and Legacy Pass tiers claimed since the checkpoint', () => {
    const restored = rewound();
    expect(restored.claimedMilestoneRewards).toEqual(['m-first', 'm-second']);
    expect(restored.legacyPass?.claimedFreeTiers).toEqual([1, 2, 3]);
  });

  it('keeps the live lineage (a pre-v54 snapshot must not move the life to a new salt)', () => {
    expect(rewound().lineageId).toBe('life_live_lineage');
  });
});
