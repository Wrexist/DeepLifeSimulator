/**
 * `first_week_completed` must fire for EVERY scenario, not just the age-18 ones.
 *
 * The event is the first rung of the retention funnel — "this player played a
 * week" — and it was armed from the raw `weeksLived`:
 *
 *     const firstWeekFired = useRef(weeksLived >= 1); // already past it → don't fire
 *
 * `weeksLived` is ABSOLUTE and seeded from the starting age
 * (`computeWeeksLived` = `(age - 18) * 52`), so an age-25 character mounts at
 * 364 and an age-40 one at 1,144. The ref armed itself on the very first render
 * and the event never fired for them. Silent, by construction: the funnel does
 * not report a missing event, it reports a smaller number — and the scenarios
 * affected are most of the shipped set (19, 20, 22, 25, 28, 30, 40).
 *
 * Fourth instance of the class in CLAUDE.md §4.2.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  analytics: { endSession: jest.fn(), startSession: jest.fn() },
}));

// The tracker gates every transition event on hydration having finished. These
// tests are about what happens AFTER that, so the provider is stubbed rather
// than driven.
jest.mock('@/contexts/game/GameUIContext', () => ({
  useGameUI: () => ({ isLoading: false }),
}));

jest.mock('expo-router', () => ({ usePathname: () => '/home' }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AnalyticsTracker } = require('@/lib/analytics/AnalyticsTracker');

/** A live store the test can advance a week at a time. */
function makeStore(initial: GameState) {
  let snapshot = initial;
  const subs = new Set<() => void>();
  return {
    store: {
      subscribe: (cb: () => void) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      getSnapshot: () => snapshot,
      setGameState: () => {},
    },
    advance(next: GameState) {
      snapshot = next;
      act(() => subs.forEach((cb) => cb()));
    },
  };
}

const lifeAt = (age: number, weeksPlayed: number): GameState => {
  const start = (age - 18) * 52;
  return createTestGameState({
    weeksLived: start + weeksPlayed,
    lifeStartWeek: start,
    date: { ...createTestGameState().date, age },
  });
};

const firedFirstWeek = () =>
  mockTrack.mock.calls.filter(([name]) => name === 'first_week_completed');

function mount(state: GameState) {
  const s = makeStore(state);
  act(() => {
    TestRenderer.create(
      <GameStoreContext.Provider value={s.store as never}>
        <AnalyticsTracker />
      </GameStoreContext.Provider>
    );
  });
  return s;
}

describe('first_week_completed measures the first week of THIS life', () => {
  beforeEach(() => mockTrack.mockClear());

  it.each([18, 20, 25, 40])(
    'fires on the first week played from an age-%i start',
    (age) => {
      const s = mount(lifeAt(age, 0));
      expect(firedFirstWeek()).toHaveLength(0);

      s.advance(lifeAt(age, 1));
      expect(firedFirstWeek()).toHaveLength(1);
    }
  );

  it('fires exactly once, not on every subsequent week', () => {
    const s = mount(lifeAt(25, 0));
    s.advance(lifeAt(25, 1));
    s.advance(lifeAt(25, 2));
    s.advance(lifeAt(25, 3));

    expect(firedFirstWeek()).toHaveLength(1);
    expect(mockTrack.mock.calls.filter(([n]) => n === 'week_advanced')).toHaveLength(3);
  });

  it('does NOT re-fire for a save that is already weeks into its life', () => {
    // The behaviour the ref was written for, which must survive the fix.
    const s = mount(lifeAt(25, 30));
    s.advance(lifeAt(25, 31));

    expect(firedFirstWeek()).toHaveLength(0);
  });

  it('a pre-v43 save with no baseline behaves exactly as it does today', () => {
    const s = mount(createTestGameState({ weeksLived: 40, lifeStartWeek: undefined }));
    s.advance(createTestGameState({ weeksLived: 41, lifeStartWeek: undefined }));

    expect(firedFirstWeek()).toHaveLength(0);
  });
});
