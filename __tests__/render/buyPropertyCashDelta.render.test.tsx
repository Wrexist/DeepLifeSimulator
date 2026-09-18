import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import BuyPropertyModal from '@/components/realEstate/BuyPropertyModal';
import { createTestGameState } from '../helpers/createTestGameState';
import { RESIDENTIAL_CATALOG } from '@/lib/realEstate/catalog';
import { quotePropertyPurchase } from '@/contexts/game/actions/RealEstateActions';
import { formatMoney } from '@/utils/moneyFormatting';

/**
 * MP08: an upfront-action delta. The purchase sheet showed the down payment and
 * the weekly mortgage, but not what the player's cash becomes the moment they
 * commit. Buyers had to subtract in their head.
 */
const property = RESIDENTIAL_CATALOG[0];
const state = createTestGameState({ stats: { money: 1_000_000 } });

it('shows the cash left after the down payment before you commit', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <BuyPropertyModal
        visible
        property={property}
        gameState={state}
        weeklyIncome={5000}
        darkMode
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
  });

  const quote = quotePropertyPurchase(state, property, 'standard', '30y', 5000);
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Cash after purchase');
  expect(text).toContain(formatMoney(1_000_000 - (quote.downPaymentUSD ?? 0)));

  act(() => tree.unmount());
});
