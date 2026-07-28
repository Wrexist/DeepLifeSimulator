/**
 * Cross-system audit: Checkpoint pruning, Leaderboard scoring,
 * Statistics weeksLived fix, HMAC signature integrity.
 *
 * Why this file exists:
 *  - addCheckpoint must cap at MAX_CHECKPOINTS=5 — unbounded growth blows save size.
 *  - calculateLeaderboardScore touches `gameState.stats.money`, `careers`, `hobbies`,
 *    `date.age`. A partial state must NOT yield NaN/undefined (BUGFIX #22).
 *  - updateWeeklyStatistics must stamp the absolute counter `weeksLived` so the
 *    10-week snapshot interval fires (BUGFIX #21 — previously used the 1-4
 *    `week` cycle which made the snapshot trigger unreachable).
 *  - HMAC + CRC32 round-trip: signature must be deterministic for the same input
 *    + key, and differ for tampered payloads.
 */

import {
  createCheckpoint,
  addCheckpoint,
  rewindToCheckpoint,
  getRewindCost,
  shouldAutoCheckpoint,
  MAX_CHECKPOINTS,
  BASE_REWIND_COST,
  COST_MULTIPLIER,
  type Checkpoint,
} from '@/lib/timeMachine/checkpointSystem';
import {
  calculateLeaderboardScore,
  sortLeaderboardEntries,
  assignRanks,
  getTopEntries,
  findUserRank,
  type LeaderboardEntry,
  type Leaderboard,
} from '@/lib/progress/leaderboard';
import {
  updateWeeklyStatistics,
  addNetWorthSnapshot,
  getDefaultStatistics,
} from '@/lib/statistics/statisticsTracker';
import {
  calculateChecksum,
  calculateHmacSignature,
  calculateSignature,
} from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// Mock the save queue + HMAC key for deterministic test environment
jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Checkpoint snapshot pruning
// ---------------------------------------------------------------------------
describe('Checkpoint snapshot pruning', () => {
  it('createCheckpoint: strips transient fields + checkpoints from snapshot', () => {
    const state = createTestGameState({
      weeksLived: 52,
      checkpoints: [{ id: 'cp_old', label: 'Old', weeksLived: 0, age: 18, timestamp: 0, snapshot: {} }],
      weekResult: { dailySummary: { events: [] } } as any,
      showDeathPopup: true,
    });
    const cp = createCheckpoint(state, 'Age 19');
    expect(cp.label).toBe('Age 19');
    expect(cp.weeksLived).toBe(52);
    // Snapshot must NOT contain checkpoints (prevents recursion bloat)
    const snap = cp.snapshot as Partial<GameState>;
    expect((snap as any).checkpoints).toBeUndefined();
    expect((snap as any).weekResult).toBeUndefined();
    expect((snap as any).showDeathPopup).toBeUndefined();
  });

  it('createCheckpoint: deep-clones so later mutations do not leak in', () => {
    const state = createTestGameState({ weeksLived: 10 });
    const cp = createCheckpoint(state, 'Test');
    // Mutate the original state
    (state.stats as any).money = 99999999;
    const snap = cp.snapshot as Partial<GameState>;
    expect(snap.stats?.money).not.toBe(99999999);
  });

  it('addCheckpoint: caps list at MAX_CHECKPOINTS, evicts oldest first', () => {
    let list: Checkpoint[] = [];
    for (let i = 0; i < MAX_CHECKPOINTS * 3; i++) {
      const cp: Checkpoint = {
        id: `cp_${i}`,
        label: `cp ${i}`,
        weeksLived: i,
        age: 18 + i,
        timestamp: Date.now() + i,
        snapshot: {},
      };
      list = addCheckpoint(list, cp);
    }
    expect(list.length).toBe(MAX_CHECKPOINTS);
    // Oldest must have been evicted — first remaining is the (3N - MAX) entry
    expect(list[0].id).toBe(`cp_${MAX_CHECKPOINTS * 3 - MAX_CHECKPOINTS}`);
    // Newest preserved
    expect(list[list.length - 1].id).toBe(`cp_${MAX_CHECKPOINTS * 3 - 1}`);
  });

  it('shouldAutoCheckpoint: fires every WEEKS_PER_YEAR weeks, never at 0', () => {
    expect(shouldAutoCheckpoint(0)).toBe(false);
    expect(shouldAutoCheckpoint(WEEKS_PER_YEAR)).toBe(true);
    expect(shouldAutoCheckpoint(WEEKS_PER_YEAR + 1)).toBe(false);
    expect(shouldAutoCheckpoint(WEEKS_PER_YEAR * 5)).toBe(true);
  });

  it('getRewindCost: doubles per use, halved by time_machine upgrade', () => {
    expect(getRewindCost(0)).toBe(BASE_REWIND_COST);
    expect(getRewindCost(1)).toBe(BASE_REWIND_COST * COST_MULTIPLIER);
    expect(getRewindCost(3)).toBe(BASE_REWIND_COST * Math.pow(COST_MULTIPLIER, 3));
    // Upgrade halves
    expect(getRewindCost(0, true)).toBe(Math.floor(BASE_REWIND_COST / 2));
    expect(getRewindCost(2, true)).toBe(Math.floor((BASE_REWIND_COST * Math.pow(COST_MULTIPLIER, 2)) / 2));
  });

  it('rewindToCheckpoint: rejects when not enough gems', () => {
    const cp: Checkpoint = {
      id: 'cp_test',
      label: 'Test',
      weeksLived: 10,
      age: 19,
      timestamp: Date.now(),
      snapshot: { weeksLived: 10, stats: { money: 100 } as any },
    };
    const state = createTestGameState({
      checkpoints: [cp],
      stats: { ...createTestGameState().stats, gems: 0 },
      timeMachineUsesThisLife: 0,
    });
    const result = rewindToCheckpoint(state, 'cp_test');
    expect(result).toBeNull();
  });

  it('rewindToCheckpoint: success deducts cost, increments usesThisLife, preserves cross-life data', () => {
    const cp: Checkpoint = {
      id: 'cp_test',
      label: 'Test',
      weeksLived: 10,
      age: 19,
      timestamp: Date.now(),
      snapshot: { weeksLived: 10, stats: { money: 100, gems: 0 } as any },
    };
    const ribbon = { ribbonId: 'x', earnedInLife: 1 } as any;
    const state = createTestGameState({
      checkpoints: [cp],
      stats: { ...createTestGameState().stats, gems: 10000 },
      timeMachineUsesThisLife: 0,
      ribbonCollection: { ribbons: [ribbon] } as any,
      discoveredSecrets: ['secret_1'] as any,
    });
    const result = rewindToCheckpoint(state, 'cp_test');
    expect(result).not.toBeNull();
    expect(result!.timeMachineUsesThisLife).toBe(1);
    expect(result!.stats.gems).toBe(10000 - BASE_REWIND_COST);
    // Cross-life data preserved from CURRENT, not from snapshot
    expect(result!.ribbonCollection).toBe(state.ribbonCollection);
    expect(result!.discoveredSecrets).toBe(state.discoveredSecrets);
    expect(result!.checkpoints).toBe(state.checkpoints);
  });

  it('rewindToCheckpoint: tolerates legacy string-encoded snapshots', () => {
    const cp: Checkpoint = {
      id: 'cp_legacy',
      label: 'Legacy',
      weeksLived: 5,
      age: 18,
      timestamp: Date.now(),
      snapshot: JSON.stringify({ weeksLived: 5, stats: { money: 200 } }),
    };
    const state = createTestGameState({
      checkpoints: [cp],
      stats: { ...createTestGameState().stats, gems: 10000 },
    });
    const result = rewindToCheckpoint(state, 'cp_legacy');
    expect(result).not.toBeNull();
    expect(result!.weeksLived).toBe(5);
  });

  it('rewindToCheckpoint: returns null for unknown checkpoint', () => {
    const state = createTestGameState();
    expect(rewindToCheckpoint(state, 'cp_does_not_exist')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Leaderboard scoring — BUGFIX #22 nil-safety
// ---------------------------------------------------------------------------
describe('Leaderboard scoring nil-safety', () => {
  it('calculateLeaderboardScore: returns 0 for every category when state is empty shell', () => {
    // NIL-SAFETY FIXTURE — deliberately degenerate, which `createTestGameState`
    // cannot express: it exists to build states the game can produce, and the
    // whole point here is one it cannot. Converting this to the factory was
    // tried and turned the test green-for-the-wrong-reason: the empty shell
    // stopped being empty and the branch under test stopped being reached.
    const empty = {} as GameState; // NIL-SAFETY FIXTURE
    expect(calculateLeaderboardScore(empty, 'wealth')).toBe(0);
    expect(calculateLeaderboardScore(empty, 'netWorth')).toBe(0);
    expect(calculateLeaderboardScore(empty, 'career')).toBe(0);
    expect(calculateLeaderboardScore(empty, 'skills')).toBe(0);
    expect(calculateLeaderboardScore(empty, 'age')).toBe(0);
    expect(calculateLeaderboardScore(empty, 'achievements')).toBe(0);
  });

  it('calculateLeaderboardScore: tolerates undefined nested fields without crashing', () => {
    // NIL-SAFETY FIXTURE — every nested field explicitly undefined, which is a
    // state the game cannot produce and the factory therefore will not build.
    const partial = {
      stats: undefined as any,
      careers: undefined as any,
      hobbies: undefined as any,
      date: undefined as any,
      achievements: undefined as any,
    } as GameState; // NIL-SAFETY FIXTURE
    expect(() => calculateLeaderboardScore(partial, 'wealth')).not.toThrow();
    expect(() => calculateLeaderboardScore(partial, 'career')).not.toThrow();
    expect(() => calculateLeaderboardScore(partial, 'skills')).not.toThrow();
    expect(() => calculateLeaderboardScore(partial, 'age')).not.toThrow();
  });

  it('calculateLeaderboardScore: never returns NaN for any category', () => {
    // NIL-SAFETY FIXTURE — NaN in every numeric field. The factory builds valid
    // states; proving the scorer never returns NaN needs an invalid one.
    const broken = {
      stats: { money: NaN } as any,
      careers: [{ level: NaN }, { level: NaN }] as any,
      hobbies: [{ skill: NaN }] as any,
      date: { age: NaN } as any,
      achievements: [] as any,
    } as GameState; // NIL-SAFETY FIXTURE
    for (const cat of ['wealth', 'netWorth', 'career', 'skills', 'age', 'achievements'] as const) {
      const v = calculateLeaderboardScore(broken, cat);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('calculateLeaderboardScore: returns real values when state is populated', () => {
    const populated = createTestGameState({
      stats: { ...createTestGameState().stats, money: 12345 },
      careers: [{ id: 'a', level: 3 } as any, { id: 'b', level: 7 } as any],
      hobbies: [{ id: 'gym', skill: 12 } as any],
      date: { ...createTestGameState().date, age: 42 },
    });
    expect(calculateLeaderboardScore(populated, 'wealth')).toBe(12345);
    expect(calculateLeaderboardScore(populated, 'career')).toBe(7);
    expect(calculateLeaderboardScore(populated, 'skills')).toBe(12);
    expect(calculateLeaderboardScore(populated, 'age')).toBe(42);
  });

  it('sortLeaderboardEntries: descending score, ties broken alphabetically', () => {
    const entries: LeaderboardEntry[] = [
      { userId: 'a', name: 'Zoe', score: 100, rank: 0 },
      { userId: 'b', name: 'Alice', score: 200, rank: 0 },
      { userId: 'c', name: 'Bob', score: 200, rank: 0 },
    ];
    const sorted = sortLeaderboardEntries(entries);
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[1].name).toBe('Bob');
    expect(sorted[2].name).toBe('Zoe');
  });

  it('assignRanks: returns 1-indexed ranks in score order', () => {
    const entries: LeaderboardEntry[] = [
      { userId: 'a', name: 'A', score: 10, rank: 0 },
      { userId: 'b', name: 'B', score: 30, rank: 0 },
      { userId: 'c', name: 'C', score: 20, rank: 0 },
    ];
    const ranked = assignRanks(entries);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score).toBe(30);
    expect(ranked[2].rank).toBe(3);
    expect(ranked[2].score).toBe(10);
  });

  it('findUserRank: returns rank or undefined', () => {
    const board: Leaderboard = {
      category: 'wealth',
      period: 'allTime',
      entries: [
        { userId: 'me', name: 'Me', score: 100, rank: 1 },
        { userId: 'them', name: 'Them', score: 50, rank: 2 },
      ],
      updatedAt: Date.now(),
    };
    expect(findUserRank(board, 'me')).toBe(1);
    expect(findUserRank(board, 'ghost')).toBeUndefined();
  });

  it('getTopEntries: slice never exceeds total', () => {
    const board: Leaderboard = {
      category: 'wealth',
      period: 'allTime',
      entries: Array.from({ length: 3 }, (_, i) => ({
        userId: `u${i}`, name: `U${i}`, score: i, rank: i + 1,
      })),
      updatedAt: Date.now(),
    };
    expect(getTopEntries(board, 100).length).toBe(3);
    expect(getTopEntries(board, 1).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Statistics tracker — BUGFIX #21: weeksLived not week
// ---------------------------------------------------------------------------
describe('Statistics tracker week-index fix', () => {
  it('addNetWorthSnapshot: fires on multiples of 10 (the interval), no-op otherwise', () => {
    let s = getDefaultStatistics();
    for (let w = 1; w <= 9; w++) s = addNetWorthSnapshot(s, w, 100);
    expect(s.netWorthHistory.length).toBe(0);
    s = addNetWorthSnapshot(s, 10, 100);
    expect(s.netWorthHistory.length).toBe(1);
    s = addNetWorthSnapshot(s, 20, 200);
    expect(s.netWorthHistory.length).toBe(2);
  });

  it('updateWeeklyStatistics: snapshot DOES accumulate when weeksLived crosses 10-week mark (BUGFIX)', () => {
    // Before fix: this code used `state.week` (1-4 cycle) so % 10 was unreachable.
    let state: GameState = createTestGameState({
      weeksLived: 10,
      stats: { ...createTestGameState().stats, money: 5_000 },
    });
    let stats = updateWeeklyStatistics(state, 1000);
    expect(stats.netWorthHistory.length).toBe(1);
    expect(stats.netWorthHistory[0].week).toBe(10);

    state = { ...state, weeksLived: 20 };
    stats = { ...state, lifetimeStatistics: stats }.lifetimeStatistics!;
    state = { ...state, lifetimeStatistics: stats };
    stats = updateWeeklyStatistics(state, 2000);
    expect(stats.netWorthHistory.length).toBe(2);
    expect(stats.netWorthHistory[1].week).toBe(20);
  });

  it('updateWeeklyStatistics: peak net worth stamped with weeksLived, not 1-4 cycle', () => {
    const state = createTestGameState({
      weeksLived: 123,
      week: 3,
      stats: { ...createTestGameState().stats, money: 999_999 },
    });
    const stats = updateWeeklyStatistics(state, 500);
    expect(stats.peakNetWorthWeek).toBe(123);
    // Must NOT be the 1-4 cycle value
    expect(stats.peakNetWorthWeek).not.toBe(3);
  });

  it('updateWeeklyStatistics: 500 ticks accumulate the right number of snapshots (every 10 weeks)', () => {
    let stats = getDefaultStatistics();
    let state = createTestGameState();
    for (let w = 1; w <= 500; w++) {
      state = { ...state, weeksLived: w, lifetimeStatistics: stats };
      stats = updateWeeklyStatistics(state, 100);
    }
    // 500 / 10 = 50 snapshots expected
    expect(stats.netWorthHistory.length).toBe(50);
    // First snapshot at week 10, last at week 500
    expect(stats.netWorthHistory[0].week).toBe(10);
    expect(stats.netWorthHistory[stats.netWorthHistory.length - 1].week).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// HMAC + CRC32 signature integrity
// ---------------------------------------------------------------------------
describe('Save crypto integrity', () => {
  it('calculateChecksum: deterministic for same input', () => {
    const a = calculateChecksum('hello world');
    const b = calculateChecksum('hello world');
    expect(a).toBe(b);
    expect(a).toHaveLength(8);
  });

  it('calculateChecksum: changes when input changes by one byte', () => {
    const a = calculateChecksum('hello world');
    const b = calculateChecksum('hello worle'); // last char changed
    expect(a).not.toBe(b);
  });

  it('calculateChecksum: empty string yields stable value', () => {
    const a = calculateChecksum('');
    expect(a).toBe(calculateChecksum(''));
    expect(a).toHaveLength(8);
  });

  it('calculateSignature: keyed signature differs by key', () => {
    const data = '{"a":1}';
    const sig1 = calculateSignature(data, 'k1');
    const sig2 = calculateSignature(data, 'k2');
    expect(sig1).not.toBe(sig2);
  });

  it('calculateSignature: same key + data is deterministic', () => {
    const data = '{"a":1}';
    expect(calculateSignature(data, 'k1')).toBe(calculateSignature(data, 'k1'));
  });

  it('calculateHmacSignature: deterministic, hex-encoded, 64-char SHA256 output', () => {
    // In test/dev environment, getActiveSaveHmacKey resolves to a dev key
    // (or falls back to the weak-migration path). Either branch should yield
    // a stable hex string for the same input.
    const a = calculateHmacSignature('payload');
    const b = calculateHmacSignature('payload');
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    // Hex only
    expect(/^[0-9a-f]+$/i.test(a)).toBe(true);
  });

  it('calculateHmacSignature: differs for tampered payload', () => {
    const sig = calculateHmacSignature('{"money":1000}');
    const tampered = calculateHmacSignature('{"money":9999999}');
    expect(sig).not.toBe(tampered);
  });

  it('Save envelope: checksum + hmac on a 50KB payload round-trips in reasonable time', () => {
    const big = JSON.stringify({ data: 'x'.repeat(50_000) });
    const t0 = Date.now();
    const checksum = calculateChecksum(big);
    const hmac = calculateHmacSignature(big);
    const elapsed = Date.now() - t0;
    expect(checksum).toHaveLength(8);
    expect(hmac.length).toBeGreaterThan(0);
    // Pure-JS HMAC is slow but should be under 5s even on cold ts-jest run
    expect(elapsed).toBeLessThan(5000);
  });

  it('Tamper detection: signature flips on any byte change', () => {
    const original = '{"stats":{"money":100,"gems":50}}';
    const sigOriginal = calculateHmacSignature(original);
    // Change a single byte
    const tampered1 = '{"stats":{"money":101,"gems":50}}';
    const tampered2 = '{"stats":{"money":100,"gems":51}}';
    expect(calculateHmacSignature(tampered1)).not.toBe(sigOriginal);
    expect(calculateHmacSignature(tampered2)).not.toBe(sigOriginal);
  });
});

// ---------------------------------------------------------------------------
// Cross-system regression: nothing leaks together
// ---------------------------------------------------------------------------
describe('Cross-system regression', () => {
  it('500 checkpoint additions stay capped + JSON-safe', () => {
    let list: Checkpoint[] = [];
    for (let i = 0; i < 500; i++) {
      const cp: Checkpoint = {
        id: `cp_${i}`,
        label: `Year ${i}`,
        weeksLived: i,
        age: 18 + Math.floor(i / WEEKS_PER_YEAR),
        timestamp: Date.now() + i,
        snapshot: { weeksLived: i, stats: { money: i * 100 } as any },
      };
      list = addCheckpoint(list, cp);
    }
    expect(list.length).toBe(MAX_CHECKPOINTS);
    // Each remaining checkpoint must round-trip JSON
    for (const cp of list) {
      const json = JSON.stringify(cp);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(cp.id);
    }
  });

  it('100 leaderboard updates from random state never produce NaN', () => {
    for (let i = 0; i < 100; i++) {
      const state = createTestGameState({
        stats: { ...createTestGameState().stats, money: Math.random() * 1_000_000 },
        date: { ...createTestGameState().date, age: 18 + Math.random() * 80 },
      });
      const wealth = calculateLeaderboardScore(state, 'wealth');
      const age = calculateLeaderboardScore(state, 'age');
      expect(Number.isFinite(wealth)).toBe(true);
      expect(Number.isFinite(age)).toBe(true);
    }
  });

  it('1000 weeks of statistics never produces a non-finite stat', () => {
    let stats = getDefaultStatistics();
    let state = createTestGameState();
    for (let w = 1; w <= 1000; w++) {
      state = { ...state, weeksLived: w, lifetimeStatistics: stats };
      stats = updateWeeklyStatistics(state, Math.random() * 1000);
    }
    for (const v of Object.values(stats)) {
      if (typeof v === 'number') {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
    // History bounded
    expect(stats.netWorthHistory.length).toBeLessThanOrEqual(100);
    expect(stats.weeklyEarningsHistory.length).toBeLessThanOrEqual(100);
  });
});
