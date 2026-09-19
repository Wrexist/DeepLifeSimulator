import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import LastWeekRecap from '@/components/LastWeekRecap';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * MP09: the recap explained the week but offered no way to act on it. The
 * promotion badge is the one clear next step, so it now opens Work.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

let mockState: GameState;
jest.mock('@/contexts/game/useGameSelector', () => ({
  useGameSelector: (selector: (s: GameState) => unknown) => selector(mockState),
  shallowEqual: jest.fn(),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
jest.mock('@/utils/feedbackSystem', () => ({ useFeedback: () => ({ haptic: jest.fn() }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

it('links a ready promotion to the Work tab', () => {
  mockState = createTestGameState({
    weeksLived: 5,
    weekResult: { netChange: 100, incomeEarned: 500, expensesPaid: 400, careerProgressPercent: 100 },
  });

  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<LastWeekRecap />);
  });

  const badge = tree.root.findByProps({ accessibilityLabel: 'Promotion ready, open Work' });
  act(() => badge.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/work');

  act(() => tree.unmount());
});
