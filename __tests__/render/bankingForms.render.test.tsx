import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity, Modal } from 'react-native';
import OpenAccountModal from '@/components/banking/OpenAccountModal';
import AddBillModal from '@/components/banking/AddBillModal';
import LoanQuoteModal from '@/components/banking/LoanQuoteModal';
import { createTestGameState } from '../helpers/createTestGameState';

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const button = (tree: TestRenderer.ReactTestRenderer, label: string) => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label)!;
const input = (tree: TestRenderer.ReactTestRenderer, label: string) => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === label)!;

it('opens an account with the entire grouped deposit and rejects malformed/blank input', () => {
  const open = jest.fn(); let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<OpenAccountModal visible availableCash={5000} currentWeek={104} darkMode onOpen={open} onClose={() => {}} />); });
  expect(tree.root.findByType(Modal).props.animationType).toBe('none');
  act(() => button(tree, 'High-Yield Savings').props.onPress());
  for (const text of ['', '1,00', '1,000oops', 'Infinity', '6000']) {
    act(() => input(tree, 'Opening deposit in dollars').props.onChangeText(text));
    expect(button(tree, 'Open account').props.disabled).toBe(true);
    act(() => button(tree, 'Open account').props.onPress());
  }
  expect(open).not.toHaveBeenCalled();
  act(() => input(tree, 'Opening deposit in dollars').props.onChangeText('1,000.50'));
  act(() => button(tree, 'Open account').props.onPress());
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ initialDeposit: 1000.5, type: 'highYieldSavings' }));
  act(() => tree.unmount());
});

it('uses an eligible checking account and keeps the exact recurring amount and four-week cadence', () => {
  const add = jest.fn(), state = createTestGameState();
  const checking = state.banking!.accounts.find(a => a.type === 'checking')!;
  const accounts = [state.banking!.accounts.find(a => a.type === 'savings')!, checking];
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<AddBillModal visible accounts={accounts} cashAvailable={2000} currentWeek={104} darkMode onAdd={add} onClose={() => {}} />); });
  act(() => input(tree, 'Bill name').props.onChangeText('Club dues'));
  for (const text of ['1,00', '50oops', 'Infinity', '0']) {
    act(() => input(tree, 'Bill amount in dollars').props.onChangeText(text));
    expect(button(tree, 'Add bill').props.disabled).toBe(true);
    act(() => button(tree, 'Add bill').props.onPress());
  }
  expect(add).not.toHaveBeenCalled();
  act(() => input(tree, 'Bill amount in dollars').props.onChangeText('1,000.50'));
  act(() => button(tree, 'Add bill').props.onPress());
  expect(add).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000.5, fromAccountId: checking.id, cadence: 'monthly', nextDueWeek: 108 }));
  act(() => button(tree, 'Weekly').props.onPress());
  act(() => button(tree, 'Add bill').props.onPress());
  expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ nextDueWeek: 105 }));
  act(() => tree.update(<AddBillModal visible accounts={[]} currentWeek={104} darkMode onAdd={add} onClose={() => {}} />));
  expect(button(tree, 'Add bill').props.disabled).toBe(true);
  act(() => tree.unmount());
});

it('quotes and accepts the full grouped principal and rejects malformed amounts', () => {
  const accept = jest.fn(), state = createTestGameState(); let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<LoanQuoteModal visible gameState={state} weeklyIncome={2000} darkMode onAccept={accept} onClose={() => {}} />); });
  act(() => input(tree, 'Loan amount in dollars').props.onChangeText('1,000'));
  expect(button(tree, 'Accept loan').props.disabled).toBe(false);
  act(() => button(tree, 'Accept loan').props.onPress());
  expect(accept).toHaveBeenCalledWith(expect.objectContaining({ principal: 1000 }));
  for (const text of ['1,00', '500oops', 'Infinity', '']) {
    act(() => input(tree, 'Loan amount in dollars').props.onChangeText(text));
    expect(button(tree, 'Accept loan').props.disabled).toBe(true);
    act(() => button(tree, 'Accept loan').props.onPress());
  }
  expect(accept).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
