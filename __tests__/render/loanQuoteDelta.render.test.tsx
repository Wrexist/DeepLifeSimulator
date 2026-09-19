import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import LoanQuoteModal from '@/components/banking/LoanQuoteModal';
import { createTestGameState } from '../helpers/createTestGameState';
import { formatMoney } from '@/utils/moneyFormatting';

/**
 * MP08: an upfront-action delta for a new ordinary loan. The sheet quoted the
 * APR and the weekly payment, but not where the money lands or how heavy the
 * payment is against income.
 */
it('shows the checking balance after the loan and the payment share of income', () => {
  const state = createTestGameState();
  const checking = state.banking?.accounts.find((a) => a.type === 'checking');
  expect(checking).toBeDefined(); // guards the assertion below

  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <LoanQuoteModal
        visible
        gameState={state}
        weeklyIncome={2000}
        darkMode
        onAccept={() => {}}
        onClose={() => {}}
      />,
    );
  });
  act(() => tree.root.findByType(TextInput).props.onChangeText('10000'));

  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Checking after loan');
  expect(text).toContain(formatMoney((checking?.balance ?? 0) + 10_000));
  expect(text).toContain('Share of weekly income');

  act(() => tree.unmount());
});
