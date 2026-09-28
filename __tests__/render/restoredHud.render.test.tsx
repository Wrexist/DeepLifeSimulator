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

  // Purchase and readout have separate, non-nested touch ownership.
  const buyGems = button('Buy gems')!;
  const gemBalance = r.renderer.root.findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel?.startsWith('Gems:'))!;
  expect(buyGems).toBeDefined();
  expect(gemBalance.findAllByType(TouchableOpacity)).not.toContain(buyGems);
  expect(styles.gemPurchaseTarget.width).toBeGreaterThanOrEqual(44);
  expect(styles.gemPurchaseTarget.minHeight).toBeGreaterThanOrEqual(44);
  expect(styles.gemBalanceTarget.minWidth).toBeGreaterThanOrEqual(44);
  expect(styles.gemBalanceTarget.minHeight).toBeGreaterThanOrEqual(44);

  // Long press still opens the vital quick actions in the floating container.
  act(() => button('Energy level')!.props.onLongPress());
  expect(button('Rest')).toBeDefined();
  // Each ring offers only actions that raise its own stat: eating restores no
  // energy, so the Energy ring no longer offers it.
  expect(button('Eat')).toBeUndefined();
  expect(button('Eat Healthy')).toBeUndefined();
  expect(styles.quickActionsContainer.position).toBe('absolute');

  act(() => button('Energy level')!.props.onLongPress());
  expect(button('Rest')).toBeUndefined();

  // Health: Rest adds no health (and costs happiness), so it is not here.
  act(() => button('Health level')!.props.onLongPress());
  expect(button('Eat Healthy')).toBeDefined();
  expect(button('Exercise')).toBeDefined();
  expect(button('Rest')).toBeUndefined();
  act(() => button('Health level')!.props.onLongPress());

  r.unmount();
});
