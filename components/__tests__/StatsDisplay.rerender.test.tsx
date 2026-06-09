/**
 * Sprint 2 — Phase 2 regression: the migrated StatsDisplay (now on
 * `useGameSelector`) must re-render ONLY when its `stats` slice changes, not on
 * every unrelated GameState mutation.
 */
import React from 'react';
import { GameStateProvider, useGameState } from '@/contexts/game/GameStateContext';
import StatsDisplay from '../StatsDisplay';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

// Stub StatBar so Profiler commits reflect StatsDisplay's own re-renders, not
// the animated child's internal work.
jest.mock('../anim/StatBar', () => ({ __esModule: true, default: () => null }));

// The global lucide mock (jest.setup.js) only covers a fixed icon set; provide
// the icons StatsDisplay uses so it renders.
jest.mock('lucide-react-native', () => ({
  Heart: 'Heart',
  Smile: 'Smile',
  Zap: 'Zap',
  Dumbbell: 'Dumbbell',
  DollarSign: 'DollarSign',
  Gem: 'Gem',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

let setState: React.Dispatch<React.SetStateAction<GameState>> | null = null;
function Probe() {
  setState = useGameState().setGameState;
  return null;
}

describe('StatsDisplay re-render isolation (Sprint 2)', () => {
  afterEach(() => {
    setState = null;
  });

  it('re-renders only when stats change, not on unrelated state changes', () => {
    let commits = 0;
    let root: any;
    act(() => {
      root = TestRenderer.create(
        <GameStateProvider initialState={createTestGameState()}>
          <Probe />
          <React.Profiler id="stats" onRender={() => { commits++; }}>
            <StatsDisplay />
          </React.Profiler>
        </GameStateProvider>
      );
    });
    const mountCommits = commits;
    expect(mountCommits).toBeGreaterThanOrEqual(1);

    // Unrelated change (add a loan) → StatsDisplay must NOT re-commit.
    act(() => {
      setState!((prev) => ({ ...prev, loans: [...(prev.loans ?? []), { id: 'x' } as any] }));
    });
    expect(commits).toBe(mountCommits);

    // Another unrelated change (a non-stats top-level field).
    act(() => {
      setState!((prev) => ({ ...prev, weeksLived: (prev.weeksLived ?? 0) + 1 }));
    });
    expect(commits).toBe(mountCommits);

    // Stats change → exactly one more commit.
    act(() => {
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, money: prev.stats.money + 1 } }));
    });
    expect(commits).toBe(mountCommits + 1);

    act(() => root.unmount());
  });
});
