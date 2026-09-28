import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity, StyleSheet } from 'react-native';
import ToastNotification from '@/components/ui/ToastNotification';
import { uiPalette } from '@/lib/config/theme';

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/utils/feedbackSystem', () => ({ useFeedback: () => ({ buttonPress: jest.fn() }) }));

it('keeps action and dismissal accessible on a navy, naturally stacked notification', () => {
  const dismiss = jest.fn(), action = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<ToastNotification id="test" message="Purchase could not be completed. Try again." type="error" persistent inStack onDismiss={dismiss} action={{ label: 'Retry', onPress: action }} />); });
  const retry = tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === 'Retry')!;
  act(() => retry.props.onPress());
  expect(action).toHaveBeenCalledTimes(1);
  const close = tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === 'Dismiss notification')!;
  expect(StyleSheet.flatten(close.props.style).height).toBeGreaterThanOrEqual(44);
  act(() => close.props.onPress());
  expect(dismiss).toHaveBeenCalledWith('test');
  const surfaces = tree.root.findAll(n => n.props.style && StyleSheet.flatten(n.props.style)?.backgroundColor === uiPalette.surface);
  expect(surfaces.length).toBeGreaterThan(0);
  act(() => tree.unmount());
});
