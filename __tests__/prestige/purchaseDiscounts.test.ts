/**
 * The three re-purposed unlock bonuses (2026-08-23 owner rebalance).
 *
 * All three sold gates that never existed, were caught by the inert-bonus
 * audit, and sat refused-for-sale while the product question stayed open. The
 * owner resolved it to RE-PURPOSE — same ids, same prices, real effects — so
 * every player who already paid gets the effect retroactively.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { getItemPurchasePrice } from '@/lib/economy/itemPricing';
import { getInflatedPrice } from '@/lib/economy/inflation';
import {
  ITEM_DISCOUNT_RATE,
  PROPERTY_DISCOUNT_RATE,
  RENTAL_INCOME_BONUS_RATE,
  itemPriceMultiplier,
  propertyPriceMultiplier,
  rentalIncomeMultiplier,
} from '@/lib/prestige/purchaseDiscounts';
import { isInertBonus } from '@/lib/prestige/prestigeBonuses';
import { runRealEstateWeeklyTick, REAL_ESTATE_WEEKLY_RENT_CAP } from '@/lib/realEstate/weeklyTick';
import { buyItem } from '@/contexts/game/actions/ItemActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { quotePropertyPurchase } from '@/contexts/game/actions/RealEstateActions';
import { RESIDENTIAL_CATALOG } from '@/lib/realEstate/catalog';

const withBonuses = (ids: string[], overrides: Partial<GameState> = {}): GameState =>
  createTestGameState({
    ...overrides,
    prestige: { ...createTestGameState().prestige, unlockedBonuses: ids },
  } as Partial<GameState>);

describe('the multipliers', () => {
  it('apply only when the bonus is owned', () => {
    expect(itemPriceMultiplier([])).toBe(1);
    expect(itemPriceMultiplier(['early_item_access'])).toBeCloseTo(1 - ITEM_DISCOUNT_RATE, 10);
    expect(propertyPriceMultiplier([])).toBe(1);
    expect(propertyPriceMultiplier(['early_real_estate'])).toBeCloseTo(1 - PROPERTY_DISCOUNT_RATE, 10);
    expect(rentalIncomeMultiplier([])).toBe(1);
    expect(rentalIncomeMultiplier(['auto_manage_properties'])).toBeCloseTo(1 + RENTAL_INCOME_BONUS_RATE, 10);
  });

  it('tolerate a garbage bonus list', () => {
    expect(itemPriceMultiplier(undefined)).toBe(1);
    expect(propertyPriceMultiplier(null)).toBe(1);
    expect(rentalIncomeMultiplier(undefined)).toBe(1);
  });

  it('the three ids are purchasable again — no longer refused as inert', () => {
    for (const id of ['early_item_access', 'early_real_estate', 'auto_manage_properties']) {
      expect(isInertBonus(id)).toBe(false);
    }
  });
});

describe('Premium Access — items 15% cheaper, charged and displayed alike', () => {
  it('the shared price helper applies the discount', () => {
    const full = getItemPurchasePrice(1000, 1, []);
    const cut = getItemPurchasePrice(1000, 1, ['early_item_access']);
    expect(full).toBe(1000);
    expect(cut).toBeCloseTo(850, 10);
  });

  it('buyItem charges the discounted price', () => {
    const state = withBonuses(['early_item_access'], {
      stats: { ...createTestGameState().stats, money: 10_000 },
    } as Partial<GameState>);
    const item = state.items.find(i => !i.owned && i.price > 0)!;
    const expected = getItemPurchasePrice(item.price, state.economy?.priceIndex ?? 1, ['early_item_access']);

    const setGameState = jest.fn();
    const result = buyItem(state, setGameState, item.id, { updateMoney });
    expect(result).toMatchObject({ success: true });
    const next = (setGameState.mock.calls[0][0] as (s: GameState) => GameState)(state);
    expect(next.stats.money).toBeCloseTo(10_000 - expected, 6);
    expect(next.items.find(i => i.id === item.id)?.owned).toBe(true);
  });

  it('cannot be arbitraged: sell price stays 50% of the UNDISCOUNTED price', () => {
    // Buy at 0.85×P, sell at 0.50×P — still a 0.35×P loss.
    const state = withBonuses(['early_item_access']);
    const item = state.items.find(i => i.price > 0)!;
    const buyPrice = getItemPurchasePrice(item.price, 1, ['early_item_access']);
    const sellPrice = getInflatedPrice(item.price, 1) * 0.5;
    expect(sellPrice).toBeLessThan(buyPrice);
  });
});

describe('Real Estate Mogul — properties 10% cheaper, basis at the paid price', () => {
  const studio = RESIDENTIAL_CATALOG[0];

  it('the quote prices from the discounted figure', () => {
    const rich = (ids: string[]) =>
      withBonuses(ids, { stats: { ...createTestGameState().stats, money: 10_000_000 } } as Partial<GameState>);
    const full = quotePropertyPurchase(rich([]), studio, 'cash', '15y', 2000);
    const cut = quotePropertyPurchase(rich(['early_real_estate']), studio, 'cash', '15y', 2000);
    expect(full.rejected).toBe(false);
    expect(cut.rejected).toBe(false);
    expect(cut.effectivePrice).toBe(Math.round(studio.price * 0.9));
    expect(cut.downPaymentUSD!).toBeLessThan(full.downPaymentUSD!);
  });
});

describe('Property Manager — +15% tenant rent, inside the cap', () => {
  const rentedProperty = {
    ...RESIDENTIAL_CATALOG[0],
    owned: true,
    status: 'rented' as const,
    currentValue: RESIDENTIAL_CATALOG[0].price,
    tenant: {
      name: 'Test Tenant', weeklyRent: 1000, satisfaction: 80,
      movedInWeek: 0, leaseWeeks: 52,
    },
  };
  const tick = (mult?: number) =>
    runRealEstateWeeklyTick({
      legacyProcessedProperties: [rentedProperty as never],
      legacyRentalIncome: 0,
      currentWeek: 100,
      rollFor: () => 0.5,
      rentalIncomeMultiplier: mult,
    });

  it('pays more rent with the bonus than without', () => {
    const base = tick(undefined).rentalIncome;
    const boosted = tick(1 + RENTAL_INCOME_BONUS_RATE).rentalIncome;
    if (base > 0) {
      expect(boosted).toBeGreaterThan(base);
      expect(boosted).toBeCloseTo(Math.round(base * 1.15), 0);
    } else {
      // A net-negative or zero week must NOT be amplified.
      expect(boosted).toBe(base);
    }
  });

  it('never exceeds the weekly rent cap', () => {
    const boosted = tick(1.15).rentalIncome;
    expect(boosted).toBeLessThanOrEqual(REAL_ESTATE_WEEKLY_RENT_CAP);
  });
});
