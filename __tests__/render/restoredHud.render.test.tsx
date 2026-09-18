import React from 'react';
import { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import TopStatsBar from '@/components/TopStatsBar';
import { renderWithProviders } from './helpers/renderWithProviders';
import { styles } from '@/components/TopStatsBarStyles';

/**
 * Owner feedback (2026-09-17): the compact disclosure HUD that replaced the
 * two-column layout was not wanted. This pins the restored header — Shop,
 * Settings and the season glyph are direct controls again (no "More controls"
 * disclosure), and the vitals keep their long-press quick actions.
 */
it('restores the two-column HUD: direct utilities and long-press quick actions', () => {
  const r = renderWithProviders(<TopStatsBar />);
  const button = (label: string) => r.renderer.root.findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);

  // Direct controls, no disclosure.
  expect(button('Open Shop')).toBeDefined();
  expect(button('Open Settings')).toBeDefined();
  expect(button('More controls')).toBeUndefined();

  expect(button('Advance to next week')).toBeDefined();
  expect(button('Health level')).toBeDefined();

  // Long press still opens the vital quick actions in the floating container.
  act(() => button('Energy level')!.props.onLongPress());
  expect(button('Rest')).toBeDefined();
  expect(button('Eat')).toBeDefined();
  expect(styles.quickActionsContainer.position).toBe('absolute');

  act(() => button('Energy level')!.props.onLongPress());
  expect(button('Rest')).toBeUndefined();

  r.unmount();
});
