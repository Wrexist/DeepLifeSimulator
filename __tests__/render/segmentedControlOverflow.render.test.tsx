import React from 'react';
import { act } from 'react-test-renderer';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { renderWithProviders } from './helpers/renderWithProviders';

it('offers bounded overflow navigation without changing selection and removes it when tabs fit', () => {
  const onChange = jest.fn();
  const view = renderWithProviders(<SegmentedControl scrollable value="one" onChange={onChange}
    segments={[{ key: 'one', label: 'First destination' }, { key: 'two', label: 'Second destination' }]} />);
  const root = view.renderer.root;
  const outer = root.findAll(node => typeof node.props.onLayout === 'function')[0];
  const scroll = root.findAll(node => typeof node.props.onContentSizeChange === 'function')[0];
  act(() => {
    outer.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    scroll.props.onLayout({ nativeEvent: { layout: { width: 200 } } });
    scroll.props.onContentSizeChange(600);
  });
  const arrow = (label: string) => root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  expect(arrow('Show previous tabs').props.disabled).toBe(true);
  expect(arrow('Show more tabs').props.disabled).toBe(false);
  act(() => arrow('Show more tabs').props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  expect(arrow('Show previous tabs').props.disabled).toBe(false);
  act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 400 } } }));
  expect(arrow('Show more tabs').props.disabled).toBe(true);
  act(() => {
    outer.props.onLayout({ nativeEvent: { layout: { width: 800 } } });
    scroll.props.onLayout({ nativeEvent: { layout: { width: 780 } } });
  });
  expect(arrow('Show more tabs')).toBeUndefined();
  view.unmount();
});
