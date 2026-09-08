import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import FirstSessionCoach from '@/components/FirstSessionCoach';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

let mockState: GameState;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/utils/storageWrapper', () => ({ lazyAsyncStorage: {
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}),
} }));
jest.mock('@/contexts/game/useGameSelector', () => ({
  useGameSelector: (selector: (s: GameState) => unknown) => selector(mockState),
  shallowEqual: jest.fn(),
}));

it('follows application and payroll state without treating passive income as wages', async () => {
  mockState = createTestGameState({ currentJob: undefined });
  mockState = { ...mockState,
    lifetimeStatistics: { ...mockState.lifetimeStatistics!, totalWeeksWorked: 0 },
    weekResult: { incomeEarned: 30 },
  };
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<FirstSessionCoach />); });
  const text = () => JSON.stringify(tree.toJSON());
  const update = async (state: GameState) => {
    mockState = state;
    await act(async () => { tree.update(<FirstSessionCoach />); });
  };
  expect(text()).toContain('Choose your first job');
  expect(text()).not.toContain('Your first paid week');
  const career = mockState.careers[0];
  expect(career).toBeDefined();
  await update({ ...mockState, careers: [{ ...career, applied: true, accepted: false }] });
  expect(text()).toContain('Application under review');
  act(() => tree.root.findByProps({ accessibilityLabel: 'View application' }).props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/work');
  await update({ ...mockState, currentJob: career.id, careers: [{ ...career, applied: true, accepted: true }] });
  expect(text()).toContain('Hired. Now live a week');
  expect(text()).not.toContain('Your first paid week');
  act(() => tree.root.findByProps({ accessibilityLabel: 'Got it' }).props.onPress());
  expect(tree.toJSON()).toBeNull();
  await update({ ...mockState,
    lifetimeStatistics: { ...mockState.lifetimeStatistics!, totalWeeksWorked: 1 },
    weekResult: { incomeEarned: 140 },
  });
  expect(text()).toContain('Your first paid week');
  expect(text()).toContain('Total income this week: $140');
  act(() => tree.root.findByProps({ accessibilityLabel: 'Start playing' }).props.onPress());
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});
