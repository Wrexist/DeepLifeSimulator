import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import { ReviewPromptHandler } from '@/components/ReviewPromptHandler';
import { maybeRequestReview as maybeRequestReviewImport } from '@/utils/ratingPrompt';
import { AFTERGLOW_MS, MAX_WAIT_MS } from '@/utils/reviewMoments';
import {
  beginCelebration,
  endCelebration,
  __resetCelebrationGateForTests,
} from '@/utils/celebrationGate';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState, type TestGameStateOverrides } from '../helpers/createTestGameState';

// The frequency gating has its own suite (utils/__tests__/ratingPrompt.test.ts)
// and the timing rules have theirs (utils/__tests__/reviewMoments.test.ts).
// Here we only care that the handler arms, waits, and fires at the right time.
jest.mock('@/utils/ratingPrompt', () => ({
  maybeRequestReview: jest.fn(() => Promise.resolve({ requested: true, reason: 'requested' })),
}));

const maybeRequestReview = maybeRequestReviewImport as unknown as jest.Mock;

const ladder = (id: string, level: number) => ({
  id,
  level,
  accepted: true,
  progress: 0,
  levels: Array.from({ length: 6 }, (_, i) => ({ name: `L${i}`, salary: 100 })),
});

const makeState = (overrides: TestGameStateOverrides = {}): GameState =>
  createTestGameState({
    weeksLived: 100,
    stats: { money: 10000, health: 80 },
    careers: [],
    pendingEvents: [],
    ...overrides,
  });

/** A peak-intensity promotion: level 4 → 5 on a 6-rung ladder. */
const beforePromotion = () => makeState({ careers: [ladder('dev', 4)] as never });
const afterPromotion = () => makeState({ careers: [ladder('dev', 5)] as never });

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
      act(() => {
        listeners.forEach((fn) => fn());
      });
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

/** Advance both the fake clock and the fake timers together. */
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('render - ReviewPromptHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
    __resetCelebrationGateForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing', () => {
    expect(mount(makeStore(makeState())).toJSON()).toBeNull();
  });

  it('does NOT ask the instant the beat lands - the celebration is still playing', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(afterPromotion());

    expect(maybeRequestReview).not.toHaveBeenCalled();
    advance(AFTERGLOW_MS - 100);
    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('asks once the afterglow has elapsed', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(afterPromotion());
    advance(AFTERGLOW_MS + 1000);

    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
    expect(maybeRequestReview).toHaveBeenCalledWith('promotion', expect.any(Object));
  });

  it('abandons the ask when the run sours before it fires', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(afterPromotion());
    // Promoted on Monday, bankrupt on Tuesday. Asking now earns one star.
    store.push(makeState({ careers: [ladder('dev', 5)] as never, bankruptcyTriggered: true }));
    advance(MAX_WAIT_MS + 5000);

    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('holds the ask back while a weekly-event modal is queued', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(
      makeState({ careers: [ladder('dev', 5)] as never, pendingEvents: [{ id: 'e1' }] as never }),
    );
    advance(AFTERGLOW_MS + 2000);
    expect(maybeRequestReview).not.toHaveBeenCalled();

    // Event dismissed - the screen is calm again.
    store.push(makeState({ careers: [ladder('dev', 5)] as never, pendingEvents: [] as never }));
    advance(2000);
    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
  });

  it('gives up when the moment never gets calm', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(
      makeState({ careers: [ladder('dev', 5)] as never, pendingEvents: [{ id: 'e1' }] as never }),
    );
    advance(MAX_WAIT_MS + 2000);

    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('waits for a celebration modal to be dismissed before asking', () => {
    // The promotion celebration is local component state, invisible to
    // GameState - without the celebration gate the afterglow timer elapses
    // mid-celebration and the store sheet lands on top of the reward.
    const store = makeStore(beforePromotion());
    mount(store);

    beginCelebration();
    store.push(afterPromotion());
    advance(AFTERGLOW_MS + 3000);
    expect(maybeRequestReview).not.toHaveBeenCalled();

    endCelebration();
    advance(2000);
    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
  });

  it('ignores a beat too small to be worth an ask', () => {
    // The first milestone of a real four-stage ambition scores below the bar -
    // it is a good moment, just not a peak one worth one of three yearly asks.
    const store = makeStore(
      makeState({ ambitionId: 'business_empire', ambitionCompletedMilestones: [] }),
    );
    mount(store);

    store.push(
      makeState({ ambitionId: 'business_empire', ambitionCompletedMilestones: ['be_found'] }),
    );
    advance(AFTERGLOW_MS + 2000);

    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('keeps only one ask when several beats land in the same window', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(afterPromotion());
    store.push(makeState({ careers: [ladder('dev', 5)] as never, ambitionRewardClaimed: true }));
    advance(AFTERGLOW_MS + 2000);

    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on an ordinary state change', () => {
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(makeState({ careers: [ladder('dev', 4)] as never, weeksLived: 101 }));
    advance(AFTERGLOW_MS + 2000);

    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('diffs against the previous snapshot, not the one it mounted with', () => {
    // Guards the classic watcher bug: comparing every update against the mount
    // snapshot re-fires the same beat on every subsequent change.
    const store = makeStore(beforePromotion());
    mount(store);

    store.push(afterPromotion());
    advance(AFTERGLOW_MS + 2000);
    store.push(makeState({ careers: [ladder('dev', 5)] as never, weeksLived: 101 }));
    advance(AFTERGLOW_MS + 2000);

    expect(maybeRequestReview).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and cancels any armed timer on unmount', () => {
    const store = makeStore(beforePromotion());
    const renderer = mount(store);
    store.push(afterPromotion());
    expect(store.listenerCount).toBe(1);

    act(() => {
      renderer.unmount();
    });
    advance(AFTERGLOW_MS + 5000);

    expect(store.listenerCount).toBe(0);
    expect(maybeRequestReview).not.toHaveBeenCalled();
  });

  it('mounts harmlessly with no game store in context', () => {
    // A throw here would trip the surrounding ProviderBoundary and replace the
    // whole game with an error screen - over an optional review prompt.
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
