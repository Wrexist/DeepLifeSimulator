/**
 * Time-machine checkpoint slimming.
 *
 * Checkpoints are full clones of the game state. In a long game the bulk of a
 * snapshot is cosmetic history — the event log and the Pulse feed / its
 * notification + comment caches — which previously made stored checkpoints the
 * dominant term in a large save. These tests pin that:
 *   - creation drops the heavy, re-derivable collections but keeps everything
 *     gameplay-critical, at a materially smaller serialized size;
 *   - a create → rewind round-trip preserves gameplay-critical fields and safely
 *     re-defaults the stripped ones (the rewind path runs repairGameState);
 *   - slimCheckpointSnapshot never throws on malformed input.
 */
import type { GameState } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';
import {
  createCheckpoint,
  rewindToCheckpoint,
  slimCheckpointSnapshot,
  getRewindCost,
} from '@/lib/timeMachine/checkpointSystem';

function heavyState(): GameState {
  const base = JSON.parse(JSON.stringify(initialGameState)) as GameState;
  base.weeksLived = 52;
  base.generationNumber = 3;
  base.stats = { ...base.stats, money: 50_000, gems: 0 };
  base.relationships = [
    { id: 'rel_alex', name: 'Alex', relationshipScore: 80 } as never,
  ];

  // Heavy re-derivable collections that slimming must drop.
  base.eventLog = Array.from({ length: 400 }, (_, i) => ({
    id: `evt_${i}`,
    description: `Something notable happened in week ${i}. ${'x'.repeat(60)}`,
    choice: 'accept',
    week: i % 52,
    year: 2025 + Math.floor(i / 52),
  }));
  const sm = base.socialMedia as unknown as Record<string, unknown>;
  sm.recentPosts = Array.from({ length: 50 }, (_, i) => ({
    id: `post_${i}`,
    content: `A post body ${'y'.repeat(80)}`,
  }));
  sm.notifications = Array.from({ length: 100 }, (_, i) => ({
    id: `notif_${i}`,
    text: `notification ${'z'.repeat(40)}`,
  }));
  sm.commentThreads = { post_0: [{ id: 'c0', text: 'nice' }] };

  return base;
}

describe('checkpointSystem — slimCheckpointSnapshot', () => {
  it('drops heavy re-derivable collections, keeps gameplay-critical fields', () => {
    const snap = {
      stats: { money: 100 },
      relationships: [{ id: 'r1' }],
      eventLog: [{ id: 'e1' }],
      socialMedia: { followers: 5, recentPosts: [{ id: 'p1' }], notifications: [{ id: 'n1' }], commentThreads: { p1: [] } },
    };
    const out = slimCheckpointSnapshot(snap);
    expect(out.eventLog).toBeUndefined();
    expect(out.socialMedia.recentPosts).toBeUndefined();
    expect(out.socialMedia.notifications).toBeUndefined();
    expect(out.socialMedia.commentThreads).toBeUndefined();
    // Gameplay-critical + non-stripped social fields kept.
    expect(out.stats.money).toBe(100);
    expect(out.relationships).toHaveLength(1);
    expect(out.socialMedia.followers).toBe(5);
  });

  it('is crash-safe on malformed / non-object input', () => {
    expect(() => slimCheckpointSnapshot(null as never)).not.toThrow();
    expect(() => slimCheckpointSnapshot(undefined as never)).not.toThrow();
    expect(() => slimCheckpointSnapshot('a string' as never)).not.toThrow();
    // Object without socialMedia must not throw.
    expect(() => slimCheckpointSnapshot({ stats: {} } as never)).not.toThrow();
  });
});

describe('checkpointSystem — createCheckpoint', () => {
  it('strips heavy collections from the snapshot but keeps gameplay-critical data', () => {
    const state = heavyState();
    const cp = createCheckpoint(state, 'Age 19');
    const snap = cp.snapshot as Partial<GameState>;

    // Stripped keys absent.
    expect((snap as Record<string, unknown>).eventLog).toBeUndefined();
    const sm = snap.socialMedia as unknown as Record<string, unknown>;
    expect(sm.recentPosts).toBeUndefined();
    expect(sm.notifications).toBeUndefined();
    expect(sm.commentThreads).toBeUndefined();

    // Gameplay-critical retained.
    expect(snap.stats?.money).toBe(50_000);
    expect(snap.relationships).toHaveLength(1);
    expect(snap.banking?.creditScore?.score).toBe(650);
    // Transient fields still stripped (pre-existing behavior).
    expect((snap as Record<string, unknown>).checkpoints).toBeUndefined();
  });

  it('produces a materially smaller snapshot than a full clone of the state', () => {
    const state = heavyState();
    const fullSize = JSON.stringify(state).length;
    const cp = createCheckpoint(state, 'Age 19');
    const slimSize = JSON.stringify(cp.snapshot).length;
    expect(slimSize).toBeLessThan(fullSize);
    // The dropped event log alone is tens of KB — assert a real, large saving
    // rather than an exact byte count.
    expect(fullSize - slimSize).toBeGreaterThan(10_000);
  });

  it('deep-clones so later mutations to the live state do not leak in', () => {
    const state = heavyState();
    const cp = createCheckpoint(state, 'Test');
    (state.stats as { money: number }).money = 99_999_999;
    const snap = cp.snapshot as Partial<GameState>;
    expect(snap.stats?.money).toBe(50_000);
  });
});

describe('checkpointSystem — create → rewind round-trip', () => {
  it('preserves gameplay-critical fields and re-defaults the stripped ones', () => {
    const captured = heavyState();
    const cp = createCheckpoint(captured, 'Age 19');

    const liveGems = 100_000;
    const live = heavyState();
    live.stats = { ...live.stats, gems: liveGems };
    live.timeMachineUsesThisLife = 0;
    live.checkpoints = [cp];

    const restored = rewindToCheckpoint(live, cp.id);
    expect(restored).not.toBeNull();
    const r = restored as GameState;

    // Gameplay-critical restored from the snapshot.
    expect(r.stats.money).toBe(50_000);
    expect(r.relationships?.[0]?.id).toBe('rel_alex');
    expect(r.banking?.creditScore?.score).toBe(650);
    // Gems deducted from the live state (not the snapshot).
    expect(r.stats.gems).toBe(liveGems - getRewindCost(0));

    // Stripped collections safely re-defaulted by the repair pass on rewind.
    expect(Array.isArray(r.eventLog)).toBe(true);
    expect(r.eventLog).toHaveLength(0);
    const rsm = r.socialMedia as unknown as Record<string, unknown>;
    expect((rsm.notifications as unknown[]) ?? []).toHaveLength(0);
    expect(Object.keys((rsm.commentThreads as Record<string, unknown>) ?? {})).toHaveLength(0);
    expect(((rsm.recentPosts as unknown[]) ?? [])).toHaveLength(0);
  });

  it('rejects a rewind when the player cannot afford the cost', () => {
    const cp = createCheckpoint(heavyState(), 'Age 19');
    const live = heavyState();
    live.stats = { ...live.stats, gems: 0 };
    live.checkpoints = [cp];
    expect(rewindToCheckpoint(live, cp.id)).toBeNull();
  });
});
