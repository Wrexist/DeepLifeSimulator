import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import KeyValueRow from '@/components/ui/KeyValueRow';
import Chip from '@/components/ui/Chip';
import SectionTitle from '@/components/ui/SectionTitle';
import { StatTile } from '@/components/ui/StatStrip';

// The repository RN mock leaves StyleSheet.flatten as identity. Resolve nested style arrays here.
const flatten = (style: unknown): Record<string, unknown> => Array.isArray(style)
  ? Object.assign({}, ...style.map(flatten))
  : style && typeof style === 'object' ? style as Record<string, unknown> : {};

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: jest.requireActual<typeof import('@/lib/config/theme')>('@/lib/config/theme').getThemeColors(true) }),
}));

it('keeps detail explanations in the accessible reading and allows long values to wrap', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<KeyValueRow label="Weekly payroll" value="$123,456,789" sub="Includes every named hire" />); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Weekly payroll $123,456,789, Includes every named hire' }).length).toBeGreaterThan(0);
  const texts = tree.root.findAllByType(Text);
  expect(texts.every(t => t.props.numberOfLines == null)).toBe(true);
  const value = texts.find(t => t.props.children === '$123,456,789')!;
  expect(flatten(value.props.style).flexShrink).toBe(1);
  expect(flatten(value.props.style).fontVariant).toContain('tabular-nums');
  act(() => tree.unmount());
});

it('keeps small action chips tappable and retains selection callbacks', () => {
  const onPress = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Chip label="A longer selected filter" selected onPress={onPress} />); });
  const button = tree.root.findByType(TouchableOpacity);
  expect(flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44);
  expect(button.props.accessibilityState.selected).toBe(true);
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(Text).props.numberOfLines).toBeUndefined();
  act(() => tree.unmount());
});

it('does not clamp supporting headings or stat explanations and keeps scaled line boxes', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<><SectionTitle title="Research and development opportunities" subtitle="Full requirement and cost explanation" /><StatTile label="Weekly company contribution" value="$123,456" sub="After the existing income adjustments" /></>); });
  for (const text of tree.root.findAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
    const style = flatten(text.props.style);
    if (typeof style.lineHeight !== 'number' || typeof style.fontSize !== 'number') {
      throw new Error('Expected a numeric font size and scaled line height');
    }
    expect(style.lineHeight).toBeGreaterThan(style.fontSize);
  }
  act(() => tree.unmount());
});
