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

  // `cloudSave` is the one flag that is deliberately NOT a native SDK and
  // therefore deliberately NOT gated on Boring Build. The rollout is
  // preview-first (owner decision), which is only possible because of that:
  // `preview` carries EXPO_PUBLIC_BORING_BUILD=true.
  it('preview declares the cloud flag and endpoint, and takes the token from the EAS env store', () => {
    const env = profiles.preview.env ?? {};
    expect(env.EXPO_PUBLIC_ENABLE_CLOUD_SAVE).toBe('true');
    expect(env.EXPO_PUBLIC_CLOUD_SAVE_URL ?? '').not.toBe('');

    // The auth token is deliberately NOT in eas.json — it ships inlined in the
    // bundle either way, so keeping it out of the repo costs nothing. It is set
    // as an EAS environment variable on the profile, which eas.json cannot see.
    // So the profile ALONE resolves to off; the real build resolves to on once
    // the store supplies the token. Both halves are asserted here so a future
    // reader cannot mistake the `false` below for the feature being disabled.
    expect(env.EXPO_PUBLIC_CLOUD_AUTH_TOKEN).toBeUndefined();
    expect(loadFlags(env).cloudSave).toBe(false);
    expect(loadFlags({ ...env, EXPO_PUBLIC_CLOUD_AUTH_TOKEN: 'store-supplied' }).cloudSave).toBe(true);

    // Proof the Boring Build exemption is real and not an accident of ordering.
    expect(env.EXPO_PUBLIC_BORING_BUILD).toBe('true');
  });

  it('production does NOT ship cloud backup yet (preview-first rollout)', () => {
    const env = profiles.production.env ?? {};
    expect(env.EXPO_PUBLIC_ENABLE_CLOUD_SAVE).toBeUndefined();
    expect(loadFlags(env).cloudSave).toBe(false);
  });

  it('cloud backup needs ALL THREE: the flag, a non-empty URL, and the auth token', () => {
    // Any missing piece renders a Back up / Restore UI that cannot work: the
    // transport no-ops without a base URL, and `cloudWritesAllowed()` refuses
    // every read and write in a release build without the token. Off is the
    // only honest answer for a partly-filled profile.
    const ON = {
      EXPO_PUBLIC_ENABLE_CLOUD_SAVE: 'true',
      EXPO_PUBLIC_CLOUD_SAVE_URL: 'https://example.test/v1',
      EXPO_PUBLIC_CLOUD_AUTH_TOKEN: 'token',
    };
    expect(loadFlags(ON).cloudSave).toBe(true);

    for (const missing of Object.keys(ON) as (keyof typeof ON)[]) {
      const partial = { ...ON };
      delete partial[missing];
      expect(loadFlags(partial).cloudSave).toBe(false);
    }
    // Whitespace is not a value.
    expect(loadFlags({ ...ON, EXPO_PUBLIC_CLOUD_SAVE_URL: '   ' }).cloudSave).toBe(false);
    expect(loadFlags({ ...ON, EXPO_PUBLIC_CLOUD_AUTH_TOKEN: '   ' }).cloudSave).toBe(false);
  });

  it('drops the notifications flag — expo-notifications is a no-op stub', () => {
    const flags = loadFlags({ EXPO_PUBLIC_BORING_BUILD: 'false' });
    expect('notifications' in flags).toBe(false);
  });
});
