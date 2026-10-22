/**
 * LIFE-15 (owner decision 2026-10-22): a travel business stake yields ~20% a
 * year, not ~130%, and existing stakes pay the new rate without a migration.
 */
import {
  BUSINESS_OPPORTUNITY_ANNUAL_YIELD,
  MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME,
  businessOpportunityCost,
  businessOpportunityWeeklyIncome,
} from '../businessOpportunity';
import { DESTINATIONS } from '../destinations';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { BusinessOpportunity } from '@/contexts/game/types';

describe('LIFE-15: travel business opportunity yield', () => {
  it('every destination yields 15-25% a year on its stake', () => {
    for (const d of DESTINATIONS) {
      const cost = businessOpportunityCost(d.cost);
      const weekly = businessOpportunityWeeklyIncome({ cost });
      // Whole dollars a week: within rounding of 20%, which on the $400 stake
      // (a $200 trip) is $2 vs $1.54. Every other stake lands inside 15-25%.
      expect(Math.abs(weekly - (cost * 0.2) / 52)).toBeLessThanOrEqual(0.5);
      if (cost >= 1_000) {
        expect((weekly * 52) / cost).toBeGreaterThanOrEqual(0.15);
        expect((weekly * 52) / cost).toBeLessThanOrEqual(0.25);
      }
    }
    expect(BUSINESS_OPPORTUNITY_ANNUAL_YIELD).toBe(0.2);
  });

  it('the whole board no longer pays back inside a year', () => {
    const stakes = DESTINATIONS.map((d) => businessOpportunityCost(d.cost));
    const totalCost = stakes.reduce((a, b) => a + b, 0);
    const weekly = stakes.reduce((a, c) => a + businessOpportunityWeeklyIncome({ cost: c }), 0);
    expect(totalCost / weekly).toBeGreaterThan(200); // weeks to pay back; was 40
  });

  it('an opportunity saved at the old rate pays the new one', () => {
    const cost = 20_000;
    const legacy: BusinessOpportunity = {
      id: 'business_x', destinationId: 'x', name: 'X', description: '',
      cost, weeklyIncome: 500, unlocked: true, invested: true,
    };
    const base = createTestGameState();
    const state = createTestGameState({
      travel: { ...base.travel!, businessOpportunities: { business_x: legacy } },
    });
    const result = calcWeeklyPassiveIncome(state);
    expect(result.breakdown.businessOpportunities).toBe(Math.round((cost * 0.2) / 52));
    expect(result.breakdown.businessOpportunities).toBeLessThan(legacy.weeklyIncome);
  });

  it('caps the weekly figure and degrades corrupt stakes to 0', () => {
    expect(businessOpportunityWeeklyIncome({ cost: 1e9 })).toBe(MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME);
    expect(businessOpportunityWeeklyIncome({ cost: NaN })).toBe(0);
    expect(businessOpportunityWeeklyIncome(undefined)).toBe(0);
  });
});
