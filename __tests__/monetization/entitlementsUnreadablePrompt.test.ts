/**
 * A paying player whose entitlements cannot be read gets OFFERED a restore.
 *
 * ── The gap this closes ───────────────────────────────────────────────────
 *
 * `IAPService.loadPermanentPerks` already tells the two cases apart precisely,
 * and its own comment says why it bothers:
 *
 *   "an ABSENT envelope genuinely means no purchases, but a PRESENT one that
 *    will not verify means the entitlements are intact and unreadable — a key
 *    change, not an empty account. Fail closed either way, but record the
 *    difference so the app can offer a restore instead of silently presenting a
 *    paying player as never having bought anything."
 *
 * It set `entitlementsUnreadable`, persisted a marker — and **nothing anywhere
 * read either one**. The detection shipped; the offer did not. So the player
 * who had paid got silence, and an app that behaved as though they never had.
 *
 * This is not hypothetical: changing `EXPO_PUBLIC_SAVE_HMAC_KEY` invalidates
 * every entitlement envelope on every device at once, and it happened.
 */
import { IAPService } from '@/services/IAPService';

const read = (file: string) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  return fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
};

describe('the signal exists and is reachable', () => {
  it('exposes the flag as a static the UI can await', () => {
    expect(typeof IAPService.areEntitlementsUnreadable).toBe('function');
    expect(typeof IAPService.clearEntitlementsUnreadable).toBe('function');
  });

  it('an unreadable envelope is NOT the same as no purchases', () => {
    // The distinction the whole fix rests on: fail closed, but remember why.
    const service = read('services/IAPService.ts');
    expect(service).toMatch(/entitlementsUnreadable = true/);
    expect(service).toMatch(/ENTITLEMENTS_UNREADABLE_KEY/);
  });
});

describe('something actually consumes it now', () => {
  const handler = () => read('components/IAPHandler.tsx');

  it('IAPHandler checks the flag', () => {
    expect(handler()).toMatch(/IAPService\.areEntitlementsUnreadable\(\)/);
  });

  it('and offers a restore rather than only logging it', () => {
    const src = handler();
    expect(src).toMatch(/Alert\.alert\(/);
    expect(src).toMatch(/restorePurchases\(\)/);
  });

  it('clears the marker only after a restore that SUCCEEDED', () => {
    // Clearing unconditionally would silence the prompt for a player whose
    // restore failed — the exact person who still needs it next launch.
    const src = handler();
    const clearAt = src.indexOf('IAPService.clearEntitlementsUnreadable()');
    const successAt = src.indexOf('if (success)');
    expect(clearAt).toBeGreaterThan(-1);
    expect(successAt).toBeGreaterThan(-1);
    expect(clearAt).toBeGreaterThan(successAt);
  });

  it('never lets the prompt crash the app', () => {
    // It runs inside the provider tree on mount; an unhandled rejection here
    // would take down a boundary for a purely diagnostic feature.
    expect(handler()).toMatch(/catch \(error\)[\s\S]{0,200}entitlement readability check failed/);
  });

  it('is mounted app-wide, not on one screen', () => {
    // GameProvider renders it once, so the offer reaches the player wherever
    // they resume rather than only if they happen to open Settings.
    expect(read('contexts/game/GameProvider.tsx')).toMatch(/<IAPHandler \/>/);
  });
});
