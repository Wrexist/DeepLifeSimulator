import { createTestGameState } from '../helpers/createTestGameState';
import {
  applyDeepLifePlusBenefits,
  reconcileSubscriptionBenefits,
  claimDailyDeepLifePlusGems,
  canClaimDailyDeepLifePlusGems,
} from '@/contexts/game/actions/SubscriptionActions';
import {
  DEEP_LIFE_PLUS_PLANS,
  DEEP_LIFE_PLUS_BENEFITS,
  DEEP_LIFE_PLUS_WELCOME_GEMS,
  DEEP_LIFE_PLUS_DAILY_GEMS,
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
    // Every id here maps to functionality the game actually grants:
    //   no_ads/welcome_gems/legacy_premium/cosmetics → applyDeepLifePlusBenefits + tier
    //   income_boost → +25% career salary in applyCareerSalaryAndPenalty
    //   vip_support  → priority-flagged support in HelpModal
    const ids = DEEP_LIFE_PLUS_BENEFITS.map((b) => b.id).sort();
    expect(ids).toEqual(
      ['cosmetics', 'daily_gems', 'income_boost', 'legacy_premium', 'no_ads', 'vip_support', 'welcome_gems'].sort(),
    );
  });
});

describe('applyDeepLifePlusBenefits', () => {
  it('removes ads and grants the welcome gems on first activation', () => {
    const s = createTestGameState({ stats: { gems: 10 } });
    const next = applyDeepLifePlusBenefits(s);
    expect(next.settings.adsRemoved).toBe(true);
    expect(next.settings.deepLifePlusActivated).toBe(true);
    expect(next.settings.adsRemovedDate).toBeTruthy();
    expect(next.stats.gems).toBe(10 + DEEP_LIFE_PLUS_WELCOME_GEMS);
  });

  it('is idempotent — welcome gems are granted only once', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const once = applyDeepLifePlusBenefits(s);
    const twice = applyDeepLifePlusBenefits(once);
    expect(twice.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // not doubled
    expect(twice.settings.adsRemoved).toBe(true);
  });

  it('preserves an existing adsRemovedDate (e.g. prior Remove Ads IAP)', () => {
    const s = createTestGameState({
      settings: { adsRemoved: true, adsRemovedDate: '2025-01-01T00:00:00.000Z' },
    });
    const next = applyDeepLifePlusBenefits(s);
    expect(next.settings.adsRemovedDate).toBe('2025-01-01T00:00:00.000Z');
  });

  it('does not mutate the input state', () => {
    const s = createTestGameState({ stats: { gems: 5 } });
    applyDeepLifePlusBenefits(s);
    expect(s.stats.gems).toBe(5);
    expect(s.settings.deepLifePlusActivated).toBeUndefined();
  });
});

describe('claimDailyDeepLifePlusGems (members-only daily gem drop)', () => {
  const TODAY = '2026-07-23';
  const YESTERDAY = '2026-07-22';
  const member = (over = {}) =>
    createTestGameState({ stats: { gems: 0 }, settings: { deepLifePlusActivated: true, ...over } });

  it('grants the daily gems to a member who has not claimed today', () => {
    const next = claimDailyDeepLifePlusGems(member(), TODAY);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(next.settings.deepLifePlusLastGemClaim).toBe(TODAY);
  });

  it('is a no-op on a repeat same-day claim (returns the same state)', () => {
    const claimed = member({ deepLifePlusLastGemClaim: TODAY });
    expect(claimDailyDeepLifePlusGems(claimed, TODAY)).toBe(claimed);
  });

  it('is claimable again on a new day', () => {
    const claimedYesterday = member({ deepLifePlusLastGemClaim: YESTERDAY });
    const next = claimDailyDeepLifePlusGems(claimedYesterday, TODAY);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(next.settings.deepLifePlusLastGemClaim).toBe(TODAY);
  });

  it('does NOT grant gems to a non-member (returns the same state)', () => {
    const free = createTestGameState({ stats: { gems: 0 } });
    expect(claimDailyDeepLifePlusGems(free, TODAY)).toBe(free);
  });

  it('also works for a lifetime-premium owner', () => {
    const lifer = createTestGameState({ stats: { gems: 0 }, settings: { lifetimePremium: true } });
    expect(claimDailyDeepLifePlusGems(lifer, TODAY).stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
  });

  it('canClaim reflects membership + same-day state', () => {
    expect(canClaimDailyDeepLifePlusGems(member(), TODAY)).toBe(true);
    expect(canClaimDailyDeepLifePlusGems(member({ deepLifePlusLastGemClaim: TODAY }), TODAY)).toBe(false);
    expect(canClaimDailyDeepLifePlusGems(createTestGameState(), TODAY)).toBe(false);
  });
});

describe('reconcileSubscriptionBenefits', () => {
  it('applies benefits while the subscription is active', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const next = reconcileSubscriptionBenefits(s, /*plusActive*/ true, /*ownsRemoveAds*/ false);
    expect(next.settings.adsRemoved).toBe(true);
    expect(next.settings.deepLifePlusActivated).toBe(true);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS);
  });

  it('reverts DeepLife+ ad-free when the subscription lapses', () => {
    // Simulate a previously-active subscriber.
    const active = applyDeepLifePlusBenefits(createTestGameState());
    expect(active.settings.adsRemoved).toBe(true);

    const lapsed = reconcileSubscriptionBenefits(active, /*plusActive*/ false, /*ownsRemoveAds*/ false);
    expect(lapsed.settings.adsRemoved).toBe(false);
    expect(lapsed.settings.deepLifePlusActivated).toBe(false);
  });

  it('KEEPS ad-free on lapse if the permanent Remove Ads IAP is owned', () => {
    const active = applyDeepLifePlusBenefits(createTestGameState());
    const lapsed = reconcileSubscriptionBenefits(active, /*plusActive*/ false, /*ownsRemoveAds*/ true);
    expect(lapsed.settings.adsRemoved).toBe(true); // protected by the permanent IAP
    expect(lapsed.settings.deepLifePlusActivated).toBe(false);
  });

  it('is a no-op for a free user who never had DeepLife+', () => {
    const s = createTestGameState();
    const next = reconcileSubscriptionBenefits(s, false, false);
    expect(next).toBe(s);
  });

  it('does not re-grant welcome gems on repeated active reconciles', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const once = reconcileSubscriptionBenefits(s, true, false);
    const twice = reconcileSubscriptionBenefits(once, true, false);
    expect(twice.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // not doubled
  });

  it('does NOT re-grant welcome gems across a lapse + resubscribe (sticky flag)', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const subscribed = reconcileSubscriptionBenefits(s, true, false); // +500, welcomeClaimed
    const lapsed = reconcileSubscriptionBenefits(subscribed, false, false); // ads back, activated cleared
    expect(lapsed.settings.deepLifePlusWelcomeClaimed).toBe(true); // sticky persists
    const resubscribed = reconcileSubscriptionBenefits(lapsed, true, false);
    expect(resubscribed.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // still a single grant
    expect(resubscribed.settings.adsRemoved).toBe(true);
  });
});
