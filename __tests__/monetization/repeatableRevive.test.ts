/**
 * The cash revive must survive being used.
 *
 * `revival_pack` is a NON-CONSUMABLE: Apple allows exactly one purchase per
 * Apple ID, ever, and a second attempt resolves as a restore that takes no
 * money and (deliberately) banks no charge. So the death screen hid the row
 * after one purchase - a permanent offer would have been a permanently dead
 * button. `deeplife_revive_now` is the CONSUMABLE that makes it repeatable.
 *
 * The properties worth pinning are the ones about money:
 *  - a consumable must never be re-granted by RESTORE (free revives),
 *  - buying while a charge is already banked must be impossible (the charge is
 *    a boolean, so the second purchase would take money and grant nothing),
 *  - the new SKU must not claim the OLD product's purchase record.
 */
import {
  IAP_PRODUCTS,
  CONSUMABLE_PRODUCTS,
  isConsumableProduct,
  isNonConsumableProduct,
  getProductConfig,
} from '@/utils/iapConfig';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/**
 * Comments explain why a thing is NOT done, so they contain the very
 * identifiers a "must not appear" assertion looks for. Strip them, or the test
 * fails on its own documentation - the same guard
 * `noNativeAlertInGameUI.test.ts` uses.
 */
const readCode = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the repeatable revive SKU', () => {
  it('is a consumable, so it can be bought again after every use', () => {
    expect(isConsumableProduct(IAP_PRODUCTS.REVIVE_NOW)).toBe(true);
    expect(CONSUMABLE_PRODUCTS).toContain(IAP_PRODUCTS.REVIVE_NOW);
  });

  it('is NOT a non-consumable - that is the whole distinction from the old pack', () => {
    expect(isNonConsumableProduct(IAP_PRODUCTS.REVIVE_NOW)).toBe(false);
    // The old pack stays exactly as it was: one purchase per account, restored.
    expect(isNonConsumableProduct(IAP_PRODUCTS.REVIVAL_PACK)).toBe(true);
  });

  it('is a distinct product id from the old pack', () => {
    // Reusing the id would inherit its Non-Consumable type and change nothing.
    expect(IAP_PRODUCTS.REVIVE_NOW).not.toBe(IAP_PRODUCTS.REVIVAL_PACK);
  });

  it('carries a priced config so the row can render before the catalog loads', () => {
    const config = getProductConfig(IAP_PRODUCTS.REVIVE_NOW);
    expect(config?.name).toBe('Revive Now');
    expect(config?.price).toBe('$2.99');
  });
});

describe('granting it cannot leak into the old product', () => {
  const service = () => read('services/IAPService.ts');

  it('banks the same charge reviveWithPack already spends', () => {
    const src = service();
    const branch = src.slice(
      src.indexOf('case IAP_PRODUCTS.REVIVE_NOW:'),
      src.indexOf('case IAP_PRODUCTS.REVIVAL_PACK:'),
    );
    expect(branch).toMatch(/gameState\.revivalPack = true/);
  });

  it('does NOT write the old pack’s purchase record', () => {
    // `settings.hasRevivalPack` is what marks the one-time pack Owned. Setting
    // it here would tell a player they own a product they never bought, and
    // retire its shop row for them.
    const src = readCode('services/IAPService.ts');
    const branch = src.slice(
      src.indexOf('case IAP_PRODUCTS.REVIVE_NOW:'),
      src.indexOf('case IAP_PRODUCTS.REVIVAL_PACK:'),
    );
    expect(branch).not.toMatch(/hasRevivalPack/);
  });
});

describe('the death screen offer', () => {
  const screen = () => read('components/DeathPopup.tsx');

  it('offers the repeatable SKU only when the store actually has it', () => {
    // Config knowing an id is not the same as the store selling it. Until the
    // product exists in App Store Connect the row must fall back to today's
    // behaviour rather than become an "Item Unavailable" button.
    const src = screen();
    expect(src).toMatch(/repeatableReviveAvailable = useMemo/);
    expect(src).toMatch(/p\?\.productId === IAP_PRODUCTS\.REVIVE_NOW/);
    expect(src).toMatch(/cashReviveProductId = repeatableReviveAvailable/);
  });

  it('hides the buy row while a charge is already banked', () => {
    // The charge is a boolean: a second purchase on top of an unspent one
    // would take the money and grant nothing.
    expect(screen()).toMatch(/showCashRevive =\s*\n?\s*!hasBankedRevive/);
  });

  it('keeps the once-per-account check for the OLD pack only', () => {
    // The repeatable SKU has no purchase limit, so gating it on
    // `hasRevivalPack` would wrongly retire it after one buy - the very bug
    // being fixed.
    expect(screen()).toMatch(/repeatableReviveAvailable \|\| !settings\.hasRevivalPack/);
  });

  it('buys whichever SKU was resolved, not a hardcoded one', () => {
    expect(screen()).toMatch(/bridgeToStore\('perks', cashReviveProductId\)/);
  });
});

describe('the shop tab', () => {
  const shopEntry = (from: string, to: string) => {
    const src = read('components/GemShopModal.tsx');
    const start = src.indexOf(from);
    expect(start).toBeGreaterThan(-1);
    // Search the end marker FORWARD from the start: several of these product
    // ids also appear earlier in the file (the `featured` array), and an end
    // index before the start silently yields an empty slice that passes any
    // `not.toMatch` and fails every `toMatch` for the wrong reason.
    const end = src.indexOf(to, start + from.length);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
  };

  it('locks the repeatable revive while a charge is banked', () => {
    // Same double-charge guard as the death screen, since the shop is the
    // other place it can be bought.
    const entry = shopEntry('id: IAP_PRODUCTS.REVIVE_NOW', 'id: IAP_PRODUCTS.REVIVAL_PACK');
    expect(entry).toMatch(/owned: revivalCharged/);
  });

  it('locks the OLD pack while a charge is banked too', () => {
    // Both products bank the SAME boolean charge. Guarding the old card on
    // `hasRevivalPack` alone left it enabled for someone who bought Revive Now
    // - they hold a charge but no purchase record - so it would have taken
    // $2.99 for a charge they already had. Codex review of #174.
    const entry = shopEntry('id: IAP_PRODUCTS.REVIVAL_PACK', 'id: IAP_PRODUCTS.LIFETIME_PREMIUM');
    expect(entry).toMatch(/owned: settings\?\.hasRevivalPack === true \|\| revivalCharged/);
  });
});

describe('the purchase path reserves before granting', () => {
  it('treats the repeatable revive as a NON-idempotent grant', () => {
    // `isNonIdempotentGrant` drives the reserve-before-grant ledger write.
    // Omitting this SKU let a failed ledger write grant with no dedupe record,
    // so a store replay (the store redelivers unfinished transactions) could
    // re-bank a revive the player had already spent. Being a consumable is not
    // an exemption - it banks the same one-shot charge. Codex review of #174.
    const src = read('services/IAPService.ts');
    const fn = src.slice(
      src.indexOf('function isNonIdempotentGrant'),
      src.indexOf('export class IAPService'),
    );
    expect(fn).toMatch(/productId === IAP_PRODUCTS\.REVIVE_NOW/);
    // The two that were already gated must stay gated.
    expect(fn).toMatch(/productId === IAP_PRODUCTS\.REVIVAL_PACK/);
    expect(fn).toMatch(/isSubscriptionProduct\(productId\)/);
  });
});

describe('the owner still has to create the product', () => {
  it('is documented as an owner action with its type spelled out', () => {
    const doc = read('docs/IAP-SETUP.md');
    expect(doc).toMatch(/deeplife_revive_now/);
    expect(doc).toMatch(/Owner action required/i);
    expect(doc).toMatch(/Consumable/);
  });
});
