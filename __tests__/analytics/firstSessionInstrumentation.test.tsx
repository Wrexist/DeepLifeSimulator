/**
 * The first-session funnel must actually leave the device.
 *
 * WHY THIS IS PINNED
 * ------------------
 * `lib/analytics/events.ts` declares the events its own docstring says exist to
 * measure "retention (D1/D7/D30) … and churn points". Three of them —
 * `onboarding_step`, `tutorial_step`, `session_end` — were declared and emitted
 * by NOTHING, which is invisible in every way that matters: it does not fail a
 * build, it does not throw, and the code that records the data locally looks
 * completely healthy. `onboardingAnalytics.ts` logged every step view and
 * completion to `logger` and stopped there.
 *
 * It cost a real measurement. "Play" cut a first-time player's route to a live
 * game from six taps to two, aimed at a Day-1 retention figure below the 25th
 * percentile of the peer set, and nothing could say whether it worked.
 *
 * These tests assert the wire, not the wording: that the events are emitted, on
 * the right edges, carrying the step number that makes them actionable.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import {
  logOnboardingStepView,
  logOnboardingStepComplete,
  logOnboardingValidationError,
} from '@/src/features/onboarding/onboardingAnalytics';
import { UIUXProvider, useUIUX } from '@/contexts/UIUXContext';
import { AnalyticsTracker } from '@/lib/analytics/AnalyticsTracker';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import { GameUIProvider } from '@/contexts/game/GameUIContext';
import { createTestGameState } from '../helpers/createTestGameState';

// Safe below the imports because ts-jest hoists `jest.mock` above them, and the
// factory only CLOSES OVER `mockTrack` — it never reads it at hoist time. Same
// shape as `__tests__/services/analyticsFanout.test.ts`.
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  analytics: { flush: jest.fn(), track: jest.fn() },
}));

beforeEach(() => {
  mockTrack.mockClear();
});

describe('onboarding funnel reaches the transport', () => {
  it('emits a step view as onboarding_step, not just a log line', () => {
    logOnboardingStepView('Customize');
    expect(mockTrack).toHaveBeenCalledWith('onboarding_step', { step: 'Customize', action: 'view' });
  });

  it('separates a completion from a view on the same event name', () => {
    // A drop-off is "view with no matching complete". Splitting these across two
    // event names would make the commonest question in the funnel a join.
    logOnboardingStepComplete('Perks', { slot: 2 });
    expect(mockTrack).toHaveBeenCalledWith('onboarding_step', {
      step: 'Perks',
      action: 'complete',
      slot: 2,
    });
  });

  it('carries the reason on a validation error, which is the why behind a stall', () => {
    logOnboardingValidationError('Customize', 'name_too_short');
    expect(mockTrack).toHaveBeenCalledWith('onboarding_step', {
      step: 'Customize',
      action: 'validation_error',
      reason: 'name_too_short',
    });
  });

  it('drops non-scalar meta rather than letting it reach the queue', () => {
    // Call-site meta is typed `unknown`. An object here would not just lose one
    // property — an unserialisable prop takes the whole event with it.
    logOnboardingStepView('Scenarios', { slot: 1, scenario: { id: 'x' }, ok: true, name: 's' });
    expect(mockTrack).toHaveBeenCalledWith('onboarding_step', {
      step: 'Scenarios',
      action: 'view',
      slot: 1,
      ok: true,
      name: 's',
    });
  });

  it('still logs locally - the transport is an addition, not a replacement', () => {
    // The dev console path is what makes a local run readable; regressing it
    // would trade one blind spot for another.
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logOnboardingStepView('MainMenu');
    spy.mockRestore();
    expect(mockTrack).toHaveBeenCalled();
  });
});

describe('tutorial funnel reports WHERE it was abandoned', () => {
  function harness() {
    const api: { current: ReturnType<typeof useUIUX> | null } = { current: null };
    function Probe() {
      api.current = useUIUX();
      return null;
    }
    act(() => {
      TestRenderer.create(
        <UIUXProvider>
          <Probe />
        </UIUXProvider>
      );
    });
    return api;
  }

  const steps = [
    { id: 'a', title: 'A', description: 'a' },
    { id: 'b', title: 'B', description: 'b' },
    { id: 'c', title: 'C', description: 'c' },
  ] as never;

  it('emits start with the total, so a completion rate has a denominator', () => {
    const api = harness();
    act(() => api.current!.startTutorial(steps));
    expect(mockTrack).toHaveBeenCalledWith(
      'tutorial_step',
      expect.objectContaining({ action: 'start', step: 0, total: 3 })
    );
  });

  it('reports the step a player skipped ON, not merely that they skipped', () => {
    // "They quit the tutorial" is not actionable. "They quit on step 2" names
    // the screen to rewrite.
    const api = harness();
    act(() => api.current!.startTutorial(steps));
    act(() => api.current!.setTutorialStep(2));
    mockTrack.mockClear();
    act(() => {
      void api.current!.skipTutorial();
    });
    expect(mockTrack).toHaveBeenCalledWith(
      'tutorial_step',
      expect.objectContaining({ action: 'skip', step: 2, total: 3 })
    );
  });

  it('emits completion exactly once per call, not once per state commit', () => {
    // The step is read from a ref precisely so the emit sits OUTSIDE the
    // setState updater. React may invoke an updater more than once for a single
    // commit (§4.4), which would report one abandonment as two.
    const api = harness();
    act(() => api.current!.startTutorial(steps));
    mockTrack.mockClear();
    act(() => {
      void api.current!.completeTutorial();
    });
    const completions = mockTrack.mock.calls.filter(
      ([name, props]) => name === 'tutorial_step' && (props as { action: string }).action === 'complete'
    );
    expect(completions).toHaveLength(1);
  });
});

describe('session_end makes session length measurable', () => {
  // The transport is a plain-JS batcher, not the Firebase SDK, so nothing
  // supplies session duration for free. For a Day-1 figure below the 25th
  // percentile, how long a first session lasts is the most diagnostic number
  // there is.
  const listeners: ((s: string) => void)[] = [];

  beforeEach(() => {
    listeners.length = 0;
    (AppState.addEventListener as unknown as jest.Mock).mockImplementation(
      (_evt: string, cb: (s: string) => void) => {
        listeners.push(cb);
        return { remove: jest.fn() };
      }
    );
  });

  function mountTracker() {
    const snapshot = createTestGameState({ weeksLived: 40 });
    const store = {
      subscribe: () => () => {},
      getSnapshot: () => snapshot,
      setGameState: () => {},
    };
    // The real provider, which starts in `isLoading: true`. That is deliberate
    // here: `session_end` must NOT be gated on hydration the way the week and
    // death transitions are. A player who opens the app and leaves during the
    // load has still had a session — and for a Day-1 investigation that is
    // precisely the session you cannot afford to miss.
    act(() => {
      TestRenderer.create(
        <GameStoreContext.Provider value={store as never}>
          <GameUIProvider>
            <AnalyticsTracker />
          </GameUIProvider>
        </GameStoreContext.Provider>
      );
    });
  }

  const fire = (state: string) => act(() => listeners.forEach((cb) => cb(state)));
  const endings = () => mockTrack.mock.calls.filter(([n]) => n === 'session_end');

  it('emits on the background edge, carrying a duration', () => {
    mountTracker();
    mockTrack.mockClear();
    fire('background');
    expect(endings()).toHaveLength(1);
    expect(endings()[0][1]).toEqual(expect.objectContaining({ durationSec: expect.any(Number) }));
  });

  it('does NOT end the session on `inactive`', () => {
    // iOS raises `inactive` for a notification-shade pull or an incoming call.
    // Treating that as the end would cut the measured length of every session
    // that survives one — understating the exact number being investigated.
    mountTracker();
    mockTrack.mockClear();
    fire('inactive');
    expect(endings()).toHaveLength(0);
  });

  it('does not emit twice for consecutive background events', () => {
    mountTracker();
    mockTrack.mockClear();
    fire('background');
    fire('background');
    expect(endings()).toHaveLength(1);
  });

  it('re-arms after a return to foreground, so a resumed session ends too', () => {
    mountTracker();
    mockTrack.mockClear();
    fire('background');
    fire('active');
    fire('background');
    expect(endings()).toHaveLength(2);
  });
});
