import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import FirstSessionCoach from '@/components/FirstSessionCoach';
import GoalsCard from '@/components/GoalsCard';
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

jest.mock('@/hooks/useLiveOps', () => ({ useLiveOps: () => ({ events: [] }) }));


it('gives the composed Home card one lead throughout coaching and restores recommendations on dismissal', async () => {
  mockState = createTestGameState({ currentJob: undefined, ambitionId: 'business_empire' });
  mockState = { ...mockState, lifetimeStatistics: { ...mockState.lifetimeStatistics!, totalWeeksWorked: 0 } };
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<GoalsCard />); });
  const text = () => JSON.stringify(tree.toJSON());
  expect(text()).toContain('Choose your first job');
  expect(text()).not.toContain('What matters now');
  expect(text()).not.toContain('Get hired');
  expect(text()).not.toContain('Get Hired');
  expect(text()).toContain('Found Your First Company');
  const career = mockState.careers[0];
  mockState = { ...mockState, careers: [{ ...career, applied: true, accepted: false }] };
  await act(async () => { tree.update(<GoalsCard onShowDetails={() => {}} />); });
  expect(text()).toContain('Application under review');
  expect(text()).not.toContain('Choose your first job');
  expect(text()).not.toContain('Get hired');
  mockState = { ...mockState, currentJob: career.id, careers: [{ ...career, applied: true, accepted: true }] };
  await act(async () => { tree.update(<GoalsCard onShowDetails={() => {}} />); });
  expect(text()).toContain('Hired. Now live a week');
  expect(text()).not.toContain('What matters now');
  act(() => tree.root.findByProps({ accessibilityLabel: 'Got it' }).props.onPress());
  expect(text()).not.toContain('Hired. Now live a week');
  expect(text()).toContain('What matters now');
  mockState = { ...mockState, lifetimeStatistics: { ...mockState.lifetimeStatistics!, totalWeeksWorked: 1 } };
  await act(async () => { tree.update(<GoalsCard onShowDetails={() => {}} />); });
  expect(text()).toContain('Your first paid week');
  expect(text()).not.toContain('What matters now');
  act(() => tree.root.findByProps({ accessibilityLabel: 'Start playing' }).props.onPress());
  expect(text()).toContain('What matters now');
  expect(text()).not.toContain('Your first paid week');
  act(() => tree.unmount());
  // Returning established players see their normal goal card immediately.
  await act(async () => { tree = TestRenderer.create(<GoalsCard />); });
  expect(text()).toContain('What matters now');
  expect(text()).not.toContain('Choose your first job');
  act(() => tree.unmount());
});
