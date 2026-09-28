import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import PersonalContactActions from '@/components/contacts/PersonalContactActions';
import type { Relationship } from '@/contexts/game/types';

const base: Relationship = { id: 'person', name: 'Alex', type: 'friend', relationshipScore: 40, personality: 'balanced', gender: 'male', age: 30 };
function render(r = base, money = 1000, week = 10) {
  const onAction = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<PersonalContactActions relationship={r} money={money} week={week} darkMode onAction={onAction} />); });
  return { tree, onAction, text: () => JSON.stringify(tree.toJSON()), button: (label: string) => tree.root.findByProps({ accessibilityLabel: `${label} with Alex` }) };
}

it.each(['parent', 'friend', 'partner'] as const)('explains costs and obligations for a %s', type => {
  const s = render({ ...base, type });
  expect(s.text()).toContain('No energy cost');
  expect(s.text()).toContain('$30 now');
  expect(s.text()).toContain('Repay accepted loans in Favors');
  expect(s.text()).toContain('Collect the money from Favors');
  expect(s.text().includes('Build bond')).toBe(type !== 'parent');
  act(() => s.button('Call').props.onPress());
  expect(s.onAction).toHaveBeenCalledWith('call');
  act(() => s.tree.unmount());
});

it('blocks unavailable actions with visible reasons but leaves free calling available', () => {
  const s = render({ ...base, actions: { askmoney: 10, lendmoney: 10 } }, 0);
  expect(s.button('Hang out').props.disabled).toBe(true);
  expect(s.button('Ask to borrow').props.disabled).toBe(true);
  expect(s.button('Lend $100').props.disabled).toBe(true);
  expect(s.text()).toContain('Need $30 cash');
  expect(s.text()).toContain('Available next week');
  expect(s.button('Call').props.disabled).toBe(false);
  act(() => s.button('Hang out').props.onPress());
  expect(s.onAction).not.toHaveBeenCalled();
  act(() => s.tree.unmount());
});

it('reopens weekly actions and explains a maximum bond and guaranteed borrowing', () => {
  const s = render({ ...base, relationshipScore: 100, moneyRequestAttempts: 5, actions: { call: 9, askmoney: 9 } }, 10000);
  expect(s.button('Call').props.disabled).toBe(false);
  expect(s.button('Ask to borrow').props.disabled).toBe(false);
  expect(s.button('Build bond').props.disabled).toBe(true);
  expect(s.text()).toContain('Bond is already at 100');
  expect(s.text()).toContain('Guaranteed after repeated refusals');
  act(() => s.tree.unmount());
});
