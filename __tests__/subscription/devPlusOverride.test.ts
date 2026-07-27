/**
 * The dev-only DeepLife+ override, and the guarantee that it cannot ship.
 *
 * It exists because the selfie route into the face creator is a DeepLife+
 * surface: without it, one of the three character-customization systems can
 * only be exercised by actually buying the subscription, so it never gets
 * tested.
 *
 * That is a paywall bypass, so the thing worth testing is not that it works —
 * it is that it CANNOT work in a release build. Two independent gates, and this
 * asserts both, including the one a test cannot observe at runtime.
 */
import * as fs from 'fs';
import * as path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'lib', 'subscription', 'deepLifePlus.ts'),
  'utf8',
);

describe('the override cannot reach production', () => {
  it('is guarded by __DEV__, which Metro strips from a release build', () => {
    // Asserted on the SOURCE because `__DEV__` is a compile-time constant: a
    // test running in dev cannot observe the release behaviour by calling the
    // function. What can be checked is that the guard is present and is the
    // FIRST condition, so the env var alone never grants anything.
    expect(SOURCE).toMatch(/if \(__DEV__ && process\.env\.EXPO_PUBLIC_FORCE_DEEPLIFE_PLUS === 'true'\) return true;/);
  });

  it('needs the env var too, so ordinary dev runs still see the paywall', () => {
    // Without this, every developer would silently be a subscriber and the free
    // player's path — the one most people are on — would stop being exercised.
    const line = SOURCE.match(/if \(__DEV__ &&[^\n]*/)?.[0] ?? '';
    expect(line).toContain('EXPO_PUBLIC_FORCE_DEEPLIFE_PLUS');
    expect(line).toContain("=== 'true'");
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
    delete process.env.EXPO_PUBLIC_FORCE_DEEPLIFE_PLUS;
    jest.resetModules();
    jest.doMock('@/services/SubscriptionService', () => ({
      subscriptionService: { hasPremiumAccess: () => false },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/subscription/deepLifePlus');
    expect(mod.isDeepLifePlusActive()).toBe(false);
  });
});
