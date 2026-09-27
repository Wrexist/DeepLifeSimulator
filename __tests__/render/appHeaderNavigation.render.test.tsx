import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import AppHeader, { AppBackButton } from '@/components/ui/AppHeader';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: jest.requireActual<typeof import('@/lib/config/theme')>('@/lib/config/theme').getThemeColors(true) }),
}));

it('keeps Back first, labels its destination and dispatches the supplied navigation', () => {
  const onBack = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<AppHeader title="A longer company profile title" onBack={onBack} backLabel="Back to portfolio" right={<Text>Cash</Text>} />); });
  const back = tree.root.findByType(AppBackButton);
  expect(back.props.label).toBe('Back to portfolio');
  const button = back.findByType(TouchableOpacity);
  const style = StyleSheet.flatten(button.props.style);
  expect(style.width).toBeGreaterThanOrEqual(44);
  expect(style.height).toBeGreaterThanOrEqual(44);
  act(() => button.props.onPress());
  expect(onBack).toHaveBeenCalledTimes(1);
  const title = tree.root.findByProps({ accessibilityRole: 'header' });
  expect(StyleSheet.flatten(title.props.style).textAlign).not.toBe('center');
  expect(title.props.numberOfLines).toBe(2);
  act(() => tree.unmount());
});

it('uses the same accessible control in a branded toolbar', () => {
  const onBack = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<AppBackButton onBack={onBack} label="Back to mail" />); });
  const button = tree.root.findByType(TouchableOpacity);
  expect(button.props.accessibilityLabel).toBe('Back to mail');
  act(() => button.props.onPress());
  expect(onBack).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
