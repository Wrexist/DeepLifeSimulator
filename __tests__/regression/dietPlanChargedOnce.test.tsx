/**
 * A diet plan's first week is charged once, by the weekly tick (2026-10-17).
 *
 * Selecting a plan deducted a week's cost AND the next tick charged the same
 * week again (`applyDietPlanForWeek`), so every plan's first week cost double
 * for one week of benefits. The tick is the one owner of the charge now;
 * selecting only checks the first week is affordable and says so when not.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState } from '@/contexts/game';
import { useItemActions } from '@/contexts/game/ItemActionsContext';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { applyDietPlanForWeek } from '@/contexts/game/actions/weekly/applyDietPlan';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  toggleDietPlan: (planId: string) => void;
};
let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const { toggleDietPlan } = useItemActions();
  captured = { state: gameState, setGameState, toggleDietPlan };
  return null;
}

describe('diet plan: one charge per week', () => {
  jest.setTimeout(60_000);
  let root: { unmount: () => void } | null = null;

  beforeEach(() => {
    act(() => {
      root = TestRenderer.create(h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))));
    });
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    captured = null;
  });

  const setMoney = (money: number) =>
    act(() => captured!.setGameState(prev => ({ ...prev, stats: { ...prev.stats, money } })));

  it('selecting a plan activates it without charging', () => {
    setMoney(1_000);
    act(() => captured!.toggleDietPlan('basic'));
    expect(captured!.state.dietPlans?.find(p => p.id === 'basic')?.active).toBe(true);
    expect(captured!.state.stats.money).toBe(1_000);
  });

  it('a plan the player cannot cover for a week is not activated', () => {
    setMoney(100); // basic is $140/week
    act(() => captured!.toggleDietPlan('basic'));
    expect(captured!.state.dietPlans?.find(p => p.id === 'basic')?.active).toBe(false);
    expect(captured!.state.stats.money).toBe(100);
  });

  it('the tick charges exactly one week for the week it applies', () => {
    const state = createTestGameState({ stats: { money: 1_000, health: 50, energy: 50 } });
    const plans = (state.dietPlans || []).map(p => ({ ...p, active: p.id === 'basic' }));
    const ctx = { newStats: { ...state.stats } } as Parameters<typeof applyDietPlanForWeek>[1];
    applyDietPlanForWeek(plans, ctx);
    expect(ctx.newStats.money).toBe(1_000 - 20 * 7);
  });
});
