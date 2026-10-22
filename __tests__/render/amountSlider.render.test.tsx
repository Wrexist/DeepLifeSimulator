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
  // A tap on the track selects on release (APP-7: a touch that becomes a
  // vertical scroll must not move the value).
  act(() => track().props.onPanResponderGrant({ nativeEvent: { locationX: 11 } }));
  expect(change).not.toHaveBeenCalled();
  act(() => track().props.onPanResponderRelease({}, { dx: 0, dy: 0 }));
  expect(change).toHaveBeenLastCalledWith('0');
  act(() => track().props.onPanResponderGrant({ nativeEvent: { locationX: 11 } }));
  act(() => track().props.onPanResponderMove({}, { dx: 200, dy: 0 }));
  expect(change).toHaveBeenLastCalledWith('100');
  act(() => track().props.onPanResponderRelease({}, { dx: 200, dy: 0 }));
  // A mostly vertical move (a scroll) leaves the value alone.
  change.mockClear();
  act(() => track().props.onPanResponderGrant({ nativeEvent: { locationX: 11 } }));
  act(() => track().props.onPanResponderMove({}, { dx: 3, dy: 60 }));
  act(() => track().props.onPanResponderRelease({}, { dx: 3, dy: 60 }));
  expect(change).not.toHaveBeenCalled();
  act(() => track().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(change).toHaveBeenLastCalledWith('51');
  act(() => t.unmount());
});
it('accepts a typed exact amount and never writes exponent notation', () => {
  const change = jest.fn(); let t!: TestRenderer.ReactTestRenderer;
  act(() => { t = TestRenderer.create(<AmountSlider value="" onChangeText={change} maxAmount={0.0000001} precision={8} accessibilityLabel="Amount" />); });
  const typed = t.root.findAll(n => n.props.accessibilityLabel === 'Type Amount' && typeof n.props.onChangeText === 'function')[0];
  act(() => typed.props.onChangeText('1234.56'));
  expect(change).toHaveBeenLastCalledWith('1234.56');
  act(() => press(t, 'Amount: Max'));
  expect(change).toHaveBeenLastCalledWith('0.0000001');
  act(() => t.unmount());
});
