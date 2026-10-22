/**
 * ECO-5 (owner decision 2026-10-22): the $4.99 Premium Credit Card has no
 * in-game value until purchases can be paid by card, so:
 *   - no in-app shop surface sells it (an owner still sees it as Owned),
 *   - restore and entitlement handling keep working for existing buyers,
 *   - the free-standing "Charge" button (which bought nothing) is gone.
 */
import fs from 'fs';
import path from 'path';
import { CARD_PAYMENT_RAIL_LIVE, isPremiumCreditCardListed } from '@/lib/banking/cardPaymentRail';
import { IAP_PRODUCTS, NON_CONSUMABLE_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { OFFER_ROTATION } from '@/lib/offers/catalogue';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('ECO-5 - Premium Credit Card is off sale until the card rail exists', () => {
  it('the rail is not live, so a non-owner is never offered the card', () => {
    expect(CARD_PAYMENT_RAIL_LIVE).toBe(false);
    expect(isPremiumCreditCardListed(false)).toBe(false);
  });

  it('an existing owner still sees it (as owned)', () => {
    expect(isPremiumCreditCardListed(true)).toBe(true);
  });

  it('the gem shop lists the card only through the gate', () => {
    const src = read('components/GemShopModal.tsx');
    expect(src).toContain('isPremiumCreditCardListed(ownsPremiumCard)');
    // Exactly one listing site, and it is the gated one.
    expect(src.match(/id: IAP_PRODUCTS\.PREMIUM_CREDIT_CARD/g)?.length).toBe(1);
  });

  it('the Offer Center never rotates it in', () => {
    const ids = OFFER_ROTATION.map((o) => o.productId);
    expect(ids).not.toContain(IAP_PRODUCTS.PREMIUM_CREDIT_CARD);
  });

  it('restore and entitlement handling are untouched for existing buyers', () => {
    expect(NON_CONSUMABLE_PRODUCTS).toContain(IAP_PRODUCTS.PREMIUM_CREDIT_CARD);
    const config = getProductConfig(IAP_PRODUCTS.PREMIUM_CREDIT_CARD) as { premiumCreditCard?: boolean } | undefined;
    expect(config?.premiumCreditCard).toBe(true);
  });

  it('the bank app has no free-standing Charge button any more', () => {
    const src = read('components/computer/AdvancedBankApp.tsx');
    expect(src).not.toContain('spendOnCard');
    expect(src).not.toContain('Charge to card');
    expect(src).not.toMatch(/>Charge</);
  });
});
