import { createTestGameState } from '../helpers/createTestGameState';
import { applyDeepLifePlusBenefits } from '@/contexts/game/actions/SubscriptionActions';
import {
  DEEP_LIFE_PLUS_PLANS,
  DEEP_LIFE_PLUS_BENEFITS,
  DEEP_LIFE_PLUS_WELCOME_GEMS,
  getDeepLifePlusPlan,
  isDeepLifePlusProduct,
} from '@/lib/subscription/deepLifePlus';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';

describe('DeepLife+ config', () => {
  it('exposes a monthly and a yearly plan with prices', () => {
    expect(DEEP_LIFE_PLUS_PLANS).toHaveLength(2);
    const monthly = getDeepLifePlusPlan('monthly');
    const yearly = getDeepLifePlusPlan('yearly');
    expect(monthly?.productId).toBe(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY);
    expect(yearly?.productId).toBe(SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY);
    expect(monthly?.price).toMatch(/^\$/);
    expect(yearly?.price).toMatch(/^\$/);
    expect(yearly?.badge).toBeTruthy();
  });

  it('recognises DeepLife+ product ids', () => {
    expect(isDeepLifePlusProduct(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY)).toBe(true);
    expect(isDeepLifePlusProduct(SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY)).toBe(true);
    expect(isDeepLifePlusProduct('deeplife_gems_100')).toBe(false);
  });

  it('lists only deliverable benefits', () => {
    const ids = DEEP_LIFE_PLUS_BENEFITS.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['no_ads', 'legacy_premium', 'welcome_gems']));
  });
});

describe('applyDeepLifePlusBenefits', () => {
  it('removes ads and grants the welcome gems on first activation', () => {
    const s = createTestGameState({ stats: { gems: 10 } as any });
    const next = applyDeepLifePlusBenefits(s);
    expect(next.settings.adsRemoved).toBe(true);
    expect(next.settings.deepLifePlusActivated).toBe(true);
    expect(next.settings.adsRemovedDate).toBeTruthy();
    expect(next.stats.gems).toBe(10 + DEEP_LIFE_PLUS_WELCOME_GEMS);
  });

  it('is idempotent — welcome gems are granted only once', () => {
    const s = createTestGameState({ stats: { gems: 0 } as any });
    const once = applyDeepLifePlusBenefits(s);
    const twice = applyDeepLifePlusBenefits(once);
    expect(twice.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // not doubled
    expect(twice.settings.adsRemoved).toBe(true);
  });

  it('preserves an existing adsRemovedDate (e.g. prior Remove Ads IAP)', () => {
    const s = createTestGameState({
      settings: { adsRemoved: true, adsRemovedDate: '2025-01-01T00:00:00.000Z' } as any,
    });
    const next = applyDeepLifePlusBenefits(s);
    expect(next.settings.adsRemovedDate).toBe('2025-01-01T00:00:00.000Z');
  });

  it('does not mutate the input state', () => {
    const s = createTestGameState({ stats: { gems: 5 } as any });
    applyDeepLifePlusBenefits(s);
    expect(s.stats.gems).toBe(5);
    expect(s.settings.deepLifePlusActivated).toBeUndefined();
  });
});
