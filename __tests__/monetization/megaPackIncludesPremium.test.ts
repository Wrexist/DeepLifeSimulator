/**
 * D14 (2026-10-23) - the Mega Pack includes lifetime DeepLife+ premium, and
 * both the paywall and the pack's own copy must say so.
 *
 * The claim on the copy is only allowed because the grant is real: this suite
 * proves it from the grant function itself, so the copy cannot outlive it.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { applyProductBenefitsToState } from '@/services/IAPService';
import { IAP_PRODUCTS, getProductConfig, PRODUCT_DISPLAY_META } from '@/utils/iapConfig';
import {
  hasDeepLifePlusEntitlement,
  permanentPremiumSource,
} from '@/lib/subscription/deepLifePlus';

describe('Mega Pack includes lifetime DeepLife+ premium', () => {
  it('the purchase grant writes lifetimePremium (the premise of the copy)', () => {
    const state = createTestGameState();
    const config = getProductConfig(IAP_PRODUCTS.GEMS_MEGA);
    if (!config) throw new Error('no Mega Pack config');
    applyProductBenefitsToState(state, config, IAP_PRODUCTS.GEMS_MEGA);
    expect(state.settings.lifetimePremium).toBe(true);
    expect(hasDeepLifePlusEntitlement(state.settings)).toBe(true);
    expect(permanentPremiumSource(state.settings)).toBe('mega_pack');
  });

  it('the store copy names it', () => {
    expect(getProductConfig(IAP_PRODUCTS.GEMS_MEGA)?.description).toMatch(/lifetime DeepLife\+ premium/);
    expect(PRODUCT_DISPLAY_META[IAP_PRODUCTS.GEMS_MEGA]?.contents).toContain('Lifetime DeepLife+ premium');
  });

  it('permanentPremiumSource credits the pack before the lifetime product', () => {
    expect(permanentPremiumSource({ everythingUnlocked: true, lifetimePremium: true })).toBe('mega_pack');
    expect(permanentPremiumSource({ lifetimePremium: true })).toBe('lifetime');
    expect(permanentPremiumSource({})).toBeNull();
    expect(permanentPremiumSource(undefined)).toBeNull();
  });
});
