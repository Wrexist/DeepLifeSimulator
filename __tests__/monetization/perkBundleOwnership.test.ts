/**
 * "Unlock All Perks" claimed to be owned when it wasn't — and was unbuyable.
 *
 * The bundle grants FOUR perks (`applyProductBenefitsToState`: workBoost,
 * mindset, fastLearner, goodCredit) but `GemShopModal`'s owned-check tested
 * only three, omitting `mindset` — while the Mindset row two entries below in
 * the same array reads that very field.
 *
 * So a player who had bought Work Pay Boost, Fast Learner and Good Credit
 * individually saw the $6.99 bundle labelled **Owned** with a greyed-out,
 * untappable button (`ShopItemCard`: `buttonDisabled = owned || locked ||
 * !onPress`). The store stated they owned all perks when they did not, and the
 * cheapest route to Mindset could not be purchased at all.
 * 2026-07-30 audit UX-2.
 *
 * This pins the RULE — the owned-check must cover exactly what the bundle
 * grants — rather than the component, so the two cannot drift apart again.
 */
import fs from 'fs';
import path from 'path';
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Perk flags `applyProductBenefitsToState` sets for the allPerks bundle. */
function perksGrantedByBundle(): string[] {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'services/IAPService.ts'), 'utf8');
  const block = source.match(/if \('allPerks' in config && config\.allPerks\) \{([\s\S]*?)\n {2}\}/);
  expect(block).toBeTruthy();
  return Array.from(block![1].matchAll(/gameState\.perks\.(\w+)\s*=\s*true/g)).map((m) => m[1]);
}

/** Perk flags the shop's `allPerksOwned` check reads. */
function perksCheckedByShop(): string[] {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'components/GemShopModal.tsx'), 'utf8');
  const decl = source.match(/const allPerksOwned = Boolean\(([\s\S]*?)\);/);
  expect(decl).toBeTruthy();
  return Array.from(decl![1].matchAll(/perks\?\.(\w+)/g)).map((m) => m[1]);
}

describe('the bundle really is a bundle', () => {
  it('is a configured product with the allPerks flag', () => {
    const config = getProductConfig(IAP_PRODUCTS.UNLOCK_ALL_PERKS);

    expect(config).toBeTruthy();
    expect((config as { allPerks?: boolean }).allPerks).toBe(true);
  });

  it('grants more than one perk (guards the comparison below)', () => {
    // Without this, a regex that matched nothing would make the set comparison
    // trivially true on two empty lists.
    expect(perksGrantedByBundle().length).toBeGreaterThan(1);
  });
});

describe('the owned-check covers exactly what the bundle grants', () => {
  it('checks every perk the bundle sets', () => {
    const granted = perksGrantedByBundle().filter((p) => p !== 'unlockAllPerks');
    const checked = perksCheckedByShop();

    // The finding: `mindset` was granted but not checked.
    for (const perk of granted) {
      expect(checked).toContain(perk);
    }
  });

  it('checks mindset specifically', () => {
    expect(perksCheckedByShop()).toContain('mindset');
  });

  it('does not check a perk the bundle never grants', () => {
    // The other direction: an over-broad check would mark the bundle unowned
    // forever and never let the player see it as complete.
    const granted = perksGrantedByBundle();

    for (const perk of perksCheckedByShop()) {
      expect(granted).toContain(perk);
    }
  });
});
