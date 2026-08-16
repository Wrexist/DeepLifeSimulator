/**
 * Native-SDK feature flags must be OPT-IN (CLAUDE.md §4.6).
 *
 * `iap` and `att` used to read `!== 'false'`, i.e. ON unless a profile went out
 * of its way to switch them off. The `preview` and `development` profiles in
 * eas.json name neither variable, so an internal build armed StoreKit and fired
 * the one-shot ATT prompt with no products and no ad integration behind them.
 *
 * This pins the truth table the fix establishes: production = on (because it
 * sets the vars explicitly), every other profile = off. It reads eas.json
 * rather than restating it, so a profile that later drops the explicit "true"
 * fails here instead of on TestFlight.
 */
import easJson from '../../eas.json';

type ProfileEnv = Record<string, string>;

function loadFlags(env: ProfileEnv) {
  let flags: Record<string, boolean>;
  jest.isolateModules(() => {
    const prev = { ...process.env };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('EXPO_PUBLIC_')) delete process.env[key];
    }
    Object.assign(process.env, env);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      flags = require('@/lib/config/featureFlags').FEATURE_FLAGS;
      flags = { ...flags };
    } finally {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('EXPO_PUBLIC_')) delete process.env[key];
      }
      Object.assign(process.env, prev);
    }
  });
  return flags!;
}

const profiles = (easJson as { build: Record<string, { env?: ProfileEnv }> }).build;

describe('native SDK feature flag defaults', () => {
  it('production turns IAP, ATT and AdMob on — explicitly, not by default', () => {
    const env = profiles.production.env ?? {};
    // The explicit "true" is the load-bearing part: with the opt-in form, an
    // absent var means OFF, so production must never rely on a default.
    expect(env.EXPO_PUBLIC_ENABLE_IAP).toBe('true');
    expect(env.EXPO_PUBLIC_ENABLE_ATT).toBe('true');
    expect(env.EXPO_PUBLIC_ENABLE_ADMOB).toBe('true');
    expect(env.EXPO_PUBLIC_BORING_BUILD).toBe('false');

    const flags = loadFlags(env);
    expect(flags.iap).toBe(true);
    expect(flags.att).toBe(true);
    expect(flags.adMob).toBe(true);
  });

  it.each(['preview', 'development'])('%s leaves every native SDK off', (name) => {
    const flags = loadFlags(profiles[name].env ?? {});
    expect(flags.iap).toBe(false);
    expect(flags.att).toBe(false);
    expect(flags.adMob).toBe(false);
    expect(flags.firebaseAnalytics).toBe(false);
    expect(flags.revenueCat).toBe(false);
  });

  it('preview runs the Boring Build baseline', () => {
    expect(profiles.preview.env?.EXPO_PUBLIC_BORING_BUILD).toBe('true');
  });

  it('an unset variable means OFF, not on (the opt-in rule)', () => {
    const flags = loadFlags({ EXPO_PUBLIC_BORING_BUILD: 'false' });
    expect(flags.iap).toBe(false);
    expect(flags.att).toBe(false);
  });

  it('drops the notifications flag — expo-notifications is a no-op stub', () => {
    const flags = loadFlags({ EXPO_PUBLIC_BORING_BUILD: 'false' });
    expect('notifications' in flags).toBe(false);
  });
});
