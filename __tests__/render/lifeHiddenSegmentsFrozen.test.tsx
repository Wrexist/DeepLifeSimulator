/**
 * PERF-3: the Life tab keeps a visited segment mounted while hidden (so it
 * keeps its scroll and sub-tab), but a hidden segment must not re-render with
 * game state. Each segment subscribes to the whole state; with `display: none`
 * alone, a meal bought in Market re-rendered Health and re-scored all 159
 * achievements in Progression behind it.
 *
 * The three segment screens are replaced with probes that subscribe exactly the
 * way the real ones do (`useGame()`), and count their renders.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppProviders } from '@/contexts/AppProviders';
import { useGame } from '@/contexts/GameContext';
import { useSetGameState } from '@/contexts/game/useGameSelector';

const renders: Record<string, number[]> = { health: [], shop: [], stats: [] };

function makeProbe(name: string) {
  return function SegmentProbe() {
    const { gameState } = useGame();
    renders[name].push(gameState.stats.money);
    return null;
  };
}

jest.mock('@/app/(tabs)/health', () => ({ HealthScreenContent: makeProbe('health') }));
jest.mock('@/app/(tabs)/market', () => ({ MarketScreenContent: makeProbe('shop') }));
jest.mock('@/app/(tabs)/progression', () => ({ ProgressionScreenContent: makeProbe('stats') }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Life = require('@/app/(tabs)/life').default as React.ComponentType;

let setGameState: ReturnType<typeof useSetGameState> | null = null;
function Setter() {
  setGameState = useSetGameState();
  return null;
}

function pressSegment(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const target = renderer.root.find(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  );
  act(() => {
    target.props.onPress();
  });
}

function setMoney(money: number) {
  act(() => {
    setGameState!((prev) => ({ ...prev, stats: { ...prev.stats, money } }));
  });
}

describe('Life tab: hidden segments are frozen (PERF-3)', () => {
  beforeEach(() => {
    renders.health = [];
    renders.shop = [];
    renders.stats = [];
  });

  it('a hidden segment does not re-render with state, and catches up when shown', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppProviders>
          <Setter />
          <Life />
        </AppProviders>,
      );
    });

    try {
      // Visit Market, then go back to Health: Market stays mounted but hidden.
      pressSegment(renderer, 'Market');
      expect(renders.shop.length).toBeGreaterThan(0);
      pressSegment(renderer, 'Health');

      const shopRendersWhileHidden = renders.shop.length;
      const healthRendersBefore = renders.health.length;
      setMoney(12_345);
      setMoney(23_456);
      setMoney(34_567);

      // The visible segment follows the state...
      expect(renders.health.length).toBeGreaterThan(healthRendersBefore);
      expect(renders.health[renders.health.length - 1]).toBe(34_567);
      // ...the hidden one does no work at all.
      expect(renders.shop.length).toBe(shopRendersWhileHidden);

      // Showing it again renders it once with the CURRENT state.
      pressSegment(renderer, 'Market');
      expect(renders.shop[renders.shop.length - 1]).toBe(34_567);
    } finally {
      // Unmount on the failure path too, or the providers' timers keep jest alive.
      act(() => renderer.unmount());
    }
  });
});
