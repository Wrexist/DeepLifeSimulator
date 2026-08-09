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
