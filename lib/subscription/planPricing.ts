/**
 * Honest price + offer resolution for the DeepLife+ paywall.
 *
 * THE RULE THIS FILE ENFORCES: the paywall renders what the STORE reports for
 * THIS player's storefront, or it renders nothing. It never prints a number it
 * cannot stand behind, and it never derives a claim (per-week framing, a
 * savings percentage, a free trial) from figures the store did not give it.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `DEEP_LIFE_PLUS_PLANS[].price` is a static config string ('$4.99' / '$49.99')
 * read from `SUBSCRIPTION_CONFIGS`. Every price on the paywall came from it: the
 * plan cards, the CTA, the legal disclosure, the lifetime row, "just $0.96/week"
 * and "SAVE 17%". A player in Germany, Japan or Brazil was shown a US-dollar
 * figure they would never be charged, next to a working purchase button. The gem
 * shop already resolves live localized prices; the subscription paywall — the
 * surface selling a RECURRING charge — was the one money screen that did not.
 *
 * Apple requires the customer to understand what they pay before they buy. A
 * price in the wrong currency does not meet that bar, and a savings percentage
 * computed from USD tiers can be flatly false in a storefront whose monthly and
 * yearly tiers sit at a different ratio (Apple's price tiers are not uniform
 * across currencies).
 *
 * ── WHAT IS DERIVED VS WHAT IS REPORTED ─────────────────────────────────────
 * REPORTED (rendered verbatim from the SDK): the display price string.
 * DERIVED (computed, and only when the inputs are trustworthy):
 *   • per-week framing — needs a numeric amount AND the store's own formatted
 *     string, so the result keeps the storefront's currency symbol, symbol
 *     position and separator convention. Never built from a currency table.
 *   • savings percentage — needs BOTH plans numeric AND in the SAME currency.
 *   • free-trial length — read off the product's own introductory offer.
 * Every derivation returns an empty/zero/null answer when its inputs are
 * missing, and every caller treats that as "say nothing" rather than "guess".
 *
 * Pure module: no service imports, no `Intl` (Hermes coverage varies by
 * platform), no currency table. Structural product shape so it works with both
 * the expo-iap adapter output and RevenueCat's `storeProduct`.
 */

/**
 * The fields we need off a loaded store product. Kept structural rather than
 * importing an SDK type — `services/expoIapAdapter.ts` normalises expo-iap and
 * `services/RevenueCatService.ts` normalises `react-native-purchases`, and the
 * two do not share a type.
 */
export interface StoreProductLike {
  productId?: string;
  /** Display string, or (unnormalised SDKs) a raw number. */
  price?: string | number;
  displayPrice?: string;
  localizedPrice?: string;
  /** Numeric amount, preserved by the adapter alongside the display string. */
  priceAmount?: number;
  currency?: string;
  currencyCode?: string;
  priceCurrencyCode?: string;
  // ── iOS introductory-offer fields (expo-iap ProductSubscriptionIOS) ──
  introductoryPricePaymentModeIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | number | null;
  introductoryPriceSubscriptionPeriodIOS?: string | null;
  subscriptionInfoIOS?: {
    introductoryOffer?: {
      paymentMode?: string | null;
      periodCount?: number | null;
      period?: { unit?: string | null; value?: number | null } | null;
    } | null;
  } | null;
  // ── Android offer fields (expo-iap ProductSubscriptionAndroid) ──
  subscriptionOfferDetailsAndroid?: Array<{
    pricingPhases?: {
      pricingPhaseList?: Array<{
        priceAmountMicros?: string | number | null;
        billingPeriod?: string | null;
        billingCycleCount?: number | null;
      }> | null;
    } | null;
  }> | null;
}

/** What the paywall knows about one plan's price right now. */
export interface PlanPrice {
  productId: string;
  /**
   * The string to render, straight from the SDK. EMPTY when the store has not
   * given us one — callers must render a placeholder, never a config price.
   */
  displayPrice: string;
  /** Numeric amount, or null when the SDK exposed only a formatted string. */
  amount: number | null;
  /** ISO 4217 code, or null. Required before comparing two prices. */
  currency: string | null;
  /** True when `displayPrice` came from the store (i.e. is correct for THIS user). */
  fromStore: boolean;
}

const EMPTY_PLAN_PRICE = (productId: string): PlanPrice => ({
  productId,
  displayPrice: '',
  amount: null,
  currency: null,
  fromStore: false,
});

/** The player-facing price string a product carries, or '' if it has none. */
function displayPriceOf(product: StoreProductLike): string {
  const candidate = product.displayPrice ?? product.localizedPrice ?? product.price;
  if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
  // A raw number is NOT a price string — it carries no currency, and printing a
  // bare "49.99" next to a purchase button is exactly the ambiguity this module
  // exists to prevent.
  return '';
}

/** A finite positive amount plus an ISO currency, or null. */
function numericPriceOf(product: StoreProductLike): { amount: number; currency: string } | null {
  const amount =
    typeof product.priceAmount === 'number'
      ? product.priceAmount
      : typeof product.price === 'number'
        ? product.price
        : NaN;
  const currency =
    typeof product.currency === 'string'
      ? product.currency
      : typeof product.currencyCode === 'string'
        ? product.currencyCode
        : typeof product.priceCurrencyCode === 'string'
          ? product.priceCurrencyCode
          : '';
  if (!Number.isFinite(amount) || amount <= 0 || !currency) return null;
  return { amount, currency: currency.toUpperCase() };
}

/**
 * Resolve one plan's price from its loaded store product.
 *
 * `product` is null/undefined when the SKU has not loaded — a state the caller
 * must render as "price unknown", NOT as the config price. A subscription is a
 * recurring charge; presenting a stale USD figure next to a live purchase button
 * is the failure mode this whole module exists to make impossible.
 */
export function resolvePlanPrice(
  productId: string,
  product: StoreProductLike | null | undefined,
): PlanPrice {
  if (!product) return EMPTY_PLAN_PRICE(productId);
  const displayPrice = displayPriceOf(product);
  if (!displayPrice) return EMPTY_PLAN_PRICE(productId);
  const numeric = numericPriceOf(product);
  return {
    productId,
    displayPrice,
    amount: numeric?.amount ?? null,
    currency: numeric?.currency ?? null,
    fromStore: true,
  };
}

/**
 * Split a store-formatted price into the pieces needed to rewrite its amount
 * while keeping the storefront's own conventions — currency symbol, symbol
 * position, decimal separator, grouping separator and decimal count.
 *
 * This is why the module needs no currency table and no `Intl`: the store has
 * already formatted a number for this storefront, so the safest way to render a
 * DIFFERENT number for the same storefront is to reuse that formatting rather
 * than reinvent it.
 *
 * Returns null when no numeric run can be located, which the caller renders as
 * "omit the derived line".
 */
function parsePriceFormat(display: string): {
  prefix: string;
  suffix: string;
  decimalSep: string;
  groupSep: string;
  decimals: number;
} | null {
  // A run that starts and ends on a digit, allowing separators (including the
  // non-breaking and narrow no-break spaces several locales group with).
  const match = display.match(/\d(?:[\d.,\u0020\u00A0\u202F]*\d)?/);
  if (!match || match.index === undefined) return null;

  const token = match[0];
  const prefix = display.slice(0, match.index);
  const suffix = display.slice(match.index + token.length);

  // The LAST separator followed by exactly 1-2 digits at the end of the token is
  // the decimal separator. Anything else (a 3-digit tail like "7,800", or no
  // separator at all) means a zero-decimal currency such as JPY or KRW, where
  // that same separator is grouping. This is what tells "49,99 €" (decimal)
  // apart from "¥7,800" (grouping) without knowing either currency.
  const decimalMatch = token.match(/([.,])(\d{1,2})$/);
  const decimalSep = decimalMatch ? decimalMatch[1] : '';
  const decimals = decimalMatch ? decimalMatch[2].length : 0;

  // Whatever separator remains after the decimal one is the grouping separator.
  // Storefronts group with dot, comma, or the plain / non-breaking / narrow
  // no-break spaces (fr-FR, ru-RU, sv-SE).
  const SEPARATORS = new Set(['.', ',', '\u0020', '\u00A0', '\u202F']);
  const groupCandidates = new Set<string>();
  for (const ch of token) {
    if (SEPARATORS.has(ch)) groupCandidates.add(ch);
  }
  if (decimalSep) groupCandidates.delete(decimalSep);
  const groupSep = groupCandidates.size === 1 ? [...groupCandidates][0] : '';

  return { prefix, suffix, decimalSep, groupSep, decimals };
}

/** Group an integer-digit string in threes with `sep` ('' → no grouping). */
function groupDigits(digits: string, sep: string): string {
  if (!sep) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Render `amount` using the exact formatting of `display`.
 *
 * Rounds UP to the source's decimal precision on purpose: every caller here
 * derives a SMALLER, more attractive number (a per-week framing of a yearly
 * price), and rounding down would advertise a price fractionally lower than the
 * player actually pays. Over-stating by half a cent is a cost worth paying to
 * make under-stating structurally impossible.
 */
export function reformatPriceAmount(display: string, amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';
  const fmt = parsePriceFormat(display);
  if (!fmt) return '';

  const factor = Math.pow(10, fmt.decimals);
  // Nudge before ceil so binary float error alone cannot push an exact value up
  // a unit (0.96 * 100 = 95.99999999999999 must not become 0.97).
  const scaled = Math.ceil(amount * factor - 1e-9);
  const asString = (scaled / factor).toFixed(fmt.decimals);
  const [intPart, fracPart = ''] = asString.split('.');

  const body =
    fmt.decimals > 0 && fmt.decimalSep
      ? `${groupDigits(intPart, fmt.groupSep)}${fmt.decimalSep}${fracPart}`
      : groupDigits(intPart, fmt.groupSep);

  return `${fmt.prefix}${body}${fmt.suffix}`;
}

/** Weeks in a year, for the per-week framing. Matches the existing copy. */
const WEEKS_PER_YEAR = 52;

/**
 * The yearly plan's effective per-week price, formatted like the store's own
 * yearly price ("$0.97", "0,97 €", "¥150").
 *
 * Empty string when the yearly plan has no numeric amount - the SDK gave us only
 * a formatted string, so any per-week figure would be a guess. The paywall omits
 * the line entirely in that case.
 */
export function perWeekPrice(yearly: PlanPrice): string {
  if (!yearly.fromStore || yearly.amount === null || yearly.amount <= 0) return '';
  return reformatPriceAmount(yearly.displayPrice, yearly.amount / WEEKS_PER_YEAR);
}

/**
 * Whole-percent savings of the yearly plan against twelve monthly charges, or 0
 * when it cannot be PROVEN.
 *
 * Three conditions, all required: both plans carry a numeric amount, both are in
 * the SAME currency, and the yearly price is genuinely lower. A cross-currency
 * comparison would need an exchange rate the app does not have, and the two
 * plans' price tiers are set independently per storefront - so a percentage
 * carried over from the USD tiers can be simply wrong elsewhere.
 *
 * FLOORED, not rounded: a claim of "SAVE 16%" against a true 16.6% under-states
 * the offer, which is a safe direction to be wrong in. Rounding up to 17% would
 * over-state it.
 */
export function yearlySavingsPercent(monthly: PlanPrice, yearly: PlanPrice): number {
  if (monthly.amount === null || yearly.amount === null) return 0;
  if (monthly.amount <= 0 || yearly.amount <= 0) return 0;
  if (!monthly.currency || !yearly.currency) return 0;
  if (monthly.currency !== yearly.currency) return 0;

  const twelveMonths = monthly.amount * 12;
  if (yearly.amount >= twelveMonths) return 0;
  const pct = Math.floor(((twelveMonths - yearly.amount) / twelveMonths) * 100);
  // A sub-1% gap is tier noise, not a saving worth a badge.
  return pct >= 1 ? pct : 0;
}

// ── Introductory offers ─────────────────────────────────────────────────────

/** Days per ISO-8601 duration unit. Calendar-approximate, which is all the copy needs. */
const DAYS_PER_UNIT: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

/** Parse an ISO-8601 billing period ("P1W", "P3D", "P1M") to days; 0 if unparseable. */
function iso8601DurationToDays(period: string | null | undefined): number {
  if (typeof period !== 'string') return 0;
  const m = period.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/);
  if (!m) return 0;
  const [, y, mo, w, d] = m;
  return (
    (y ? Number(y) * DAYS_PER_UNIT.year : 0) +
    (mo ? Number(mo) * DAYS_PER_UNIT.month : 0) +
    (w ? Number(w) * DAYS_PER_UNIT.week : 0) +
    (d ? Number(d) * DAYS_PER_UNIT.day : 0)
  );
}

/**
 * How many days of FREE trial this product's introductory offer carries,
 * according to the store - or null when the store has not told us.
 *
 * null vs 0 is the load-bearing distinction:
 *   • `null` = unknown (no product loaded, or an SDK that does not expose offer
 *     details). The caller may still fall back to the configured constant.
 *   • `0`    = the store says this product has NO free-trial offer. The caller
 *     must NOT advertise a trial, whatever the constant says.
 *
 * That second case is the one the configured `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS`
 * constant cannot cover: it is hand-maintained, and nothing validates it against
 * App Store Connect. If the offer is removed, misconfigured, or never went live,
 * the constant keeps promising a trial the store will not honour and StoreKit
 * charges the full price at checkout.
 *
 * Note this is a question about the PRODUCT, not the player. Whether THIS player
 * may still use the offer is a separate per-user check
 * (`revenueCatService.getIntroEligibility`) - a product can carry a trial that a
 * returning subscriber already consumed.
 */
export function storeFreeTrialDays(product: StoreProductLike | null | undefined): number | null {
  if (!product) return null;

  // ── iOS, current shape: subscriptionInfoIOS.introductoryOffer ──
  const offer = product.subscriptionInfoIOS?.introductoryOffer;
  if (offer && typeof offer.paymentMode === 'string') {
    if (offer.paymentMode !== 'free-trial') return 0;
    const unit = typeof offer.period?.unit === 'string' ? offer.period.unit.toLowerCase() : '';
    const value = Number(offer.period?.value ?? 0);
    const count = Number(offer.periodCount ?? 1) || 1;
    const perPeriod = DAYS_PER_UNIT[unit] ?? 0;
    const days = perPeriod * (Number.isFinite(value) && value > 0 ? value : 0) * count;
    return days > 0 ? Math.round(days) : null;
  }

  // ── iOS, legacy flat fields ──
  const mode = product.introductoryPricePaymentModeIOS;
  if (typeof mode === 'string' && mode.length > 0 && mode !== 'empty') {
    if (mode !== 'free-trial') return 0;
    const unit =
      typeof product.introductoryPriceSubscriptionPeriodIOS === 'string'
        ? product.introductoryPriceSubscriptionPeriodIOS.toLowerCase()
        : '';
    const periods = Number(product.introductoryPriceNumberOfPeriodsIOS ?? 1) || 1;
    const perPeriod = DAYS_PER_UNIT[unit] ?? 0;
    const days = perPeriod * periods;
    return days > 0 ? Math.round(days) : null;
  }

  // ── Android: a pricing phase charging zero is the free trial ──
  const offers = product.subscriptionOfferDetailsAndroid;
  if (Array.isArray(offers) && offers.length > 0) {
    let sawPhaseList = false;
    for (const detail of offers) {
      const phases = detail?.pricingPhases?.pricingPhaseList;
      if (!Array.isArray(phases) || phases.length === 0) continue;
      sawPhaseList = true;
      for (const phase of phases) {
        const micros = Number(phase?.priceAmountMicros ?? NaN);
        if (!Number.isFinite(micros) || micros !== 0) continue;
        const cycles = Number(phase?.billingCycleCount ?? 1) || 1;
        const days = iso8601DurationToDays(phase?.billingPeriod) * cycles;
        if (days > 0) return Math.round(days);
      }
    }
    // Offers were present and readable, and none of them was free.
    if (sawPhaseList) return 0;
  }

  return null;
}

/**
 * What the paywall is allowed to SAY about the free trial.
 *
 *   'promise'     - this player will genuinely start at no charge. Only when the
 *                   store confirms the product carries a trial AND confirms THIS
 *                   player is eligible for it. This is the only state that earns
 *                   the "$0.00 today" copy.
 *   'conditional' - a trial exists on the product, but we could not confirm this
 *                   player's eligibility (Android exposes no per-user answer;
 *                   RevenueCat-disabled builds and failed calls return the same
 *                   'unknown'). Copy must hold for both readings, e.g. "includes
 *                   a 7-day free trial for new subscribers" - true whether or not
 *                   this particular player still qualifies.
 *   'none'        - say nothing about a trial. Either the store reports the
 *                   product has no trial offer, or it reports this player as
 *                   ineligible (they already used it).
 *
 * The state this replaces treated 'unknown' as good enough for a hard promise:
 * the CTA read "Start for $0.00 Today" and the banner read "no charge" for every
 * Android user and every build without RevenueCat keys. A returning subscriber
 * who had already spent their trial tapped that button and was charged the full
 * price immediately.
 */
export type TrialClaim = 'promise' | 'conditional' | 'none';

export function resolveTrialClaim(params: {
  /** Per-user verdict from the store (RevenueCat / StoreKit). */
  eligibility: 'eligible' | 'ineligible' | 'unknown';
  /** Store-reported trial length for the product: null = unknown, 0 = no offer. */
  storeTrialDays: number | null;
  /** The configured fallback (`DEEP_LIFE_PLUS_FREE_TRIAL_DAYS`). 0 disables all trial copy. */
  configuredTrialDays: number;
}): { claim: TrialClaim; days: number } {
  const { eligibility, storeTrialDays, configuredTrialDays } = params;

  // The kill switch: the owner can silence every trial claim by setting the
  // constant to 0, e.g. while the store offer is not live yet.
  if (configuredTrialDays <= 0) return { claim: 'none', days: 0 };

  // The store is authoritative about whether the OFFER exists at all.
  if (storeTrialDays === 0) return { claim: 'none', days: 0 };

  // And about whether THIS player may still use it.
  if (eligibility === 'ineligible') return { claim: 'none', days: 0 };

  // Prefer the store's own trial length over the hand-maintained constant, so a
  // change made in App Store Connect cannot silently desync the copy.
  const days = storeTrialDays !== null && storeTrialDays > 0 ? storeTrialDays : configuredTrialDays;

  return { claim: eligibility === 'eligible' ? 'promise' : 'conditional', days };
}
