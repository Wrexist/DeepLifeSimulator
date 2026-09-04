/**
 * AdMob → RevenueCat ad-revenue mapping.
 *
 * Locks the three translations that are wrong-by-default, each of which fails
 * SILENTLY (a wrong number on a dashboard, not a crash):
 *
 *  1. Units — AdMob reports currency units, RevenueCat wants micros. Skipping
 *     the conversion under-reports every impression by 1,000,000×.
 *  2. Precision — AdMob's `PRECISE` is RevenueCat's `'exact'`, so mapping by
 *     lowercased name produces a value RevenueCat does not recognize.
 *  3. Refusal — an unusable amount must DROP the event rather than post a
 *     placeholder, because a poisoned figure on a revenue dashboard is worse
 *     than a missing one.
 */
import {
  RC_MEDIATOR_ADMOB,
  buildAdRevenuePayload,
  mapAdMobPrecision,
  newImpressionId,
  toRevenueMicros,
} from '@/lib/ads/adRevenueTracking';
import * as fs from 'fs';
import * as path from 'path';

// The shape `react-native-google-mobile-ads` exports as `RevenuePrecisions`,
// populated from native getConstants(). Values are Google's PrecisionType.
const PRECISIONS = { UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3 };

describe('toRevenueMicros', () => {
  it('converts currency units to integer micros', () => {
    expect(toRevenueMicros(0.0042)).toBe(4200);
    expect(toRevenueMicros(1)).toBe(1_000_000);
    expect(toRevenueMicros(0)).toBe(0);
  });

  it('rounds sub-micro fractions rather than truncating them away', () => {
    // A $0.0000005 eCPM impression must not silently become 0.
    expect(toRevenueMicros(0.0000005)).toBe(1);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['a negative amount', -0.01],
    ['a string', '0.004'],
    ['undefined', undefined],
    ['null', null],
  ])('returns null for %s so the caller drops the event', (_label, input) => {
    expect(toRevenueMicros(input)).toBeNull();
  });
});

describe('mapAdMobPrecision', () => {
  it('maps AdMob PRECISE onto RevenueCat "exact", not "precise"', () => {
    expect(mapAdMobPrecision(PRECISIONS.PRECISE, PRECISIONS)).toBe('exact');
  });

  it('maps the remaining SDK enum members', () => {
    expect(mapAdMobPrecision(PRECISIONS.PUBLISHER_PROVIDED, PRECISIONS)).toBe('publisher_defined');
    expect(mapAdMobPrecision(PRECISIONS.ESTIMATED, PRECISIONS)).toBe('estimated');
    expect(mapAdMobPrecision(PRECISIONS.UNKNOWN, PRECISIONS)).toBe('unknown');
  });

  it('falls back to Google ordinals when the SDK enum is unavailable', () => {
    expect(mapAdMobPrecision(3, null)).toBe('exact');
    expect(mapAdMobPrecision(2, null)).toBe('publisher_defined');
    expect(mapAdMobPrecision(1, null)).toBe('estimated');
    expect(mapAdMobPrecision(0, null)).toBe('unknown');
  });

  it('does not false-match when getConstants() returned nothing', () => {
    // Every member undefined + an undefined input must NOT match the first
    // branch — an unguarded `raw === ref.PRECISE` would report every impression
    // as exact.
    const empty = { UNKNOWN: undefined, ESTIMATED: undefined, PRECISE: undefined };
    expect(mapAdMobPrecision(undefined, empty)).toBe('unknown');
  });

  it('degrades unrecognized input to "unknown" rather than throwing', () => {
    expect(mapAdMobPrecision({}, PRECISIONS)).toBe('unknown');
    expect(mapAdMobPrecision(99, PRECISIONS)).toBe('unknown');
  });
});

describe('newImpressionId', () => {
  it('mints a distinct id per call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newImpressionId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  /**
   * PLAYER REPORT (BBQ, screen recording read 2026-09-04): a full-screen
   * "App Initialization Error" reading `crypto.getRandomValues() not supported`.
   * That is verbatim from `uuid`'s BROWSER rng - the build Metro resolves for
   * React Native - which throws outright with no `crypto` global. Hermes has
   * none and the app ships no polyfill, so this function threw every time it ran.
   *
   * READ THIS BEFORE TRUSTING THIS TEST. It does NOT reproduce that bug, and it
   * was checked: with the old `uuidv4()` body restored, this assertion still
   * PASSES. Jest resolves uuid's `node` export (`require('crypto')` +
   * `randomFillSync`) while Metro resolves its `browser` one, so the harness
   * loads a different build of the package than the device does - deleting the
   * `crypto` global cannot reach the code that failed. No unit test in this
   * environment can. What this pins is a property of the CURRENT
   * implementation - that it asks for nothing the runtime may not have - and
   * the guard that actually catches a regression here is the import ban below,
   * which did go red against the old code.
   */
  it('does not depend on a crypto global (Hermes has none)', () => {
    const realCrypto = (globalThis as { crypto?: unknown }).crypto;
    // Optional on the cast type, so this is a legal delete, not a suppression.
    delete (globalThis as { crypto?: unknown }).crypto;
    try {
      expect(() => newImpressionId()).not.toThrow();
      expect(newImpressionId()).not.toEqual(newImpressionId());
    } finally {
      (globalThis as { crypto?: unknown }).crypto = realCrypto;
    }
  });

  it('stays unique when the clock does not move', () => {
    // Date.now() alone is not enough: several banner refreshes can land in one
    // millisecond, and a repeated id would silently merge two impressions on the
    // RevenueCat dashboard.
    const spy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const ids = new Set(Array.from({ length: 200 }, () => newImpressionId()));
      expect(ids.size).toBe(200);
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * The app must carry no `uuid` import at all.
 *
 * This is the load-bearing guard, and the only one of the three that fails
 * against the old code. The defect lives in WHICH BUILD of the package React
 * Native loads, not in how it was called, so it is invisible to any assertion
 * made from Node - the call site looks correct in both worlds. Banning the
 * import is the only check that survives that asymmetry.
 */
describe('no uuid dependency', () => {
  const ROOT = path.resolve(__dirname, '../..');

  it('is not in dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies).not.toHaveProperty('uuid');
    expect(pkg.devDependencies).not.toHaveProperty('@types/uuid');
    // The `overrides.xcode.uuid` pin is a BUILD-tool transitive and stays.
    expect(pkg.overrides?.xcode?.uuid).toBeTruthy();
  });

  it('is imported by no app source file', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          walk(rel);
        } else if (/\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
          if (/from ['"]uuid['"]|require\(['"]uuid['"]\)/.test(src)) hits.push(rel);
        }
      }
    };
    for (const root of ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'src', 'utils']) walk(root);
    expect(hits).toEqual([]);
  });
});

describe('buildAdRevenuePayload', () => {
  const context = {
    adFormat: 'rewarded' as const,
    adUnitId: 'ca-app-pub-2286247955186424/7390605700',
    impressionId: 'imp-1',
  };

  it('builds a complete RevenueCat payload from an AdMob paid event', () => {
    const payload = buildAdRevenuePayload(
      { value: 0.0042, currency: 'USD', precision: PRECISIONS.PRECISE },
      context,
      PRECISIONS,
    );

    expect(payload).toEqual({
      mediatorName: RC_MEDIATOR_ADMOB,
      adFormat: 'rewarded',
      adUnitId: context.adUnitId,
      impressionId: 'imp-1',
      revenueMicros: 4200,
      currency: 'USD',
      precision: 'exact',
    });
  });

  it('drops the event when the amount is unusable', () => {
    expect(
      buildAdRevenuePayload({ value: NaN, currency: 'USD', precision: 3 }, context, PRECISIONS),
    ).toBeNull();
  });

  it('drops the event when required identifiers are missing', () => {
    const paid = { value: 0.01, currency: 'USD', precision: 3 };
    expect(buildAdRevenuePayload(paid, { ...context, adUnitId: '' }, PRECISIONS)).toBeNull();
    expect(buildAdRevenuePayload(paid, { ...context, impressionId: '' }, PRECISIONS)).toBeNull();
  });

  it('drops the event when the currency is missing or blank', () => {
    // An amount without its unit is meaningless, and stamping a default would
    // relabel non-USD earnings as USD — a wrong number reported confidently.
    expect(buildAdRevenuePayload({ value: 0.01, currency: '', precision: 1 }, context, PRECISIONS)).toBeNull();
    expect(buildAdRevenuePayload({ value: 0.01, currency: '   ', precision: 1 }, context, PRECISIONS)).toBeNull();
  });

  it('keeps a non-USD currency exactly as AdMob reported it', () => {
    const payload = buildAdRevenuePayload(
      { value: 0.01, currency: 'EUR', precision: 1 },
      context,
      PRECISIONS,
    );
    expect(payload?.currency).toBe('EUR');
    expect(payload?.precision).toBe('estimated');
  });
});
