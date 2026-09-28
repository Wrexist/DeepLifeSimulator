import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import AccountTransferPanel from '@/components/banking/AccountTransferPanel';

Object.assign(jest.requireMock('react-native'), { PanResponder: { create: () => ({ panHandlers: {} }) } });

it.each([0.75, 100.75])('Max submits the full available %s including interest', balance => {
  const submit = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<AccountTransferPanel cashAvailable={500} accountBalance={balance} tint="#4488ff" darkMode onSubmit={submit} />); });
  act(() => tree.root.findAll(n => n.props.accessibilityLabel === 'Withdraw money' && typeof n.props.onPress === 'function')[0].props.onPress());
  act(() => tree.root.findAll(n => String(n.props.accessibilityLabel).startsWith('Max -') && typeof n.props.onPress === 'function')[0].props.onPress());
  const button = tree.root.findAll(n => String(n.props.accessibilityLabel).startsWith('Withdraw $') && typeof n.props.onPress === 'function')[0];
  expect(button.props.disabled).toBe(false);
  act(() => button.props.onPress());
  expect(submit).toHaveBeenCalledWith('withdraw', balance);
  act(() => tree.unmount());
});

it('reserves the required minimum balance when choosing Max', () => {
  const submit = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<AccountTransferPanel cashAvailable={500} accountBalance={1200.75} minimumBalance={1000} tint="#4488ff" darkMode onSubmit={submit} />); });
  act(() => tree.root.findAll(n => n.props.accessibilityLabel === 'Withdraw money' && typeof n.props.onPress === 'function')[0].props.onPress());
  act(() => tree.root.findAll(n => String(n.props.accessibilityLabel).startsWith('Max -') && typeof n.props.onPress === 'function')[0].props.onPress());
  act(() => tree.root.findAll(n => String(n.props.accessibilityLabel).startsWith('Withdraw $') && typeof n.props.onPress === 'function')[0].props.onPress());
  expect(submit).toHaveBeenCalledWith('withdraw', 200.75);
  act(() => tree.unmount());
});
