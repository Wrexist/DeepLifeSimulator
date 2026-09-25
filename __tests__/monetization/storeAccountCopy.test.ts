/**
 * Restore Purchases names the right account on each store.
 *
 * Found by running the Android release build: an empty restore told the player
 * to check "this Apple ID". Purchases on Android belong to the Google account
 * signed into Google Play, and the player reading that alert is the one who
 * most needs to be pointed at the right account.
 */
import fs from 'fs';
import path from 'path';
import { nothingToRestoreMessage, storeAccountName } from '@/lib/shop/storeAccount';

describe('storeAccountName', () => {
  it('is the Google account on Android', () => {
    expect(storeAccountName('android')).toBe('Google account');
  });

  it('is the Apple ID on iOS', () => {
    expect(storeAccountName('ios')).toBe('Apple ID');
  });
});

describe('nothingToRestoreMessage', () => {
  it('never mentions Apple on Android', () => {
    const message = nothingToRestoreMessage('android');
    expect(message).toContain('this Google account');
    expect(message).not.toMatch(/apple/i);
  });

  it('keeps the iOS wording', () => {
    expect(nothingToRestoreMessage('ios')).toContain('this Apple ID');
  });
});

describe('both restore surfaces use it', () => {
  // The alert lives in two components. A hard-coded copy in either one is the
  // regression this guards: one screen fixed, the other still saying Apple ID.
  it.each(['components/GemShopModal.tsx', 'components/SettingsModal.tsx'])('%s', (file) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
    expect(source).toContain('nothingToRestoreMessage(Platform.OS)');
    expect(source).not.toContain('found for this Apple ID');
  });
});
