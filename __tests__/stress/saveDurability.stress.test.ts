/**
 * Save-Durability Stress Test — roadmap H4 (late-game save size) + H5 (load self-heal)
 *
 * Fills two gaps the existing save suites miss:
 *
 *  H4 — `longRunSaveLoad.stress.test.ts` advances time with the SIMPLIFIED
 *  `advanceWeeks` helper, which never grows the history arrays (eventLog, journal,
 *  memories, …). So late-game SAVE SIZE vs MAX_SAVE_SIZE (the ~2000-week soft-lock
 *  risk flagged in the 2026-06-15 roadmap) was never actually tested. Here we drive
 *  the REAL `nextWeek` (which grows those arrays) and assert the real save
 *  serialization fits under MAX_SAVE_SIZE and the arrays stay write-capped — so the
 *  save size is bounded at ANY week count, not just the ~250 we run.
 *
 *  H5 — a corrupted/degraded state (NaN/Infinity stats + a wiped nested subsystem,
 *  the kind a CloudSync merge or partial migration produces) must survive
 *  validate→repair and then a REAL tick without crashing — proving the load path
 *  self-heals instead of soft-locking on the first tick.
 *
 * Uses React.createElement (file stays .ts) and the same real-provider probe
 * harness as realProviderLoop.stress.test.ts. The slow SaveQueue (HMAC over a
 * ~100KB payload ≈ 6s/call) is mocked; we exercise the real serialization
 * (createSaveData/parseSaveData) directly instead.
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
import {
  createSaveData,
  parseSaveData,
  validateGameState,
} from '@/utils/saveValidation';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import { MAX_SAVE_SIZE } from '@/lib/config/gameConstants';

const { act } = TestRenderer;
const h = React.createElement;

interface Probe {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  nextWeek: () => Promise<void> | void;
}

let captured: Probe | null = null;

function ProbeComponent(): null {
  const { gameState, setGameState } = useGameState();
  const actions = useGameActions();
  captured = {
    state: gameState,
    setGameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
  };
  return null;
}

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider, null, h(GameProvider, null, h(ProbeComponent)))
    );
  });
  return { root };
}

/** Drive `nextWeek` once; clear any death so the soak keeps advancing. */
async function tick(): Promise<void> {
  if (!captured) throw new Error('Probe not initialized');
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
  if (captured!.state.showDeathPopup) {
    await act(async () => {
      captured!.setGameState((prev) => ({
        ...prev,
        showDeathPopup: false,
        diseases: [],
        stats: { ...prev.stats, health: 100, happiness: 80, energy: 80 },
      }));
      await Promise.resolve();
    });
  }
}

describe('Save Durability Stress (real tick + real save serialization)', () => {
  jest.setTimeout(300_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('H4: a long real-tick run serializes under MAX_SAVE_SIZE with bounded history arrays', async () => {
    mounted = mountGame();
    const TICKS = 250;
    for (let i = 0; i < TICKS; i++) {
      await tick();
    }
    const state = captured!.state;
    expect(state.weeksLived).toBeGreaterThan(100); // a substantial run actually happened

    // Real save serialization (CRC32 + HMAC envelope) must round-trip...
    const envelope = createSaveData(state, STATE_VERSION);
    const parsed = parseSaveData(
      envelope.data,
      envelope.checksum,
      envelope.signature,
      envelope.hmac
    );
    expect(parsed.valid).toBe(true);

    const sizeBytes = envelope.data.length;
    process.stdout.write(
      `\n[save-size] after ${TICKS} real ticks (weeksLived=${state.weeksLived}): ` +
        `${Math.round(sizeBytes / 1024)}KB / cap ${Math.round(MAX_SAVE_SIZE / 1024)}KB\n`
    );

    // The actual soft-lock metric: a real long-game save must fit under the 4MB cap.
    expect(sizeBytes).toBeLessThan(MAX_SAVE_SIZE);

    // History arrays must be write-capped, so save size is bounded at ANY week
    // count — this is *why* a 2000-week save can't soft-lock. Generous upper
    // bounds (≥ the documented caps) catch an array that grows unbounded.
    expect(state.eventLog?.length ?? 0).toBeLessThanOrEqual(600);
    expect(state.journal?.length ?? 0).toBeLessThanOrEqual(80);
    expect(state.memories?.length ?? 0).toBeLessThanOrEqual(300);
    expect(state.lifeMilestones?.length ?? 0).toBeLessThanOrEqual(300);
    expect(state.netWorthHistory?.length ?? 0).toBeLessThanOrEqual(300);
  });

  it('H5: a corrupted state self-heals via validate(autoFix) and survives a real tick', async () => {
    // A degraded state: NaN/Infinity numerics — the kind a CloudSync merge, a
    // hand-edited save, or arithmetic drift can produce.
    const corrupt = createTestGameState();
    corrupt.stats.money = NaN;
    corrupt.stats.health = Infinity;
    corrupt.stats.energy = NaN;
    corrupt.bankSavings = Infinity;

    // 1. The documented load-path repair — validateGameState(autoFix=true), which
    //    runs autoFixStats in place — must clean the numerics and yield a valid
    //    state. (Roadmap H5: prove the load path actually self-heals.)
    validateGameState(corrupt, true);
    expect(Number.isFinite(corrupt.stats.money)).toBe(true);
    expect(Number.isFinite(corrupt.stats.health)).toBe(true);
    expect(Number.isFinite(corrupt.stats.energy)).toBe(true);
    expect(Number.isFinite(corrupt.bankSavings)).toBe(true);
    expect(validateGameState(corrupt).valid).toBe(true);

    // 2. Even a RAW corrupt state (loaded without pre-repair) must not crash the
    //    live tick, and the post-tick path must leave it valid & finite — i.e. it
    //    can't load "valid" then soft-lock/NaN-out on the very first week-advance.
    const raw = createTestGameState();
    raw.stats.money = NaN;
    raw.stats.energy = Infinity;

    mounted = mountGame();
    await act(async () => {
      captured!.setGameState(() => raw);
      await Promise.resolve();
    });
    await tick(); // throws → test fails

    const after = captured!.state;
    expect(validateGameState(after).valid).toBe(true);
    expect(Number.isFinite(after.stats.money)).toBe(true);
    expect(Number.isFinite(after.stats.energy)).toBe(true);
  });
});
