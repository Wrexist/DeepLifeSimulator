/**
 * The crash screen's two buttons must actually get the player out.
 *
 * getDerivedStateFromError reset `retryCount` to 0 on every catch, so after
 * Try Again re-mounted a subtree that threw again the counter was back at 0:
 * the cap never tripped and a deterministic render crash looped forever. And
 * "Go Home" only cleared the error state - it navigated nowhere, so the same
 * subtree re-mounted and crashed again. 2026-10-21 audit SAVE-5.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// eslint-disable-next-line import/first
import ErrorBoundary from '@/components/ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('render kaboom');
}

function pressByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  const text = tree.root.findAll((n) => n.type === Text && n.props.children === label)[0];
  if (!text) throw new Error(`No "${label}" button on screen`);
  let node: TestRenderer.ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`"${label}" has no pressable parent`);
  node.props.onPress();
}

const hasText = (tree: TestRenderer.ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => n.type === Text && n.props.children === label).length > 0;

describe('ErrorBoundary recovery buttons', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockReplace.mockClear();
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('stops offering Try Again once the retry cap is reached', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
    });

    for (let i = 0; i < 3; i++) {
      expect(hasText(tree, 'Try Again')).toBe(true);
      await act(async () => pressByLabel(tree, 'Try Again'));
    }
    // Three retries, three re-throws: the cap must now hold.
    expect(hasText(tree, 'Try Again')).toBe(false);
    expect(hasText(tree, 'Max Retries')).toBe(true);
    act(() => tree.unmount());
  });

  it('Main Menu navigates away from the crashing screen', async () => {
    jest.useFakeTimers();
    try {
      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>,
        );
      });
      await act(async () => pressByLabel(tree, 'Main Menu'));
      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/MainMenu');
      act(() => tree.unmount());
    } finally {
      jest.useRealTimers();
    }
  });
});
