import React from 'react';
import { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import TopStatsBar from '@/components/TopStatsBar';
import { renderWithProviders } from './helpers/renderWithProviders';
import { styles } from '@/components/TopStatsBarStyles';

it('keeps utility controls reachable through one disclosure and quick actions in flow', async () => {
  const r = renderWithProviders(<TopStatsBar />);
  const button = (label: string) => r.renderer.root.findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);
  expect(button('More controls')?.props.accessibilityState.expanded).toBe(false);
  expect(button('Open Settings')).toBeUndefined();
  act(() => button('More controls')!.props.onPress());
  expect(button('More controls')?.props.accessibilityState.expanded).toBe(true);
  expect(button('Open Settings')).toBeDefined();
  expect(button('Open Shop')).toBeDefined();
  act(() => button('More controls')!.props.onPress());
  expect(button('Open Settings')).toBeUndefined();
  expect(button('Advance to next week')).toBeDefined();
  expect(button('Health level')).toBeDefined();
  act(() => button('Energy level')!.props.onLongPress());
  expect(button('Rest')).toBeDefined();
  expect(button('Eat')).toBeDefined();
  expect(styles.quickActionsContainer.position).toBe('relative');
  act(() => button('Energy level')!.props.onLongPress());
  expect(button('Rest')).toBeUndefined();
  r.unmount();
});
