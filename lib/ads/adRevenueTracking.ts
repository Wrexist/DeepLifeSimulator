/**
 * AdMob → RevenueCat ad-revenue mapping.
 *
 * RevenueCat's Ads dashboard is fed by `Purchases.adTracker.*` (built into
 * `react-native-purchases` — there is no separate adapter package for React
 * Native). The events it wants do NOT line up with what AdMob hands us, so this
 * module owns the translation and stays pure so it can be tested without either
 * native SDK loaded.
 *
 * Three mismatches it exists to absorb:
 *
 *  1. **Units.** AdMob's impression-level `PaidEvent.value` is a float in
 *     currency units (`0.0042`); RevenueCat wants integer MICROS (`4200`).
 *     Getting this wrong under-reports revenue by 1,000,000×.
 *  2. **Precision.** AdMob reports a NUMERIC `AdValue.PrecisionType` /
 *     `GADAdValuePrecision` (0 unknown, 1 estimated, 2 publisher-provided,
 *     3 precise); RevenueCat wants a string, and its name for `PRECISE` is
 *     `'exact'` — mapping by lowercased name silently produces garbage.
 *  3. **Impression id.** RevenueCat requires an `impressionId` on every ad event
 *     and uses it to stitch loaded/displayed/revenue into one impression. AdMob
 *     has no such concept, so we mint one per ad request and carry it through.
 *
 * NOTE ON SCOPE: this only feeds the RevenueCat Ads *analytics* surface. The
 * Ads → Rewards feature (server-side verified rewarded ads) needs
 * `generateRewardVerificationToken` / `pollRewardVerification`, which do not
 * exist in the pinned `react-native-purchases@10.4.4` — see docs/REVENUECAT-SETUP.md.
 */
import { v4 as uuidv4 } from 'uuid';

/** RevenueCat's `AdMediatorName` — we serve AdMob directly, no mediation layer. */
export const RC_MEDIATOR_ADMOB = 'AdMob';

/** RevenueCat's `AdFormat` string constants (the subset this app serves). */
export type RcAdFormat = 'banner' | 'interstitial' | 'rewarded';

/** RevenueCat's `AdRevenuePrecision` string constants. */
export type RcAdRevenuePrecision = 'exact' | 'publisher_defined' | 'estimated' | 'unknown';

/** Payload for `Purchases.adTracker.trackAdRevenue`. */
export interface RcAdRevenuePayload {
  mediatorName: string;
  adFormat: RcAdFormat;
  adUnitId: string;
  impressionId: string;
  revenueMicros: number;
  currency: string;
  precision: RcAdRevenuePrecision;
}

/** Payload for the non-revenue lifecycle events (loaded / displayed). */
export interface RcAdEventPayload {
  mediatorName: string;
  adFormat: RcAdFormat;
  adUnitId: string;
  impressionId: string;
}

/** Payload for `Purchases.adTracker.trackAdFailedToLoad` — no impression exists yet. */
export interface RcAdFailedPayload {
  mediatorName: string;
  adFormat: RcAdFormat;
  adUnitId: string;
  mediatorErrorCode?: number | null;
}

/** The shape AdMob delivers on its `PAID` event / `onPaid` prop. */
export interface AdMobPaidEvent {
  value: number;
  currency: string;
  precision: unknown;
}

/**
 * Mint an impression id. RevenueCat correlates an impression's events by this
 * value, so one id is generated per ad REQUEST and reused for that ad's whole
 * lifecycle — never per event.
 */
export function newImpressionId(): string {
  return uuidv4();
}

/**
 * Convert AdMob's currency-unit float to RevenueCat's integer micros.
 *
 * Returns null for anything not safely representable (NaN, ±Infinity, negative)
 * so the caller can DROP the event rather than post a bogus revenue figure —
 * a poisoned number is worse than a missing one on a revenue dashboard.
 */
export function toRevenueMicros(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const micros = Math.round(value * 1_000_000);
  return Number.isSafeInteger(micros) ? micros : null;
}

/**
 * Map AdMob's precision onto RevenueCat's.
 *
 * `enumRef` is `RevenuePrecisions` from `react-native-google-mobile-ads`, whose
 * members are populated from native `getConstants()` — preferred when present so
 * we never hardcode a value the SDK might renumber. It falls back to Google's
 * documented numeric PrecisionType (identical on iOS and Android), then to
 * string forms, then to `'unknown'`, which is a legitimate RevenueCat value.
 *
 * The `undefined` guard matters: in a build where `getConstants()` returned
 * nothing, every enum member is `undefined`, and an unguarded `raw === ref.X`
 * would match the FIRST branch for any undefined input.
 */
export function mapAdMobPrecision(
  raw: unknown,
  enumRef?: Record<string, unknown> | null,
): RcAdRevenuePrecision {
  if (enumRef) {
    const match = (key: string): boolean => enumRef[key] !== undefined && raw === enumRef[key];
    if (match('PRECISE')) return 'exact';
    if (match('PUBLISHER_PROVIDED')) return 'publisher_defined';
    if (match('ESTIMATED')) return 'estimated';
    if (match('UNKNOWN')) return 'unknown';
  }

  // Google's PrecisionType ordinals — AdValue.PrecisionType (Android) and
  // GADAdValuePrecision (iOS) share this numbering.
  if (raw === 3) return 'exact';
  if (raw === 2) return 'publisher_defined';
  if (raw === 1) return 'estimated';
  if (raw === 0) return 'unknown';

  if (typeof raw === 'string') {
    switch (raw.toUpperCase()) {
      case 'PRECISE':
      case 'EXACT':
        return 'exact';
      case 'PUBLISHER_PROVIDED':
      case 'PUBLISHER_DEFINED':
        return 'publisher_defined';
      case 'ESTIMATED':
        return 'estimated';
      default:
        return 'unknown';
    }
  }

  return 'unknown';
}

/**
 * Build the `trackAdRevenue` payload from an AdMob paid event.
 *
 * Returns null when the event cannot be represented honestly — an unusable
 * amount, or a missing ad unit / impression id (both are required fields, and
 * an empty one would land in the dashboard as an un-attributable impression).
 */
export function buildAdRevenuePayload(
  event: AdMobPaidEvent,
  context: { adFormat: RcAdFormat; adUnitId: string; impressionId: string },
  precisionEnum?: Record<string, unknown> | null,
): RcAdRevenuePayload | null {
  const revenueMicros = toRevenueMicros(event?.value);
  if (revenueMicros === null) return null;
  if (!context.adUnitId || !context.impressionId) return null;

  return {
    mediatorName: RC_MEDIATOR_ADMOB,
    adFormat: context.adFormat,
    adUnitId: context.adUnitId,
    impressionId: context.impressionId,
    revenueMicros,
    // AdMob always reports a currency alongside a paid event; default only so a
    // malformed payload still produces a well-formed RevenueCat event.
    currency: typeof event?.currency === 'string' && event.currency ? event.currency : 'USD',
    precision: mapAdMobPrecision(event?.precision, precisionEnum),
  };
}
