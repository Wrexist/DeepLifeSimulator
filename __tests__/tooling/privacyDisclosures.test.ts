import { readFileSync } from 'fs';
import { join } from 'path';

// Factual drift guard, not legal or dashboard certification.
it('discloses the purchase, advertising and analytics providers enabled for production', () => {
  const root = join(__dirname, '../..');
  const env = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8')).build.production.env;
  const policy = readFileSync(join(root, 'support-site/privacy.html'), 'utf8').replace(/<[^>]+>/g, ' ');
  if (env.EXPO_PUBLIC_USE_REVENUECAT === 'true') expect(policy).toContain('RevenueCat');
  if (env.EXPO_PUBLIC_ENABLE_FIREBASE === 'true') {
    expect(policy).toContain('Firebase Analytics');
    expect(policy).not.toMatch(/not\s+use Firebase/);
  }
  if (env.EXPO_PUBLIC_ENABLE_ADMOB === 'true') {
    expect(policy).toContain('Google AdMob');
    expect(policy).not.toMatch(/AdMob[^.\n]*currently disabled/);
  }
  expect(policy).toContain('Consumable balances are not automatically replayed after reinstall');
});
