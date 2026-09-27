import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { CashChip, HeaderChip } from '@/components/ui/AppHeader';
import { financeColors } from '@/lib/config/theme';
import { weeklyStatDeltaPresentation, DIRECTION_COLOR } from '@/lib/config/statIdentity';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: jest.requireActual<typeof import('@/lib/config/theme')>('@/lib/config/theme').getThemeColors(true) }),
}));

it('gives cash one identity and preserves the optional action', () => {
  const onPress = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<CashChip value="$500" onPress={onPress} />); });
  const chip = tree.root.findByType(HeaderChip);
  expect(chip.props).toMatchObject({ label: 'Cash', value: '$500', tint: financeColors.cash });
  act(() => chip.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it.each([0, -0, NaN, Infinity])('makes an absent or zero weekly effect neutral (%s)', delta => {
  expect(weeklyStatDeltaPresentation(delta)).toEqual({ value: '0', sub: 'No change', tint: undefined });
});

it('expresses gains and losses with text and signs as well as color', () => {
  expect(weeklyStatDeltaPresentation(3)).toEqual({ value: '+3', sub: 'Weekly gain', tint: DIRECTION_COLOR.positive });
  expect(weeklyStatDeltaPresentation(-2)).toEqual({ value: '-2', sub: 'Weekly loss', tint: DIRECTION_COLOR.negative });
});
