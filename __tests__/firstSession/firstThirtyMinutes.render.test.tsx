/**
 * Master Program 6 — the first 30 minutes, as rendered.
 *
 * Fresh-life renders of the surfaces a new player meets in order: the coach,
 * the first Next Week (daily reward timing), the recap (what the vitals are
 * doing and why), the crisis tip (what to do and where), and the quiet state.
 * Every case is a moment from the walkthrough in tasks/todo.md.
 */
import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from '../render/helpers/renderWithProviders';
import { useGameSelector, useSetGameState } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import Home from '@/app/(tabs)/home';
import LastWeekRecap from '@/components/LastWeekRecap';
import DailyRewardPopup from '@/components/DailyRewardPopup';
import FirstSessionCoach from '@/components/FirstSessionCoach';
import { ContextualTip } from '@/components/ContextualTip';

// `jest.setup.js` already mocks expo-router; this pins the router every
// component under test receives so a tap's destination can be asserted.
import { useRouter } from 'expo-router';
const mockPush = jest.fn();
const routerStub = { push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

/** Age-20 quick-start seed: absolute week 104, life starts there. */
const AGE_20 = 104;

function Seed({ mutate, children }: { mutate: (s: GameState) => GameState; children: React.ReactNode }) {
  const setGameState = useSetGameState();
  useEffect(() => {
    setGameState(mutate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/** Prints one state field into the tree so a render test can read it back. */
function Probe({ pick }: { pick: (s: GameState) => unknown }) {
  const value = useGameSelector((s) => JSON.stringify(pick(s as GameState) ?? null));
  return <>{`probe:${value}`}</>;
}

function renderSeeded(ui: React.ReactElement, mutate: (s: GameState) => GameState) {
  const r = renderWithProviders(<Seed mutate={mutate}>{ui}</Seed>);
  act(() => {});
  return { ...r, json: () => JSON.stringify(r.renderer.toJSON()) };
}

const freshLife =
  (weeksIntoLife: number, extra: (s: GameState) => Partial<GameState> = () => ({})) =>
  (s: GameState): GameState => ({
    ...s,
    weeksLived: AGE_20 + weeksIntoLife,
    lifeStartWeek: AGE_20,
    stats: { ...s.stats, money: 1_500, health: 100, happiness: 100, energy: 100 },
    realEstate: [],
    rental: undefined,
    bankSavings: 0,
    lastLoginRewardDate: undefined,
    lastLoginRewardAt: undefined,
    lastLoginRewardWeek: undefined,
    showDailyRewardPopup: false,
    ...extra(s),
  });

const employed = (s: GameState): Partial<GameState> => ({
  currentJob: 'fast_food',
  careers: (s.careers ?? []).map((c) =>
    c.id === 'fast_food' ? { ...c, applied: true, accepted: true, level: 0, progress: 48 } : c,
  ),
});

const pressLabelled = (renderer: ReturnType<typeof renderWithProviders>['renderer'], label: string) => {
  const node = renderer.root.findAll(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
  )[0];
  expect(node).toBeTruthy();
  act(() => {
    node.props.onPress();
  });
};

beforeEach(() => {
  mockPush.mockClear();
  (useRouter as jest.Mock).mockReturnValue(routerStub);
});

/** Captures the store setter so a test can advance the world after rendering. */
let setWorld: ((mutate: (s: GameState) => GameState) => void) | null = null;
function Grab() {
  const set = useSetGameState();
  useEffect(() => {
    setWorld = set;
    return () => {
      setWorld = null;
    };
  }, [set]);
  return null;
}

describe('the coach closes the loop', () => {
  it('"Got it" on "live a week" folds the card; the wage then brings the payoff, with the second loop named', () => {
    const { renderer, json, unmount } = renderSeeded(
      <>
        <Grab />
        <FirstSessionCoach />
      </>,
      freshLife(0, employed),
    );
    expect(json()).toContain('Hired. Now live a week');

    pressLabelled(renderer, 'Got it');
    expect(json()).not.toContain('Hired. Now live a week');

    // The wage lands on the next tick.
    act(() => {
      setWorld!((s) => ({ ...s, weeksLived: AGE_20 + 1, weekResult: { incomeEarned: 142, netChange: 142 } }));
    });
    act(() => {});
    const after = json();
    expect(after).toContain('You earned $142');
    expect(after).toMatch(/Life → Health tops them up for free/);
    unmount();
  });
});

describe('the first Next Week belongs to the first wage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const settle = () => {
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    act(() => {});
  };

  it('does not open the daily reward on tick one of a fresh life', () => {
    const { json, unmount } = renderSeeded(
      <>
        <Home />
        <Probe pick={(s) => s.showDailyRewardPopup} />
      </>,
      freshLife(1, employed),
    );
    settle();
    expect(json()).toContain('probe:false');
    unmount();
  });

  it('opens it on tick two', () => {
    const { json, unmount } = renderSeeded(
      <>
        <Home />
        <Probe pick={(s) => s.showDailyRewardPopup} />
      </>,
      freshLife(2, employed),
    );
    settle();
    expect(json()).toContain('probe:true');
    unmount();
  });
});

describe('the daily reward popup reports what was granted', () => {
  it('shows the gem amount and no invented money bonus', () => {
    const { json, unmount } = renderSeeded(
      <DailyRewardPopup visible rewardAmount={25} onClose={() => {}} />,
      freshLife(2, employed),
    );
    const j = json();
    // Text children serialize as ["+", "25"].
    expect(j).toContain('"+","25"');
    expect(j).toContain('"Gems"');
    expect(j).not.toContain('Money bonus');
    expect(j).not.toContain('"+1"');
    unmount();
  });
});

describe('the recap says where the vitals are going and why', () => {
  it('names the drift, its causes and the free fix, and routes to Health', () => {
    const { renderer, json, unmount } = renderSeeded(
      <LastWeekRecap />,
      freshLife(4, (s) => ({
        ...employed(s),
        weekResult: { incomeEarned: 142, netChange: 142, careerProgressPercent: 48 },
      })),
    );
    const j = json();
    expect(j).toContain('Each week');
    expect(j).toMatch(/-\d+ happiness/);
    expect(j).toMatch(/-\d+ health/);
    expect(j).toContain('No home');
    expect(j).toContain('free fixes in Health');
    // Cumulative career progress is labelled as what it is.
    expect(j).toContain('Promotion 48%');
    expect(j).not.toContain('Career +48%');

    const row = renderer.root.findAll(
      (n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Each week'),
    )[0];
    act(() => row.props.onPress());
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/(tabs)/life?segment=health'));
    unmount();
  });

  it('a promotion that is ready says so', () => {
    const { json, unmount } = renderSeeded(
      <LastWeekRecap />,
      freshLife(9, (s) => ({
        ...employed(s),
        weekResult: { incomeEarned: 142, netChange: 142, careerProgressPercent: 100 },
      })),
    );
    expect(json()).toContain('Promotion ready');
    unmount();
  });

  it('quiet: a comfortable, housed life gets no drift line', () => {
    const { json, unmount } = renderSeeded(
      <LastWeekRecap />,
      freshLife(300, (s) => ({
        stats: { ...s.stats, money: 400_000 },
        rental: { tierId: 'shared-room', startedWeek: AGE_20 + 200 },
        weekResult: { incomeEarned: 900, netChange: 600, careerProgressPercent: 10 },
      })),
    );
    expect(json()).not.toContain('Each week');
    unmount();
  });
});

describe('a crisis tip says what to do and takes you there', () => {
  it('low happiness names the free fix and routes to Health', () => {
    const { renderer, json, unmount } = renderSeeded(
      <ContextualTip type="low_happiness" onDismiss={() => {}} />,
      freshLife(8, employed),
    );
    expect(json()).toContain('Meditation and a walk in Life → Health are free');
    pressLabelled(renderer, 'Happiness is low. Meditation and a walk in Life → Health are free.');
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/(tabs)/life?segment=health'));
    unmount();
  });

  it('a ready promotion routes to Work', () => {
    const { renderer, unmount } = renderSeeded(
      <ContextualTip type="promotion_ready" onDismiss={() => {}} />,
      freshLife(8, employed),
    );
    pressLabelled(renderer, 'Promotion ready. Collect it in the Work tab.');
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/(tabs)/work'));
    unmount();
  });
});

describe('Home, week 8 of the walkthrough: three problems, one lead, one routed goal', () => {
  it('health 52 / happiness 17 / promotion ready → the happiness tip leads and the goals still offer a destination', () => {
    const { json, unmount } = renderSeeded(
      <Home />,
      freshLife(8, (s) => ({
        ...employed(s),
        careers: (s.careers ?? []).map((c) =>
          c.id === 'fast_food' ? { ...c, applied: true, accepted: true, level: 0, progress: 100 } : c,
        ),
        stats: { ...s.stats, money: 3_314, health: 52, happiness: 17, energy: 90 },
      })),
    );
    const j = json();
    expect(j).toContain('Happiness is low');
    expect(j).not.toContain('Promotion ready. Collect');
    // The goal ladder keeps its one routed row even with a chapter in flight.
    expect(j).toContain('What matters now');
    expect(j).toMatch(/Do something you enjoy|Get your health back up|Earn your next promotion/);
    unmount();
  });
});
