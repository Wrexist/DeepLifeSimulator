/**
 * The over-size retry must be able to shrink the biggest thing in the save.
 *
 * `pruneSaveData` capped a long list of history arrays but had no `checkpoints`
 * branch at all — and each checkpoint carries a whole (slimmed) game snapshot,
 * so on a long-lived save they are typically the largest sub-tree in the
 * payload. When a save exceeded MAX_SAVE_SIZE the aggressive retry re-ran the
 * same caps over everything EXCEPT the one thing that was actually big, so it
 * provably could not recover. 2026-07-28 audit save-4.
 *
 * The snapshots are now run through the same function, so the checkpoint path
 * cannot drift from the top-level caps as new arrays are added.
 */
import { saveQueue } from '@/utils/saveQueue';

/** pruneSaveData is private; the behaviour is what matters, not the access. */
const prune = (data: unknown, aggressive = false) =>
  (saveQueue as unknown as { pruneSaveData: (d: unknown, a?: boolean) => any }).pruneSaveData(data, aggressive);

function bigSnapshot(seed: number) {
  return {
    weeksLived: 500 + seed,
    eventLog: Array.from({ length: 900 }, (_, i) => ({ id: `e${seed}_${i}`, description: 'x' })),
    memories: Array.from({ length: 600 }, (_, i) => ({ id: `m${seed}_${i}` })),
    lifetimeStatistics: {
      netWorthHistory: Array.from({ length: 800 }, (_, i) => ({ week: i, value: i })),
      careerHistory: [],
      weeklyEarningsHistory: [],
    },
  };
}

function saveWithCheckpoints(count: number) {
  return {
    weeksLived: 900,
    eventLog: Array.from({ length: 900 }, (_, i) => ({ id: `top${i}`, description: 'x' })),
    checkpoints: Array.from({ length: count }, (_, i) => ({
      id: `cp${i}`,
      week: 100 * i,
      snapshot: bigSnapshot(i),
    })),
  };
}

describe('pruneSaveData reaches inside checkpoints', () => {
  it('caps the arrays inside each checkpoint snapshot', () => {
    const pruned = prune(saveWithCheckpoints(3));

    for (const cp of pruned.checkpoints) {
      // The same 500-event cap the top level gets.
      expect(cp.snapshot.eventLog.length).toBe(500);
      expect(cp.snapshot.memories.length).toBe(200);
      expect(cp.snapshot.lifetimeStatistics.netWorthHistory.length).toBeLessThanOrEqual(200);
    }
  });

  it('actually shrinks the payload (the property the retry depends on)', () => {
    const input = saveWithCheckpoints(4);
    const before = JSON.stringify(input).length;
    const after = JSON.stringify(prune(input)).length;

    expect(after).toBeLessThan(before);
  });

  it('keeps every checkpoint on the normal pass - they are visible rewind targets', () => {
    const pruned = prune(saveWithCheckpoints(5));
    expect(pruned.checkpoints).toHaveLength(5);
    expect(pruned.checkpoints.map((c: any) => c.id)).toEqual(['cp0', 'cp1', 'cp2', 'cp3', 'cp4']);
  });

  it('drops all but the newest two ONLY on the aggressive retry', () => {
    const pruned = prune(saveWithCheckpoints(5), true);
    expect(pruned.checkpoints).toHaveLength(2);
    expect(pruned.checkpoints.map((c: any) => c.id)).toEqual(['cp3', 'cp4']);
  });

  it('shrinks further on the aggressive pass than the normal one', () => {
    const input = saveWithCheckpoints(5);
    const normal = JSON.stringify(prune(input)).length;
    const hard = JSON.stringify(prune(input, true)).length;
    expect(hard).toBeLessThan(normal);
  });

  it('preserves checkpoint metadata around the snapshot', () => {
    const pruned = prune(saveWithCheckpoints(2));
    expect(pruned.checkpoints[0].id).toBe('cp0');
    expect(pruned.checkpoints[0].week).toBe(0);
    expect(pruned.checkpoints[1].snapshot.weeksLived).toBe(501);
  });

  it('tolerates malformed checkpoint entries', () => {
    const messy = {
      weeksLived: 10,
      checkpoints: [null, { id: 'no-snapshot' }, { id: 'bad', snapshot: 'not-an-object' }, undefined],
    };
    expect(() => prune(messy)).not.toThrow();
    expect(prune(messy).checkpoints).toHaveLength(4);
  });

  it('does not recurse into nested checkpoints', () => {
    const nested = {
      weeksLived: 10,
      checkpoints: [{ id: 'cp0', snapshot: { weeksLived: 5, checkpoints: [{ id: 'inner', snapshot: {} }] } }],
    };
    const pruned = prune(nested);
    expect(pruned.checkpoints[0].snapshot.checkpoints).toBeUndefined();
  });

  it('leaves a save with no checkpoints untouched in that respect', () => {
    const pruned = prune({ weeksLived: 5, eventLog: [] });
    expect(pruned.checkpoints).toBeUndefined();
  });
});
