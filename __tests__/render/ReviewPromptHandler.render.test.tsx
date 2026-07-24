import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import { ReviewPromptHandler } from '@/components/ReviewPromptHandler';
import type { GameState } from '@/contexts/game/types';
import { maybeRequestReview as maybeRequestReviewImport } from '@/utils/ratingPrompt';

// The gating logic has its own suite (utils/__tests__/ratingPrompt.test.ts).
// Here we only care that the wiring reaches it with the right trigger.
jest.mock('@/utils/ratingPrompt', () => ({
  maybeRequestReview: jest.fn(() => Promise.resolve({ requested: false, reason: 'settling-in' })),
}));

const maybeRequestReview = maybeRequestReviewImport as unknown as jest.Mock;

const career = (id: string, level: number) => ({ id, level, accepted: true, progress: 0, levels: [] });

const makeState = (overrides: Partial<GameState> = {}): GameState =>
  ({ weeksLived: 100, stats: { money: 10000 }, careers: [], ...overrides }) as unknown as GameState;

/** Minimal stand-in for the GameStateProvider's external store. */
function makeStore(initial: GameState) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    setGameState: () => {},
    /** Test-only: commit a new snapshot and notify, like the real provider does. */
    push(next: GameState) {
      snapshot = next;
      listeners.forEach((fn) => fn());
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function mount(store: ReturnType<typeof makeStore>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <GameStoreContext.Provider value={store as never}>
        <ReviewPromptHandler />
      </GameStoreContext.Provider>,
    );
  });
  return renderer;
}

describe('render — ReviewPromptHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing', () => {
    const store = makeStore(makeState());
    const renderer = mount(store);
    expect(renderer.toJSON()).toBeNull();
  });

  it('forwards a promotion beat to the rating prompt', () => {
    const store = makeStore(makeState({ careers: [career('dev', 2)] as never }));
    mount(store);

    act(() => {
      store.push(makeState({ careers: [career('dev', 3)] as never }));
    });

    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
    expect(maybeRequestReview).toHaveBeenCalledWith('promotion', expect.any(Object));
  });

  it('stays quiet on an ordinary state change', () => {
    const store = makeStore(makeState({ careers: [career('dev', 2)] as never }));
    mount(store);

    act(() => {
      store.push(makeState({ careers: [career('dev', 2)] as never, weeksLived: 101 }));
    });

    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('diffs against the previous snapshot, not the one it mounted with', () => {
    // Guards the classic watcher bug: comparing every update against the mount
    // snapshot re-fires the same beat on every subsequent change.
    const store = makeStore(makeState({ careers: [career('dev', 2)] as never }));
    mount(store);

    act(() => {
      store.push(makeState({ careers: [career('dev', 3)] as never }));
    });
    act(() => {
      store.push(makeState({ careers: [career('dev', 3)] as never, weeksLived: 101 }));
    });

    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const store = makeStore(makeState({ careers: [career('dev', 2)] as never }));
    const renderer = mount(store);
    expect(store.listenerCount).toBe(1);

    act(() => {
      renderer.unmount();
    });

    expect(store.listenerCount).toBe(0);

    act(() => {
      store.push(makeState({ careers: [career('dev', 9)] as never }));
    });
    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('mounts harmlessly with no game store in context', () => {
    // A throw here would trip the surrounding ProviderBoundary and replace the
    // whole game with an error screen — over an optional review prompt.
    let renderer!: TestRenderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        renderer = TestRenderer.create(
          <GameStoreContext.Provider value={null}>
            <ReviewPromptHandler />
          </GameStoreContext.Provider>,
        );
      });
    }).not.toThrow();
    expect(renderer.toJSON()).toBeNull();
  });
});
