import React from 'react';
import { act } from 'react-test-renderer';
import FinanceOverview from '@/components/finance/FinanceOverview';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { renderWithProviders } from './helpers/renderWithProviders';
import { AppProviders } from '@/contexts/AppProviders';

let mockState: GameState;
jest.mock('@/contexts/game/useGameSelector', () => ({
  ...jest.requireActual('@/contexts/game/useGameSelector'),
  useGameSelector: (selector: (s: GameState) => unknown) => selector(mockState),
}));

it('keeps recorded wealth history reachable without adding a fake opening chart', () => {
  mockState = createTestGameState();
  if (!mockState.lifetimeStatistics) throw new Error('Fixture requires lifetime statistics');
  mockState.lifetimeStatistics.netWorthHistory = [];
  const view = renderWithProviders(<FinanceOverview />);
  expect(view.json).not.toContain('Wealth history');
  mockState.lifetimeStatistics.netWorthHistory = [
    { week: 10, value: 1500 },
    { week: 20, value: 2300 },
  ];
  act(() => view.renderer.update(<AppProviders><FinanceOverview /></AppProviders>));
  const disclosure = view.renderer.root.findAll(node => node.props.accessibilityLabel === 'Wealth history' && typeof node.props.onPress === 'function')[0];
  expect(disclosure).toBeDefined();
  expect(JSON.stringify(view.renderer.toJSON())).not.toContain('Recorded net worth from week');
  act(() => disclosure.props.onPress());
  expect(JSON.stringify(view.renderer.toJSON())).toContain('Recorded net worth from week 10 to week 20');
  view.unmount();
});
