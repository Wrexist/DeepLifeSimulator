/**
 * R4-MON-5 — "Everything Unlocked" did not unlock everything.
 *
 * `GEMS_MEGA` is the most expensive product in the store at $99.99, described as
 * "40,000 Gems + Unlimited Youth Pills + Everything Unlocked". Its
 * `everythingUnlocked` branch in `applyProductBenefitsToState` set `adsRemoved`,
 * `lifetimePremium` and the nine gold upgrades, and nothing else. It did not
 * grant the four perks (sold as UNLOCK_ALL_PERKS, $6.99), and it could not grant
 * the four banking entitlements at all — those were written only from a
 * `switch (productId)`, and the Mega Pack's id is GEMS_MEGA:
 *
 *   premiumCreditCard $4.99 · financialPlanning $2.99 ·
 *   businessBanking   $3.99 · privateBanking    $9.99
 *
 * About $28 of separately-sold entitlements, missing from the bundle that says
 * it contains everything.
 *
 * The expansion lives in `getProductConfig` rather than in the fulfilment
 * branch on purpose: `persistPermanentPerks` keys off `config.allPerks` and is
 * what makes perks survive a slot change, and the restore path reads the same
 * config. Patching only the state-apply branch would have granted the perks in
 * memory and lost them on the next slot swap. 2026-07-31 audit round 4.
 */
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';
import { applyProductBenefitsToState } from '@/services/IAPService';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * The restore half, found by an adversarial pass over the fix above.
 *
 * The expansion put permanent entitlements on a product that is (correctly) a
 * CONSUMABLE — `GEMS_MEGA` grants 40,000 gems, and a restore must never
 * re-credit currency. Both restore loops therefore skipped it wholesale, which
 * was right while consumables carried nothing but quantities and stopped being
 * right the moment this product started carrying unlocks.
 *
 * Net effect before this: buy the $99.99 Mega Pack, reinstall, tap Restore
 * Purchases — nothing comes back. Buy the same entitlements a la carte for
 * $28 and they restore fine. Skipping the whole product was the wrong
 * granularity; the product is mixed, so the restore has to be too.
 */
import { hasPermanentEntitlements, isConsumableProduct } from '@/utils/iapConfig';

/** Every entitlement the store sells separately and the bundle claims to include. */
const SEPARATELY_SOLD = [
  { flag: 'premiumCreditCard', product: IAP_PRODUCTS.PREMIUM_CREDIT_CARD },
  { flag: 'financialPlanning', product: IAP_PRODUCTS.FINANCIAL_PLANNING },
  { flag: 'businessBanking', product: IAP_PRODUCTS.BUSINESS_BANKING },
  { flag: 'privateBanking', product: IAP_PRODUCTS.PRIVATE_BANKING },
] as const;

function applied(productId: string): GameState {
  const state = createTestGameState();
  const config = getProductConfig(productId);
  if (!config) throw new Error(`no product config for ${productId}`);
  applyProductBenefitsToState(state, config, productId);
  return state;
}

describe('the Mega Pack config carries what its name promises', () => {
  it('the product really is the everything-unlocked bundle (the premise)', () => {
    const config = getProductConfig(IAP_PRODUCTS.GEMS_MEGA);

    expect(config).toBeTruthy();
    expect((config as { everythingUnlocked?: boolean }).everythingUnlocked).toBe(true);
    expect((config as { description?: string }).description).toMatch(/Everything Unlocked/i);
  });

  it('implies allPerks, so the perks reach the cross-slot store too', () => {
    // `persistPermanentPerks` reads `config.allPerks`. Without it the perks
    // would exist only in the current save and vanish on a slot change.
    expect((getProductConfig(IAP_PRODUCTS.GEMS_MEGA) as { allPerks?: boolean }).allPerks).toBe(true);
  });

  it('implies every separately-sold banking entitlement', () => {
    const config = getProductConfig(IAP_PRODUCTS.GEMS_MEGA) as Record<string, unknown>;

    for (const { flag } of SEPARATELY_SOLD) {
      expect(`${flag}: ${config[flag]}`).toBe(`${flag}: true`);
    }
  });

  it('does not leak the implications onto other products', () => {
    // The control: a gem pack must not silently become the mega bundle.
    const small = getProductConfig(IAP_PRODUCTS.GEMS_100) as Record<string, unknown>;

    expect(small.allPerks).toBeUndefined();
    expect(small.privateBanking).toBeUndefined();
  });
});

describe('buying the Mega Pack grants what the config promises', () => {
  it('sets all four perks and the unlock-all marker', () => {
    const state = applied(IAP_PRODUCTS.GEMS_MEGA);

    expect(state.perks?.workBoost).toBe(true);
    expect(state.perks?.mindset).toBe(true);
    expect(state.perks?.fastLearner).toBe(true);
    expect(state.perks?.goodCredit).toBe(true);
    expect(state.perks?.unlockAllPerks).toBe(true);
  });

  it('sets all four banking entitlements', () => {
    const state = applied(IAP_PRODUCTS.GEMS_MEGA);
    const settings = state.settings as unknown as Record<string, unknown>;

    for (const { flag } of SEPARATELY_SOLD) {
      expect(`${flag}: ${settings[flag]}`).toBe(`${flag}: true`);
    }
  });

  it('still grants everything it already granted', () => {
    // The regression guard: the expansion must be purely additive.
    const state = applied(IAP_PRODUCTS.GEMS_MEGA);

    expect(state.settings?.everythingUnlocked).toBe(true);
    expect(state.settings?.adsRemoved).toBe(true);
    expect(state.settings?.lifetimePremium).toBe(true);
    expect(state.settings?.unlimitedYouthPills).toBe(true);
    expect(state.goldUpgrades?.chronomaster).toBe(true);
    expect(state.stats.gems).toBeGreaterThanOrEqual(40_000);
  });

  it('buying a single banking product still works on its own', () => {
    // The other control: the flag-driven writes must not have displaced the
    // per-product switch that single purchases go through.
    for (const { flag, product } of SEPARATELY_SOLD) {
      const settings = applied(product).settings as unknown as Record<string, unknown>;

      expect(`${flag} from its own product: ${settings[flag]}`).toBe(`${flag} from its own product: true`);
    }
  });

  it('a gem pack grants no entitlements (the negative control)', () => {
    const state = applied(IAP_PRODUCTS.GEMS_100);

    expect(state.settings?.privateBanking).toBeFalsy();
    expect(state.perks?.unlockAllPerks).toBeFalsy();
    expect(state.settings?.everythingUnlocked).toBeFalsy();
  });
});

describe('a mixed product restores its permanent half and nothing else', () => {
  it('the Mega Pack really is a consumable (the premise)', () => {
    // This is why restore skipped it, and it must STAY a consumable - the
    // 40,000 gems are the reason.
    expect(isConsumableProduct(IAP_PRODUCTS.GEMS_MEGA)).toBe(true);
  });

  it('and is recognised as carrying permanent entitlements', () => {
    expect(hasPermanentEntitlements(IAP_PRODUCTS.GEMS_MEGA)).toBe(true);
  });

  it('a pure gem pack carries none (the control)', () => {
    // If this were true for every consumable, restore would re-credit currency
    // - the exact thing the consumable skip exists to prevent.
    for (const id of [IAP_PRODUCTS.GEMS_100, IAP_PRODUCTS.GEMS_1000, IAP_PRODUCTS.YOUTH_PILL_SINGLE]) {
      expect(`${id}: ${hasPermanentEntitlements(id)}`).toBe(`${id}: false`);
    }
  });

  it('entitlementsOnly grants every unlock', () => {
    const state = createTestGameState();
    const config = getProductConfig(IAP_PRODUCTS.GEMS_MEGA)!;

    applyProductBenefitsToState(state, config, IAP_PRODUCTS.GEMS_MEGA, { entitlementsOnly: true });

    expect(state.perks?.unlockAllPerks).toBe(true);
    expect(state.settings?.privateBanking).toBe(true);
    expect(state.settings?.everythingUnlocked).toBe(true);
    expect(state.settings?.adsRemoved).toBe(true);
    expect(state.settings?.lifetimePremium).toBe(true);
    expect(state.goldUpgrades?.chronomaster).toBe(true);
  });

  it('entitlementsOnly grants NO currency - the whole reason restore skipped it', () => {
    const before = createTestGameState();
    const state = createTestGameState();
    const config = getProductConfig(IAP_PRODUCTS.GEMS_MEGA)!;

    applyProductBenefitsToState(state, config, IAP_PRODUCTS.GEMS_MEGA, { entitlementsOnly: true });

    expect(state.stats.gems).toBe(before.stats.gems);
    expect(state.stats.money).toBe(before.stats.money);
  });

  it('a normal PURCHASE still grants the currency (the control)', () => {
    const state = createTestGameState();
    const config = getProductConfig(IAP_PRODUCTS.GEMS_MEGA)!;

    applyProductBenefitsToState(state, config, IAP_PRODUCTS.GEMS_MEGA);

    expect(state.stats.gems).toBeGreaterThanOrEqual(40_000);
  });

  it('both restore loops let a mixed product through', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'IAPService.ts'), 'utf8',
    );

    const guards = src.match(/isConsumableProduct\(productId\) && !hasPermanentEntitlements\(productId\)/g) ?? [];
    expect(guards).toHaveLength(2);
    // And each passes the flag when applying, so the quantities stay skipped.
    expect(src).toMatch(/isConsumableProduct\(productId\)\)\) restoredCount\+\+;/);
    expect(src).toMatch(/isConsumableProduct\(purchase\.productId\),/);
  });
});
