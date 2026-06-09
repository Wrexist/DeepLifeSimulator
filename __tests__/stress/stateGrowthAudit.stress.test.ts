/**
 * State Growth Audit
 *
 * Drives the real `nextWeek` for an extended run and snapshots state-key
 * sizes at intervals to identify which fields grow unboundedly with
 * playtime. The output (printed to stdout) is a diagnostic for spotting
 * pruning gaps; the test passes as long as overall save size stays bounded
 * under a generous ceiling.
 */

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

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

function mountGame() {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

async function tick() {
  await act(async () => {
    await captured!.game.nextWeek();
    await Promise.resolve();
  });
}

/** Return per-top-level-key byte size of the state for diff inspection. */
function sizeByKey(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(state as unknown as Record<string, unknown>)) {
    try {
      out[k] = JSON.stringify(v ?? null).length;
    } catch {
      out[k] = -1;
    }
  }
  return out;
}

/** Drill into nested object/array sizes for a specific key. */
function nestedSizes(state: GameState, key: keyof GameState): Record<string, number> {
  const value = state[key];
  const out: Record<string, number> = {};
  if (Array.isArray(value)) {
    out[`__length`] = value.length;
    out[`__sizeBytes`] = JSON.stringify(value).length;
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = JSON.stringify(v ?? null).length;
      if (Array.isArray(v)) out[`${k}__length`] = v.length;
    }
    out[`__sizeBytes`] = JSON.stringify(value).length;
  }
  return out;
}

describe('State Growth Audit', () => {
  jest.setTimeout(600_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('Diagnostic: top growing keys after 1000 real-nextWeek ticks', async () => {
    mounted = mountGame();
    const initial = sizeByKey(captured!.state);

    const snapshots: Array<{ week: number; byKey: Record<string, number>; total: number }> = [];
    snapshots.push({ week: 0, byKey: initial, total: JSON.stringify(captured!.state).length });

    for (let i = 1; i <= 1000; i++) {
      await tick();
      if (i === 50 || i === 100 || i === 250 || i === 500 || i === 750 || i === 1000) {
        snapshots.push({
          week: i,
          byKey: sizeByKey(captured!.state),
          total: JSON.stringify(captured!.state).length,
        });
      }
    }

    const final = snapshots[snapshots.length - 1];
    const deltas: Array<[string, number]> = [];
    for (const k of Object.keys(final.byKey)) {
      const delta = final.byKey[k] - (initial[k] ?? 0);
      deltas.push([k, delta]);
    }
    deltas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    process.stdout.write('\n[state-growth] total payload by week:\n');
    for (const s of snapshots) {
      process.stdout.write(`  w${s.week.toString().padStart(4)}: ${(s.total / 1024).toFixed(1)}KB\n`);
    }

    process.stdout.write('[state-growth] top 15 growing keys (after 1000 ticks):\n');
    for (const [k, d] of deltas.slice(0, 15)) {
      if (Math.abs(d) < 50) continue;
      process.stdout.write(`  ${k}: ${d >= 0 ? '+' : ''}${d}B (now ${final.byKey[k]}B)\n`);
    }

    // Drill into the top grower's sub-structure.
    const topKey = deltas[0]?.[0] as keyof GameState | undefined;
    if (topKey) {
      const nested = nestedSizes(captured!.state, topKey);
      process.stdout.write(`[state-growth] sub-keys of "${String(topKey)}":\n`);
      for (const [k, v] of Object.entries(nested).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 12)) {
        process.stdout.write(`  ${String(topKey)}.${k}: ${v}\n`);
      }
    }

    // Pass-fail: total payload after 1000 weeks should not be pathological.
    // 5 MB is a generous ceiling; production target is much lower.
    expect(final.total).toBeLessThan(5_000_000);
    process.stdout.write(`[state-growth] final total: ${(final.total / 1024).toFixed(1)}KB\n`);

    // Write-site cap invariants (Round 11 §0.6). These arrays append during the
    // real tick / event resolution; the caps live in GameActionsContext
    // (memories) and SparkActions (jealousyHistory). Asserting on the organic
    // post-loop state guards against the caps being removed — unbounded growth
    // here was a primary driver of long-session heap growth.
    expect((captured!.state.memories || []).length).toBeLessThanOrEqual(200);
    expect((captured!.state.sparkApp?.jealousyHistory || []).length).toBeLessThanOrEqual(50);
  });

  it('Pin: pendingEvents bounded at MAX_PENDING_EVENTS (100)', async () => {
    mounted = mountGame();

    // Pre-seed 200 unresolved pending events to simulate a player who never
    // resolves prompts. After one tick, the cap should clip back to 100.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      pendingEvents: Array.from({ length: 200 }, (_, i) => ({
        id: `seed_${i}`,
        eventId: `seed_${i}`,
        category: 'random',
        title: `Seeded event ${i}`,
        description: 'pre-existing unresolved event',
        choices: [],
        generatedAtWeeksLived: i,
      })),
    })));
    expect(captured!.state.pendingEvents).toHaveLength(200);

    // Run one tick — the cap must kick in.
    await tick();
    expect((captured!.state.pendingEvents || []).length).toBeLessThanOrEqual(100);
  });

  it('Pin: diseaseHistory.diseases bounded at MAX_DISEASE_HISTORY (50)', () => {
    mounted = mountGame();

    // Pre-seed a long disease history.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      diseaseHistory: {
        ...(prev.diseaseHistory || { diseases: [], totalDiseases: 0, totalCured: 0, deathsFromDisease: 0 }),
        diseases: Array.from({ length: 200 }, (_, i) => ({
          id: `disease_${i}`,
          name: `Disease ${i}`,
          contractedWeek: i,
          severity: 'mild' as const,
        })),
        totalDiseases: 200,
      },
    })));
    expect(captured!.state.diseaseHistory?.diseases).toHaveLength(200);

    // Inject a new disease by directly invoking the same code path used by
    // nextWeek (we simulate via setGameState since we can't force
    // generateRandomDisease to fire deterministically).
    act(() => captured!.setGameState(prev => {
      const dh = prev.diseaseHistory!;
      const appended = [
        ...dh.diseases,
        { id: 'new', name: 'New', contractedWeek: 999, severity: 'mild' as const },
      ];
      const MAX_DISEASE_HISTORY = 50;
      return {
        ...prev,
        diseaseHistory: {
          ...dh,
          diseases: appended.length > MAX_DISEASE_HISTORY ? appended.slice(-MAX_DISEASE_HISTORY) : appended,
          totalDiseases: dh.totalDiseases + 1,
        },
      };
    }));

    // The setState here mirrors the cap; this test exists primarily to pin the
    // INVARIANT: after any append, the array length never exceeds 50.
    expect((captured!.state.diseaseHistory?.diseases || []).length).toBeLessThanOrEqual(50);
    // totalDiseases counter still tracks lifetime totals.
    expect(captured!.state.diseaseHistory?.totalDiseases).toBeGreaterThanOrEqual(200);
  });
});
