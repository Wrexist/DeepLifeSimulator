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
  { id: 'no_ads', title: 'Ad-Free Forever', description: 'No banners, no interstitials — just pure, uninterrupted play.' },
  { id: 'daily_gems', title: 'Daily Gem Drop', description: '500 gems to claim, every single day.' },
  { id: 'income_boost', title: 'Bigger Paychecks', description: '+25% career income, every single payday.' },
  { id: 'legacy_premium', title: 'Legacy Pass Premium', description: 'Unlock the full premium reward track, every single season.' },
  { id: 'cosmetics', title: 'Exclusive Cosmetics', description: 'Members-only seasonal themes, frames and skins.' },
  { id: 'welcome_gems', title: '500 Welcome Gems', description: 'A one-time gem bonus the moment you join.' },
  { id: 'vip_support', title: 'VIP Priority Support', description: 'Your questions jump to the front of the queue.' },
];

/** One-time gem grant applied when DeepLife+ benefits are first activated. */
export const DEEP_LIFE_PLUS_WELCOME_GEMS = 500;

/** Members-only daily gem drop — claimable once per real calendar day. */
export const DEEP_LIFE_PLUS_DAILY_GEMS = 500;

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
 * Build the Mon→Sun status strip for the daily gem drop from the claimed day
 * keys. Pure (takes `now`), so it's deterministic and unit-testable. Past days
 * before the player's first-ever claim are `inactive` (not `missed`), so a new
 * member is never shown red crosses for days they couldn't have claimed.
 */
export function buildDeepLifePlusWeekStatus(claimDays: string[] | undefined, now: Date): WeekDayCell[] {
  const claimed = new Set(Array.isArray(claimDays) ? claimDays : []);
  const firstClaim = claimed.size ? [...claimed].sort()[0] : null;
  const todayKey = utcDayKey(now);

  // Midnight-UTC of this week's Monday.
  const baseMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const mondayOffset = (new Date(baseMs).getUTCDay() + 6) % 7; // getUTCDay: 0=Sun
  const mondayMs = baseMs - mondayOffset * MS_PER_DAY;

  return WEEKDAY_LABELS.map((label, i) => {
    const key = utcDayKey(new Date(mondayMs + i * MS_PER_DAY));
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
  return subscriptionService.hasPremiumAccess();
}
