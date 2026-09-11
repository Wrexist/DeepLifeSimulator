import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import WelcomeBackPopup from '@/components/WelcomeBackPopup';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true } as Record<string, unknown>, {
  get: (target, prop) => prop in target ? target[prop as string] : prop,
}));

it('closes the return summary once and opens the recommended goal with reduced motion', () => {
  const close = jest.fn();
  const { renderer, unmount } = renderWithProviders(<WelcomeBackPopup visible onClose={close} />);
  const buttons = renderer.root.findAll(node => typeof node.type === 'string' &&
    node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Continue:'));
  expect(buttons).toHaveLength(1);
  act(() => buttons[0].props.onPress());
  act(() => buttons[0].props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush.mock.calls[0][0]).toMatch(/^\/\(tabs\)\//);
  unmount();
});
