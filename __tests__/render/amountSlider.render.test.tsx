import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AmountSlider from '@/components/ui/AmountSlider';
Object.assign(jest.requireMock('react-native'), { PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) } });
const press = (t: TestRenderer.ReactTestRenderer, name: string) => t.root.findAll(n => n.props.accessibilityLabel === name && typeof n.props.onPress === 'function')[0].props.onPress();
it.each([0.00000013, 0.75, 100.75, 999999999.25])('Max preserves exact available %s and follows a changed cap', max => {
  const change = jest.fn(); let t!: TestRenderer.ReactTestRenderer;
  act(() => { t = TestRenderer.create(<AmountSlider value="0" onChangeText={change} maxAmount={max} precision={8} accessibilityLabel="Amount" />); });
  act(() => press(t, 'Amount: Max')); expect(Number(change.mock.calls.at(-1)[0])).toBe(max);
  act(() => t.update(<AmountSlider value={String(max)} onChangeText={change} maxAmount={max / 2} precision={8} accessibilityLabel="Amount" />));
  act(() => press(t, 'Amount: Max')); expect(Number(change.mock.calls.at(-1)[0])).toBe(max / 2);
  act(() => t.unmount());
});
it('supports drag endpoints and assistive adjustments without exceeding the available balance', () => {
  const change = jest.fn(); let t!: TestRenderer.ReactTestRenderer;
  act(() => { t = TestRenderer.create(<AmountSlider value="50" onChangeText={change} maxAmount={100} accessibilityLabel="Amount" />); });
  const track = () => t.root.findAll(n => n.props.accessibilityRole === 'adjustable' && n.props.onLayout)[0];
  act(() => track().props.onLayout({ nativeEvent: { layout: { width: 222 } } }));
  act(() => track().props.onPanResponderGrant({ nativeEvent: { locationX: 11 } }));
  expect(change).toHaveBeenLastCalledWith('0');
  act(() => track().props.onPanResponderMove({}, { dx: 200 }));
  expect(change).toHaveBeenLastCalledWith('100');
  act(() => track().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(change).toHaveBeenLastCalledWith('51');
  act(() => t.unmount());
});
