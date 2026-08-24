/**
 * Premium access resolves from EITHER route: an active auto-renewing
 * subscription OR the one-time "lifetime" unlock (a non-consumable tracked in
 * the IAP purchase ledger). Every premium gate reads
 * subscriptionService.hasPremiumAccess(), so this locks in that both routes
 * grant access and neither is required.
 */
import { subscriptionService } from '@/services/SubscriptionService';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';

describe('SubscriptionService - premium access (subscription OR lifetime)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is false for a free player with no lifetime unlock', () => {
    jest.spyOn(iapService, 'hasPurchased').mockReturnValue(false);
    jest.spyOn(subscriptionService, 'getSubscriptionTier').mockReturnValue('free');
    expect(subscriptionService.hasLifetimePremium()).toBe(false);
    expect(subscriptionService.hasPremiumAccess()).toBe(false);
  });

  it('is true when the one-time lifetime unlock is owned (no subscription)', () => {
    jest
      .spyOn(iapService, 'hasPurchased')
      .mockImplementation((id: string) => id === IAP_PRODUCTS.LIFETIME_PREMIUM);
    jest.spyOn(subscriptionService, 'getSubscriptionTier').mockReturnValue('free');
    expect(subscriptionService.hasLifetimePremium()).toBe(true);
    expect(subscriptionService.hasPremiumAccess()).toBe(true);
  });

  it('is true when a premium subscription is active (no lifetime unlock)', () => {
    jest.spyOn(iapService, 'hasPurchased').mockReturnValue(false);
    jest.spyOn(subscriptionService, 'getSubscriptionTier').mockReturnValue('premium');
    expect(subscriptionService.hasLifetimePremium()).toBe(false);
    expect(subscriptionService.hasPremiumAccess()).toBe(true);
  });
});
