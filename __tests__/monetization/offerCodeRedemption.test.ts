/**
 * App Review guideline 3.1.1 - how a redeem code is allowed to work.
 *
 * The old feature shipped a salted-hash table in the binary and GRANTED IAP
 * products from a typed code, which is unlocking functionality outside of
 * In-App Purchase. Apple rejected v1.5.0 for it and it was removed.
 *
 * The sanctioned replacement presents APPLE's own offer-code sheet: codes are
 * created in App Store Connect against a real IAP/subscription, Apple
 * validates them, and the product arrives as an ordinary StoreKit transaction
 * that the existing purchase listener fulfils. These tests pin the property
 * that makes it compliant - the app itself grants NOTHING from a code - so a
 * future change cannot quietly reintroduce a self-granting path.
 */
import * as fs from 'fs';
import * as path from 'path';

const repo = (...p: string[]) => path.join(__dirname, '..', '..', ...p);
const read = (...p: string[]) => fs.readFileSync(repo(...p), 'utf8');

describe('the removed self-granting promo-code feature stays removed', () => {
  it('ships no redeem-code engine or modal', () => {
    expect(fs.existsSync(repo('utils/redeemCodes.ts'))).toBe(false);
    expect(fs.existsSync(repo('components/RedeemCodeModal.tsx'))).toBe(false);
  });

  it('ships no salted code-hash table anywhere in app code', () => {
    // The violation's signature: a shipped table mapping code hashes to
    // products. Scanned across the source roots a bundle is built from.
    const roots = ['app', 'components', 'contexts', 'lib', 'services', 'utils', 'hooks', 'src'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        const src = fs.readFileSync(full, 'utf8');
        if (/REDEEM_HASHES|REDEEM_SALT|lookupRedeemCode|applyRedeemReward/.test(src)) {
          offenders.push(path.relative(repo(), full));
        }
      }
    };
    roots.forEach((r) => walk(repo(r)));
    expect(offenders).toEqual([]);
  });
});

describe('the replacement hands the code to Apple and grants nothing itself', () => {
  const settings = read('components/SettingsModal.tsx');
  const service = read('services/IAPService.ts');
  const adapter = read('services/expoIapAdapter.ts');

  it('the Settings row calls the redemption sheet, not a grant', () => {
    expect(settings).toMatch(/handleRedeemOfferCode/);
    expect(settings).toMatch(/iapService\.presentCodeRedemptionSheet\(\)/);
  });

  it('the handler applies no product benefits and touches no game state', () => {
    const start = settings.indexOf('const handleRedeemOfferCode');
    const body = settings.slice(start, settings.indexOf('const showRewardAnimation', start));
    expect(body.length).toBeGreaterThan(100); // the slice really found the body
    // Any of these inside the handler would be a 3.1.1 violation again.
    expect(body).not.toMatch(/applyProductBenefitsToState|setGameState|updateMoney|stats\.gems/);
  });

  it('the service delegates to the native sheet and returns a boolean', () => {
    const start = service.indexOf('async presentCodeRedemptionSheet()');
    expect(start).toBeGreaterThan(-1);
    const body = service.slice(start, start + 900);
    expect(body).toMatch(/presentCodeRedemptionSheetAsync/);
    expect(body).not.toMatch(/applyBenefit|applyProductBenefitsToState/);
  });

  it('the adapter calls Apple StoreKit and is iOS-guarded', () => {
    const start = adapter.indexOf('export async function presentCodeRedemptionSheetAsync');
    expect(start).toBeGreaterThan(-1);
    const body = adapter.slice(start, start + 700);
    expect(body).toMatch(/Platform\.OS !== 'ios'/);
    expect(body).toMatch(/presentCodeRedemptionSheetIOS/);
  });
});
