/**
 * Guideline 3.1.2: a subscription app needs a Terms of Use (EULA) link and a
 * privacy policy link in its store metadata. 1.6.0 lost the EULA link when its
 * description was synced from marketing/aso/metadata.mjs, which never had it.
 * The store copy and the in-app paywall must point at the SAME two URLs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/config/appConfig';

type Copy = { description?: string; shipped?: boolean };

describe('store legal links', () => {
  let APPLE: Copy & { localized?: Record<string, Copy> };
  beforeAll(async () => {
    ({ APPLE } = (await import('../../marketing/aso/metadata.mjs')) as { APPLE: typeof APPLE });
  });

  it('every shipped store description links the in-app Terms and Privacy URLs', () => {
    const copies: [string, Copy][] = [['en-US', APPLE], ...Object.entries(APPLE.localized ?? {})];
    const shipped = copies.filter(([, c]) => c.shipped !== false && c.description);
    expect(shipped.length).toBeGreaterThanOrEqual(5);
    for (const [, c] of shipped) {
      expect(c.description).toContain(TERMS_OF_USE_URL);
      expect(c.description).toContain(PRIVACY_POLICY_URL);
    }
  });

  it('check-aso enforces the same two URLs the app uses', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../scripts/check-aso.mjs'), 'utf8');
    expect(src).toContain(TERMS_OF_USE_URL);
    expect(src).toContain(PRIVACY_POLICY_URL);
  });
});
