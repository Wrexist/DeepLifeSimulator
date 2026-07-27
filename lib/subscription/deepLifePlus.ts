/**
 * DeepLife+ — the auto-renewing premium subscription.
 *
 * Single source of truth for plans + the benefits we ACTUALLY deliver (kept
 * honest — only list perks the game really grants):
 *   - Removes all ads (sets settings.adsRemoved)
 *   - Legacy Pass premium track every season (gated via subscriptionService tier)
 *   - Exclusive seasonal cosmetics (the premium Legacy Pass rewards)
 *   - Gem welcome bonus on subscribe
 *
 * The transport (store products, receipt verification) is handled by
 * SubscriptionService + IAPService; this module is pure config + helpers.
 */
import {
  SUBSCRIPTION_PRODUCTS,
  SUBSCRIPTION_CONFIGS,
  IAP_PRODUCTS,
  getProductConfig,
} from '@/utils/iapConfig';
import { subscriptionService } from '@/services/SubscriptionService';

export type BillingPeriod = 'monthly' | 'yearly';

export interface DeepLifePlusPlan {
  period: BillingPeriod;
  productId: string;
  /** Display price from SUBSCRIPTION_CONFIGS. */
  price: string;
  /** Short unit label, e.g. "per month". */
  unit: string;
  /** Optional marketing badge. */
  badge?: string;
}

export const DEEP_LIFE_PLUS_PLANS: DeepLifePlusPlan[] = [
  {
    period: 'monthly',
    productId: SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY,
    price: SUBSCRIPTION_CONFIGS[SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY]?.price ?? '$4.99',
    unit: 'per month',
  },
  {
    period: 'yearly',
    productId: SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY,
    price: SUBSCRIPTION_CONFIGS[SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY]?.price ?? '$49.99',
    unit: 'per year',
    badge: 'Best value',
  },
];

/**
 * The one-time "unlock forever" alternative to subscribing — a pricier
 * non-consumable that grants the same premium entitlements permanently, for
 * players who'd rather pay once than subscribe. Read via
 * subscriptionService.hasLifetimePremium().
 */
export const DEEP_LIFE_PLUS_LIFETIME = {
  productId: IAP_PRODUCTS.LIFETIME_PREMIUM,
  price: getProductConfig(IAP_PRODUCTS.LIFETIME_PREMIUM)?.price ?? '$79.99',
  unit: 'one-time',
  label: 'Unlock forever',
};

export interface DeepLifePlusBenefit {
  id: string;
  title: string;
  description: string;
}

/**
 * Only perks the game genuinely delivers today. KEEP THIS TRUTHFUL — the copy is
 * marketable but every line must match what the game actually grants (App Store
 * rejects paywalls that promise benefits the app doesn't deliver).
 */
export const DEEP_LIFE_PLUS_BENEFITS: DeepLifePlusBenefit[] = [
  // First, and deliberately. It is the only benefit on this list a free player
  // cannot get by grinding, and the only one they can picture before they own
  // it — "your face, in the game" sells itself in a way "+25% income" cannot.
  //
  // The copy says "from a selfie", not "photorealistic". What the feature does
  // is measure a real face and drive a scan-derived rig with it; overselling it
  // to "a photo of you" is how a paid feature earns refund requests.
  { id: 'photo_avatar', title: 'Create Yourself From a Selfie', description: 'Our AI reads your face and builds your 3D character to match.' },
  { id: 'no_ads', title: 'Ad-Free Forever', description: 'No banners, no interstitials — just pure, uninterrupted play.' },
  { id: 'daily_gems', title: 'Daily Gem Drop', description: '250 gems every day — 12× the free daily.' },
  { id: 'income_boost', title: 'Bigger Paychecks', description: '+25% career income, every single payday.' },
  { id: 'legacy_premium', title: 'Legacy Pass Premium', description: 'Unlock the full premium reward track, every single season.' },
  { id: 'cosmetics', title: 'Exclusive Cosmetics', description: 'Members-only seasonal themes, frames and skins.' },
  { id: 'welcome_gems', title: '500 Welcome Gems', description: 'A one-time gem bonus the moment you join.' },
  { id: 'vip_support', title: 'VIP Priority Support', description: 'Your questions jump to the front of the queue.' },
];

/** One-time gem grant applied when DeepLife+ benefits are first activated. */
export const DEEP_LIFE_PLUS_WELCOME_GEMS = 500;

/** Daily gem drop for DeepLife+ members — claimable once per real calendar day. */
export const DEEP_LIFE_PLUS_DAILY_GEMS = 250;

/** Daily gem drop for non-subscribers ("normal players"). */
export const DAILY_GEMS_BASE = 20;

/** The daily gem amount for this player: 250 for members, 20 for everyone else. */
export function dailyGemAmount(settings?: { deepLifePlusActivated?: boolean; lifetimePremium?: boolean }): number {
  return hasDeepLifePlusEntitlement(settings) ? DEEP_LIFE_PLUS_DAILY_GEMS : DAILY_GEMS_BASE;
}

/**
 * How many times bigger the member daily drop is than the free one (floored, so
 * the "N× the free daily" copy never overstates — 250 vs 20 → 12×). Drives the
 * "sell the difference" upsell line on the daily-claim surfaces.
 */
export function dailyGemMemberMultiple(): number {
  if (DAILY_GEMS_BASE <= 0) return 0;
  return Math.floor(DEEP_LIFE_PLUS_DAILY_GEMS / DAILY_GEMS_BASE);
}

/**
 * Extra gems a member collects over a free player across a full year of daily
 * claims ((250 − 20) × 365 = 83,950) — the strongest concrete value framing for
 * the daily-gem upsell.
 */
export function dailyGemExtraPerYear(): number {
  return Math.max(0, DEEP_LIFE_PLUS_DAILY_GEMS - DAILY_GEMS_BASE) * 365;
}

/**
 * DeepLife+ members pay this fraction less for gem-spend upgrades in the store
 * (0.2 = 20% off). Applied at BOTH the display price and the actual gem
 * deduction (memberUpgradeCost), so the sub feels valuable inside the shop, not
 * just at the paywall.
 */
export const DEEP_LIFE_PLUS_UPGRADE_DISCOUNT = 0.2;

/**
 * Gem cost of a gem-spend upgrade for this player: full price normally, 20% off
 * for DeepLife+ members (subscription or lifetime). The reducer that deducts
 * gems and the store card that shows the price MUST both route through this so
 * they can never disagree.
 */
export function memberUpgradeCost(
  baseCost: number,
  settings?: { deepLifePlusActivated?: boolean; lifetimePremium?: boolean },
): number {
  const base = Number.isFinite(baseCost) && baseCost > 0 ? Math.floor(baseCost) : 0;
  if (base === 0) return 0; // invalid/zero base — nothing to charge
  if (!hasDeepLifePlusEntitlement(settings)) return base;
  // Floor at 1 so a legitimate small price never discounts to free.
  return Math.max(1, Math.round(base * (1 - DEEP_LIFE_PLUS_UPGRADE_DISCOUNT)));
}

/**
 * A full Mon→Sun week of daily claims pays a bonus equal to one more daily drop
 * (so the 7th claim effectively pays 2×). Self-scaling: members get +250, free
 * players +20. Turns the streak strip into a real retention hook. Set to false
 * to disable the perfect-week bonus everywhere.
 */
export const DEEP_LIFE_PLUS_PERFECT_WEEK_BONUS = true;

/** UTC calendar-day key ("YYYY-MM-DD") — the reset boundary for the daily claim. */
export function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type WeekDayStatus =
  | 'claimed' // gem drop was claimed that day → green check
  | 'missed' // a past day (on/after they started) that was skipped → red cross
  | 'today' // today, not yet claimed → highlighted, ready
  | 'future' // upcoming day this week → dim
  | 'inactive'; // a past day before their first claim → neutral (never punished)

export interface WeekDayCell {
  key: string; // UTC day key
  label: string; // single-letter weekday label (Mon-first)
  status: WeekDayStatus;
}

const MS_PER_DAY = 86_400_000;
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The seven UTC day keys of `now`'s Mon→Sun week, Monday first. Shared by the
 * status strip and the perfect-week bonus so both agree on the week window.
 */
export function deepLifePlusWeekKeys(now: Date): string[] {
  // Midnight-UTC of this week's Monday.
  const baseMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const mondayOffset = (new Date(baseMs).getUTCDay() + 6) % 7; // getUTCDay: 0=Sun
  const mondayMs = baseMs - mondayOffset * MS_PER_DAY;
  return WEEKDAY_LABELS.map((_, i) => utcDayKey(new Date(mondayMs + i * MS_PER_DAY)));
}

/**
 * The Mon→Sun week keys for the week containing a "YYYY-MM-DD" day key (parsed at
 * noon UTC so it's unambiguous). Empty array if the key is malformed. Lets the
 * pure claim reducer — which only knows `todayKey` — find the current week.
 */
export function weekKeysForDayKey(dayKey: string): string[] {
  const ms = Date.parse(`${dayKey}T12:00:00.000Z`);
  if (!Number.isFinite(ms)) return [];
  return deepLifePlusWeekKeys(new Date(ms));
}

/** True when every day of `now`'s Mon→Sun week is present in the claim set. */
export function isPerfectDeepLifePlusWeek(claimDays: string[] | undefined, now: Date): boolean {
  const claimed = new Set(Array.isArray(claimDays) ? claimDays : []);
  const keys = deepLifePlusWeekKeys(now);
  return keys.length === 7 && keys.every((k) => claimed.has(k));
}

/**
 * Build the Mon→Sun status strip for the daily gem drop from the claimed day
 * keys. Pure (takes `now`), so it's deterministic and unit-testable. Past days
 * before the player's first-ever claim are `inactive` (not `missed`), so a new
 * member is never shown red crosses for days they couldn't have claimed.
 */
export function buildDeepLifePlusWeekStatus(claimDays: string[] | undefined, now: Date): WeekDayCell[] {
  const claimed = new Set(Array.isArray(claimDays) ? claimDays : []);
  const firstClaim = claimed.size ? [...claimed].sort()[0] : null;
  const todayKey = utcDayKey(now);
  const keys = deepLifePlusWeekKeys(now);

  return WEEKDAY_LABELS.map((label, i) => {
    const key = keys[i];
    let status: WeekDayStatus;
    if (claimed.has(key)) status = 'claimed';
    else if (key === todayKey) status = 'today';
    else if (key > todayKey) status = 'future';
    else if (!firstClaim || key < firstClaim) status = 'inactive';
    else status = 'missed';
    return { key, label, status };
  });
}

/**
 * Career-income boost for DeepLife+ members (1.25 = +25% weekly salary). Applied
 * in the weekly payday reducer (applyCareerSalaryAndPenalty) and advertised on
 * the paywall — keep the number and the "+25% career income" copy in sync.
 */
export const DEEP_LIFE_PLUS_INCOME_MULTIPLIER = 1.25;

/**
 * Pure in-state check: does this settings object reflect an active DeepLife+
 * entitlement (subscription OR lifetime)? Used by pure reducers that can't call
 * the subscription service. `deepLifePlusActivated` tracks the subscription
 * (cleared on lapse); `lifetimePremium` is the one-time unlock.
 */
export function hasDeepLifePlusEntitlement(settings?: {
  deepLifePlusActivated?: boolean;
  lifetimePremium?: boolean;
}): boolean {
  return settings?.deepLifePlusActivated === true || settings?.lifetimePremium === true;
}

/**
 * Introductory free-trial length advertised on the paywall (the "Try 7 days
 * free" hook). IMPORTANT: the MATCHING introductory offer must be configured on
 * the `deeplife_premium_*` subscription products in App Store Connect / Play
 * Console — StoreKit/Play present and enforce the actual trial at checkout; the
 * app only advertises it here. Set to 0 to hide all trial messaging (e.g. if the
 * store offer isn't live yet), so we never promise a trial the store won't honor.
 */
export const DEEP_LIFE_PLUS_FREE_TRIAL_DAYS = 7;

/** Parse a localized price string ("$49.99", "€49,99") to a number; 0 if unknown. */
function priceToNumber(p?: string): number {
  if (!p) return 0;
  // Keep digits + separators, then treat the LAST separator as the decimal.
  const cleaned = p.replace(/[^0-9.,]/g, '');
  const norm = cleaned.replace(/[.,](?=.*[.,])/g, '').replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

/** The leading currency symbol of a price string ("$", "€", "£"); "$" fallback. */
function currencySymbol(p?: string): string {
  const m = p?.match(/^[^\d\s]+/);
  return m ? m[0] : '$';
}

/** Format a number with the currency symbol of a reference price. */
function formatLike(amount: number, ref?: string): string {
  return `${currencySymbol(ref)}${amount.toFixed(2)}`;
}

/**
 * Effective per-week price of the yearly plan, e.g. "$0.96" — the strongest
 * value framing ("less than a coffee a week"). Empty string if it can't be
 * computed from the store price.
 */
export function yearlyPerWeek(): string {
  const yearly = DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'yearly');
  const n = priceToNumber(yearly?.price);
  if (n <= 0) return '';
  return formatLike(n / 52, yearly?.price);
}

/**
 * Whole-percent savings of the yearly plan vs paying monthly for a year
 * (e.g. 17). 0 if it can't be computed.
 */
export function yearlySavingsPercent(): number {
  const monthly = priceToNumber(DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'monthly')?.price);
  const yearly = priceToNumber(DEEP_LIFE_PLUS_PLANS.find((p) => p.period === 'yearly')?.price);
  if (monthly <= 0 || yearly <= 0) return 0;
  const twelveMonths = monthly * 12;
  if (yearly >= twelveMonths) return 0;
  return Math.round(((twelveMonths - yearly) / twelveMonths) * 100);
}

/** Look up a DeepLife+ plan by billing period; `undefined` if none matches. */
export function getDeepLifePlusPlan(period: BillingPeriod): DeepLifePlusPlan | undefined {
  return DEEP_LIFE_PLUS_PLANS.find((p) => p.period === period);
}

/** True if a product id belongs to the DeepLife+ subscription family. */
export function isDeepLifePlusProduct(productId: string): boolean {
  return productId === SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY
    || productId === SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY;
}

/**
 * True if the player has premium access right now — via an active subscription
 * OR the one-time lifetime unlock. Every premium gate should use this.
 */
export function isDeepLifePlusActive(): boolean {
  // QA-BUILD testing override.
  //
  // The selfie route into the face creator is a DeepLife+ surface, so the only
  // way to exercise it is to buy the subscription — which means one of the three
  // character-customization systems cannot be tested at all.
  //
  // ## Why this is not gated on `__DEV__`
  //
  // Because it has to work on TESTFLIGHT, and TestFlight is a release build:
  // `__DEV__` is compile-time false there, so a `__DEV__` guard makes the paid
  // route untestable on the exact builds testing happens on. That was the first
  // version of this and it did nothing where it was needed.
  //
  // The protection is therefore not the compiler, it is the build profile plus
  // a check that runs before every build:
  //
  //   - `EXPO_PUBLIC_QA_TOOLS` is set by the `testflight` profile in
  //     `eas.json` and by nothing else. The `production` profile does not
  //     carry it, so a store build does not have it.
  //   - `scripts/preflight-check.js` §5d FAILS if the production profile ever
  //     gains it, or if it is set in the environment of a production build. A
  //     store binary with this flag cannot get built without the check going
  //     red first.
  //
  // Deliberately here rather than inside `subscriptionService`: entitlement is
  // revenue-critical and the service should keep exactly one notion of what a
  // real purchase is. This overrides the QUESTION, not the record — nothing is
  // written, so a QA build cannot leave a fake purchase behind in storage.
  if (process.env.EXPO_PUBLIC_QA_TOOLS === 'true') return true;
  return subscriptionService.hasPremiumAccess();
}
