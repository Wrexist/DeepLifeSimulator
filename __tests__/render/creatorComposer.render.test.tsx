import React from 'react';
import { act } from 'react-test-renderer';
import GamingApp from '@/components/computer/GamingApp';
import { renderWithProviders } from './helpers/renderWithProviders';

it('keeps a draft unpublished until it has a title and retains the existing upload gate', () => {
  const result = renderWithProviders(<GamingApp onBack={() => undefined} />);
  const button = () => result.renderer.root.findAll(node =>
    node.props.accessibilityLabel === 'Record and upload' && typeof node.props.onPress === 'function')[0];
  const input = result.renderer.root.findByProps({ accessibilityLabel: 'Video title' });
  expect(result.json).toContain('DRAFT');
  expect(result.json).not.toContain('PREVIEW');
  expect(button().props.disabled).toBe(true);
  act(() => input.props.onChangeText('   '));
  expect(button().props.disabled).toBe(true);
  act(() => input.props.onChangeText('My first build'));
  expect(button().props.disabled).toBe(false);
  expect(button().props.accessibilityState.disabled).toBe(false);
  act(() => input.props.onChangeText(''));
  expect(button().props.disabled).toBe(true);
  result.unmount();
});
