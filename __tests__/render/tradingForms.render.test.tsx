import AmountSlider from '@/components/ui/AmountSlider';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity, Modal } from 'react-native';
import StockTradeModal from '@/components/stocks/StockTradeModal';
import PlaceOrderModal from '@/components/crypto/PlaceOrderModal';
import DCAModal from '@/components/crypto/DCAModal';
import { createTestGameState } from '../helpers/createTestGameState';

Object.assign(jest.requireMock('react-native'), { PanResponder: { create: () => ({ panHandlers: {} }) } });

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const button = (t: TestRenderer.ReactTestRenderer, label: string) => t.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label)!;
const input = (t: TestRenderer.ReactTestRenderer, label: string) => t.root.findAllByType(AmountSlider).find(n => n.props.accessibilityLabel === label)!;

it.each(['stock', 'crypto'])('%s keeps full amounts and checks pending commitments without blocking market trades', kind => {
  const submit = jest.fn(); let tree!: TestRenderer.ReactTestRenderer;
  const shared = { visible: true, cash: 2000, reservedCash: 1500, reservedUnits: 9, darkMode: true, onClose: () => {}, onSubmit: submit };
  const coin = { ...createTestGameState().cryptos[0], price: 100, owned: 10 };
  act(() => { tree = TestRenderer.create(kind === 'stock'
    ? <StockTradeModal {...shared} symbol="AAPL" midPrice={100} ownedShares={10} />
    : <PlaceOrderModal {...shared} coin={coin} />); });
  expect(tree.root.findByType(Modal).props.animationType).toBe('none');
  for (const text of ['1,00', '100oops', 'Infinity', '']) {
    act(() => input(tree, 'Trade amount in dollars').props.onChangeText(text));
    expect(button(tree, 'Execute Buy').props.disabled).toBe(true);
    act(() => button(tree, 'Execute Buy').props.onPress());
  }
  expect(submit).not.toHaveBeenCalled();
  act(() => input(tree, 'Trade amount in dollars').props.onChangeText('1,000.50'));
  act(() => button(tree, 'Execute Buy').props.onPress());
  expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 1000.5 }));
  act(() => button(tree, 'Limit').props.onPress());
  act(() => input(tree, 'Limit price in dollars').props.onChangeText('1,500.25'));
  expect(button(tree, 'Place Buy').props.disabled).toBe(true);
  act(() => input(tree, 'Trade amount in dollars').props.onChangeText('500'));
  expect(button(tree, 'Place Buy').props.disabled).toBe(true); // commission / pending-order buffer
  act(() => input(tree, 'Trade amount in dollars').props.onChangeText('100'));
  act(() => button(tree, 'Place Buy').props.onPress());
  expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 100, limitPrice: 1500.25 }));
  act(() => input(tree, 'Limit price in dollars').props.onChangeText('150oops'));
  expect(button(tree, 'Place Buy').props.disabled).toBe(true);
  act(() => button(tree, 'Sell').props.onPress());
  act(() => button(tree, 'Stop').props.onPress());
  act(() => input(tree, 'Stop price in dollars').props.onChangeText('50'));
  act(() => input(tree, 'Units to sell').props.onChangeText('1.5'));
  expect(button(tree, 'Place Sell').props.disabled).toBe(true);
  act(() => input(tree, 'Units to sell').props.onChangeText('.125'));
  act(() => button(tree, 'Place Sell').props.onPress());
  expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ amount: .125, stopPrice: 50 }));
  act(() => tree.unmount());
});

it('schedules exact recurring amounts and refuses removed funding accounts', () => {
  const state = createTestGameState(), submit = jest.fn(); let tree!: TestRenderer.ReactTestRenderer;
  const props = { visible: true, cryptos: state.cryptos, accounts: state.banking!.accounts, cashAvailable: 2000, darkMode: true, onClose: () => {}, onSubmit: submit };
  act(() => { tree = TestRenderer.create(<DCAModal {...props} />); });
  for (const text of ['10oops', '1,00', 'Infinity']) {
    act(() => input(tree, 'Recurring buy amount in dollars').props.onChangeText(text));
    expect(button(tree, 'Schedule recurring buy').props.disabled).toBe(true);
    act(() => button(tree, 'Schedule recurring buy').props.onPress());
  }
  expect(submit).not.toHaveBeenCalled();
  act(() => input(tree, 'Recurring buy amount in dollars').props.onChangeText('1,000.50'));
  act(() => button(tree, 'Every 4 weeks').props.onPress());
  act(() => button(tree, 'Schedule recurring buy').props.onPress());
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000.5, cadence: 'monthly', fromAccountId: 'checking-default' }));
  act(() => tree.update(<DCAModal {...props} accounts={[]} />));
  expect(button(tree, 'Schedule recurring buy').props.disabled).toBe(true);
  act(() => tree.unmount());
});
