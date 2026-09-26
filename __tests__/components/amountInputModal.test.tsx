import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity, Modal } from 'react-native';
import AmountInputModal from '@/components/banking/AmountInputModal';
import { parseAmount } from '@/utils/parseAmount';

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

describe('complete amount parsing', () => {
  it.each([['1,000', 1000], ['12,345.67', 12345.67], ['.000001', .000001], [' 0 ', 0], ['1234.50', 1234.5]])('parses %s without truncation', (text, expected) => {
    expect(parseAmount(String(text))).toBe(expected);
  });
  it.each(['', ' ', '1,2', '1,000oops', '1.2.3', '-10', 'Infinity', '1e3', '$100', 'NaN', '9'.repeat(400)])('rejects %s', text => {
    expect(parseAmount(text)).toBeNull();
  });
});

it('confirms the entire grouped amount, rejects invalid text and exposes accessible controls', () => {
  const confirm = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<AmountInputModal visible title="Deposit" confirmLabel="Deposit" maxAmount={2000} presets={[100]} darkMode onConfirm={confirm} onClose={() => {}} />); });
  const input = renderer.root.findByType(TextInput);
  const button = () => renderer.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel?.startsWith('Deposit'))!;
  expect(input.props.accessibilityLabel).toBe('Deposit amount in dollars');
  expect(renderer.root.findByType(Modal).props.animationType).toBe('none');
  expect(button().props.disabled).toBe(true);
  act(() => input.props.onChangeText('1,000'));
  expect(button().props.accessibilityState.disabled).toBe(false);
  act(() => button().props.onPress());
  expect(confirm).toHaveBeenCalledWith(1000);
  act(() => input.props.onChangeText('1,00'));
  expect(button().props.disabled).toBe(true);
  act(() => button().props.onPress());
  expect(confirm).toHaveBeenCalledTimes(1);
  act(() => input.props.onChangeText('2,001'));
  expect(button().props.disabled).toBe(true);
  act(() => renderer.unmount());
});

it('requires explicit zero when clearing a budget', () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<AmountInputModal visible title="Budget" allowZero darkMode onConfirm={() => {}} onClose={() => {}} />); });
  const button = () => renderer.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel?.startsWith('Confirm'))!;
  expect(button().props.disabled).toBe(true);
  act(() => renderer.root.findByType(TextInput).props.onChangeText('0'));
  expect(button().props.disabled).toBe(false);
  act(() => renderer.unmount());
});
