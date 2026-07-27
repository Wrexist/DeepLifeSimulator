/**
 * The dev-only DeepLife+ override, and the guarantee that it cannot ship.
 *
 * It exists because the selfie route into the face creator is a DeepLife+
 * surface: without it, one of the three character-customization systems can
 * only be exercised by actually buying the subscription, so it never gets
 * tested.
 *
 * That is a paywall bypass. The first version guarded it with `__DEV__` — which
 * is compile-time false on TestFlight, so it protected the flag right out of
 * the builds it was for. The guard is now the BUILD PROFILE, checked by
 * `scripts/lib/qaTools.js` before every build; this file covers the override
 * itself, and `__tests__/build/qaTools.test.ts` covers what keeps it out of the
 * store.
 */
import * as fs from 'fs';
import * as path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'lib', 'subscription', 'deepLifePlus.ts'),
  'utf8',
);

describe('the override is opt-in only', () => {
  it('fires on an exact EXPO_PUBLIC_QA_TOOLS=true and nothing else', () => {
    // NOT gated on `__DEV__`, deliberately: TestFlight is a release build, so a
    // `__DEV__` guard makes the paid route untestable on the builds testing
    // actually happens on. The protection is the build profile plus
    // `scripts/lib/qaTools.js`, covered in `__tests__/build/qaTools.test.ts`.
    expect(SOURCE).toMatch(/if \(process\.env\.EXPO_PUBLIC_QA_TOOLS === 'true'\) return true;/);
  });

  it('does not fall back to any looser check', () => {
    // A truthiness test would fire on 'false', which is how a flag meant to be
    // off ends up on.
    const fn = SOURCE.slice(SOURCE.indexOf('export function isDeepLifePlusActive'));
    const code = fn.slice(0, fn.indexOf('\n}'))
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/if \(process\.env\.EXPO_PUBLIC_QA_TOOLS\)/);
    expect(code).not.toMatch(/!==\s*'false'/);
  });

  it('does not touch the entitlement record itself', () => {
    // The override answers the QUESTION "is plus active" and must not write to
    // the subscription service, or a dev run could leave a fake purchase behind
    // in storage that outlives the flag.
    const fn = SOURCE.slice(SOURCE.indexOf('export function isDeepLifePlusActive'));
    // Comments stripped first. The first version of this assertion matched the
    // word "set" in this function's own explanatory comment and failed on
    // prose — a test reading documentation instead of code.
    const code = fn.slice(0, fn.indexOf('\n}'))
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/\b(set|grant|activate|save|write)[A-Za-z]*\s*\(/i);
    expect(code).toMatch(/subscriptionService\.hasPremiumAccess\(\)/);
  });
});

describe('the real entitlement is still the default answer', () => {
  it('falls through to the subscription service', () => {
    // With the env var unset — which is how every test in this suite runs, and
    // how every build that is not explicitly opted in runs — the function is
    // exactly what it was before the override existed.
    delete process.env.EXPO_PUBLIC_QA_TOOLS;
    jest.resetModules();
    jest.doMock('@/services/SubscriptionService', () => ({
      subscriptionService: { hasPremiumAccess: () => false },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/subscription/deepLifePlus');
    expect(mod.isDeepLifePlusActive()).toBe(false);
  });
});
