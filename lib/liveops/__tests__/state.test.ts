import { MAX_TRACKED_IDS, hasClaimed, hasSeen, readLiveOpsState, withClaim, withSeen } from '../state';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const NOW = Date.parse('2026-06-15T12:00:00Z');
const withLiveOps = (liveOps: unknown): GameState =>
  ({ ...createTestGameState(), liveOps } as GameState);

describe('readLiveOpsState', () => {
  it('returns the empty answer for a save that predates the field', () => {
    // v49 is a carve-out: absence already means "nothing claimed, nothing seen".
    expect(readLiveOpsState(createTestGameState())).toEqual({});
  });

  it('returns the empty answer for a malformed shape, never a throw', () => {
    for (const junk of [null, 'a string', 42, [], true]) {
      expect(() => readLiveOpsState(withLiveOps(junk))).not.toThrow();
      expect(readLiveOpsState(withLiveOps(junk))).toEqual({});
    }
    expect(readLiveOpsState(null)).toEqual({});
  });

  it('drops corrupt entries rather than carrying them forward', () => {
    const state = readLiveOpsState(
      withLiveOps({
        claimedInstanceIds: ['ok', 42, null, ''],
        lastSeenWeek: { good: 10, bad: 'x', worse: NaN },
        budget: [{ at: NOW, value: 5 }, { at: 'x', value: 1 }, { at: NOW, value: NaN }],
      }),
    );
    expect(state.claimedInstanceIds).toEqual(['ok']);
    expect(state.lastSeenWeek).toEqual({ good: 10 });
    expect(state.budget).toEqual([{ at: NOW, value: 5 }]);
  });

  it('hands back a copy, so a caller cannot reach into GameState', () => {
    const save = withLiveOps({ claimedInstanceIds: ['a'] });
    const read = readLiveOpsState(save);
    read.claimedInstanceIds!.push('b');
    expect(readLiveOpsState(save).claimedInstanceIds).toEqual(['a']);
  });
});

describe('withClaim', () => {
  it('records the id and its budget cost together', () => {
    const next = withClaim({}, 'e@t', 200, NOW);
    expect(next.claimedInstanceIds).toEqual(['e@t']);
    expect(next.budget).toEqual([{ at: NOW, value: 200 }]);
  });

  it('is idempotent, and reports it by REFERENCE so the caller can detect it', () => {
    const first = withClaim({}, 'e@t', 200, NOW);
    expect(withClaim(first, 'e@t', 200, NOW)).toBe(first);
  });

  it('prunes the budget on WRITE, so the save does not grow with the life', () => {
    const old = { budget: [{ at: NOW - 30 * 24 * 60 * 60 * 1000, value: 500 }] };
    expect(withClaim(old, 'e@t', 100, NOW).budget).toEqual([{ at: NOW, value: 100 }]);
  });

  it('bounds the claimed list', () => {
    let state = {};
    for (let i = 0; i < MAX_TRACKED_IDS + 20; i++) state = withClaim(state, `e${i}@t`, 1, NOW + i);
    expect((state as { claimedInstanceIds?: string[] }).claimedInstanceIds).toHaveLength(MAX_TRACKED_IDS);
  });
});

describe('withSeen', () => {
  it('records the instance and the game week it was opened', () => {
    const next = withSeen({}, 'e', 'e@t', 40);
    expect(next.seenInstanceIds).toEqual(['e@t']);
    expect(next.lastSeenWeek).toEqual({ e: 40 });
  });

  it('is a no-op when nothing changed', () => {
    const first = withSeen({}, 'e', 'e@t', 40);
    expect(withSeen(first, 'e', 'e@t', 40)).toBe(first);
  });

  it('updates the week when the player revisits in a later week', () => {
    const first = withSeen({}, 'e', 'e@t', 40);
    expect(withSeen(first, 'e', 'e@t', 48).lastSeenWeek).toEqual({ e: 48 });
  });
});

describe('ledger reads', () => {
  it('answer false for an absent state rather than throwing', () => {
    expect(hasClaimed(undefined, 'x')).toBe(false);
    expect(hasSeen(undefined, 'x')).toBe(false);
  });
});
