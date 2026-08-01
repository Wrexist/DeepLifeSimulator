/**
 * RevenueCatService — a guarded wrapper around `react-native-purchases`.
 *
 * Purpose: replace the self-hosted receipt-verification server with RevenueCat,
 * which verifies receipts server-side for you (no endpoint to run) and handles
 * subscriptions, the free trial, restores, and cross-platform entitlements.
 * See docs/REVENUECAT-SETUP.md for the full dashboard/store setup.
 *
 * SAFETY / OPT-IN:
 *   - Does NOTHING unless the `revenueCat` feature flag is on
 *     (EXPO_PUBLIC_USE_REVENUECAT=true) AND the SDK is installed AND a public
 *     API key is present. Off by default → today's build is unaffected.
 *   - The SDK is LAZY-REQUIRED so the module being absent (web, Expo Go, or a
 *     build where it failed to link) can never crash the app — every method
 *     fails soft. `react-native-purchases` (+ `-ui`) ARE in package.json; the
 *     lazy require is purely a crash-safety guard, not an install gate.
 *
 * ENTITLEMENTS (create these in the RevenueCat dashboard — see the guide):
 *   - `premium`      → DeepLife+ / lifetime  → subscriptionService.hasPremiumAccess()
 *   - `ads_removed`  → Remove Ads / any premium → settings.adsRemoved
 */
import { Platform } from 'react-native';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { logger } from '@/utils/logger';
import { appToStoreProductId, storeToAppProductId } from '@/lib/subscription/revenueCatProductMap';
import { isSubscriptionProduct } from '@/utils/iapConfig';

const log = logger.scope('RevenueCat');

/** Entitlement identifiers — MUST match the RevenueCat dashboard exactly. */
export const RC_ENTITLEMENT_PREMIUM = 'premium';
export const RC_ENTITLEMENT_ADS_REMOVED = 'ads_removed';
// The subscription / premium-access entitlement used by presentPaywall's gate.
// Defaults to `premium` to match the actual dashboard entitlement (see above);
// override with EXPO_PUBLIC_RC_ENTITLEMENT_PRO only if the dashboard uses a
// different name.
export const RC_ENTITLEMENT_PRO = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO || 'premium';

export interface RcEntitlements {
  /** Player owns Remove Ads / any premium tier → drive settings.adsRemoved. */
  adsRemoved: boolean;
  /** Player has DeepLife+ / lifetime premium → drive hasPremiumAccess(). */
  premium: boolean;
}

export interface RcPurchaseResult {
  success: boolean;
  /** Set on success — the fresh entitlements after the purchase. */
  entitlements?: RcEntitlements;
  /** Store transaction id (for exactly-once consumable grants). */
  transactionId?: string;
  /** True when the user cancelled the store sheet (not a real error). */
  cancelled?: boolean;
  message?: string;
}

// ── Lazy, crash-proof module load ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any | null = null;
let loadAttempted = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPurchases(): any | null {
  if (loadAttempted) return Purchases;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    Purchases = mod?.default ?? mod;
  } catch {
    // Not installed / web / Expo Go — stay null and fail soft.
    Purchases = null;
  }
  return Purchases;
}

function apiKey(): string | undefined {
  const platformKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
    android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  });
  // Fall back to a single cross-platform key (e.g. a RevenueCat Test Store key,
  // which is one key for both platforms).
  return platformKey || process.env.EXPO_PUBLIC_RC_API_KEY;
}

// react-native-purchases-ui (prebuilt Paywall + Customer Center). Lazy-required
// like the core SDK so its absence can never crash the app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PurchasesUI: any | null = null;
let uiLoadAttempted = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPurchasesUI(): any | null {
  if (uiLoadAttempted) return PurchasesUI;
  uiLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases-ui');
    PurchasesUI = mod?.default ?? mod;
  } catch {
    PurchasesUI = null;
  }
  return PurchasesUI;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readEntitlements(customerInfo: any): RcEntitlements {
  const active = customerInfo?.entitlements?.active ?? {};
  const premium = !!active[RC_ENTITLEMENT_PREMIUM] || !!active[RC_ENTITLEMENT_PRO];
  // Any premium tier is also ad-free, so treat premium as implying ads_removed
  // even if only the `premium` entitlement is attached to a given product.
  const adsRemoved = !!active[RC_ENTITLEMENT_ADS_REMOVED] || premium;
  return { adsRemoved, premium };
}

class RevenueCatService {
  private configured = false;
  // Last-known entitlements, kept in memory so synchronous callers
  // (`iapService.isAdsRemoved()`, `subscriptionService.hasPremiumAccess()`) can
  // OR them in without an await. Refreshed by every RC read/purchase/restore
  // and by the customer-info listener.
  private cache: RcEntitlements = { adsRemoved: false, premium: false };

  /** True when RevenueCat should be used in this build/session. */
  isEnabled(): boolean {
    return isFeatureEnabled('revenueCat') && Platform.OS !== 'web' && !!apiKey() && !!loadPurchases();
  }

  /** Synchronous last-known entitlements (never awaits; safe default false). */
  private everFetched = false;

  cachedEntitlements(): RcEntitlements {
    return this.cache;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cacheFrom(customerInfo: any): RcEntitlements {
    this.cache = readEntitlements(customerInfo);
    this.everFetched = true;
    return this.cache;
  }

  /**
   * True once entitlements have been read from the SDK at least once this
   * process. `getEntitlements()` returns all-false on ANY error (offline, SDK
   * not configured) WITHOUT touching the cache, so a false entitlement is
   * otherwise indistinguishable from "we could not ask" — and callers that
   * revoke on false would revoke a paid purchase for a player who happened to
   * launch offline. 2026-07-30 audit MON-1.
   */
  entitlementsEverFetched(): boolean {
    return this.everFetched;
  }

  /**
   * Configure the SDK once (idempotent). Safe to call before any purchase; it
   * self-configures on first use, so callers don't have to touch the boot path.
   * Returns true when RevenueCat is ready to use.
   */
  async configure(): Promise<boolean> {
    if (this.configured) return true;
    if (!this.isEnabled()) return false;
    try {
      const key = apiKey();
      const P = loadPurchases();
      if (__DEV__ && P.LOG_LEVEL?.DEBUG !== undefined) {
        try { P.setLogLevel(P.LOG_LEVEL.DEBUG); } catch { /* non-fatal */ }
      }
      P.configure({ apiKey: key });
      this.configured = true;
      log.info('configured');
      this.enableAppleAdsAttribution(P);
      return true;
    } catch (error) {
      log.warn('configure failed', { error });
      return false;
    }
  }

  /**
   * Ask the SDK to collect Apple's AdServices attribution token (iOS only).
   *
   * This is what joins an Apple Ads (App Store Ads) install to the revenue that
   * install later produces: RevenueCat exchanges the token with Apple within 24h
   * and every customer then carries their campaign / ad group. Without it, Apple
   * Ads reports installs and RevenueCat reports revenue and nothing connects the
   * two — see marketing/apple-ads/05-measurement-and-roi.md.
   *
   * AdServices does NOT require ATT consent for standard (campaign-level)
   * attribution, so this runs regardless of the tracking permission. The
   * RevenueCat dashboard's Apple Search Ads integration must also be enabled or
   * the collected token goes nowhere.
   *
   * Fire-and-forget and fully guarded: an older SDK without the method, a
   * rejected promise, or a throw must never affect a purchase flow.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private enableAppleAdsAttribution(P: any): void {
    if (Platform.OS !== 'ios') return;
    try {
      const enable = P?.enableAdServicesAttributionTokenCollection;
      if (typeof enable !== 'function') {
        log.info('AdServices attribution unavailable in this SDK version');
        return;
      }
      Promise.resolve(enable.call(P))
        .then(() => log.info('AdServices attribution token collection enabled'))
        .catch((error: unknown) => log.warn('AdServices attribution failed', { error }));
    } catch (error) {
      log.warn('AdServices attribution threw', { error });
    }
  }

  /** Current entitlements (all false if disabled / on any error). */
  async getEntitlements(): Promise<RcEntitlements> {
    if (!(await this.configure())) return { adsRemoved: false, premium: false };
    try {
      const info = await loadPurchases().getCustomerInfo();
      return this.cacheFrom(info);
    } catch (error) {
      log.warn('getEntitlements failed', { error });
      return { adsRemoved: false, premium: false };
    }
  }

  /**
   * The current offering (packages for the paywall — annual/monthly/lifetime).
   * Returns null when disabled or on error; callers fall back to static prices.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getCurrentOffering(): Promise<any | null> {
    if (!(await this.configure())) return null;
    try {
      const offerings = await loadPurchases().getOfferings();
      return offerings?.current ?? null;
    } catch (error) {
      log.warn('getOfferings failed', { error });
      return null;
    }
  }

  /** Purchase a package from an offering (subscriptions / lifetime). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async purchasePackage(pkg: any): Promise<RcPurchaseResult> {
    if (!(await this.configure())) return { success: false, message: 'Store unavailable.' };
    try {
      const { customerInfo, transaction } = await loadPurchases().purchasePackage(pkg);
      return {
        success: true,
        entitlements: this.cacheFrom(customerInfo),
        transactionId: transaction?.transactionIdentifier,
      };
    } catch (error) {
      return this.mapPurchaseError(error);
    }
  }

  /** Purchase a product by id — subscriptions, consumables, or non-consumables. */
  async purchaseProduct(productId: string): Promise<RcPurchaseResult> {
    if (!(await this.configure())) return { success: false, message: 'Store unavailable.' };
    try {
      // Translate the internal app id to the store product id at the RC boundary.
      const storeId = appToStoreProductId(productId);
      const P = loadPurchases();

      // ── Subscription products ────────────────────────────────────────────
      // Play Billing V5+ requires subscriptions to be purchased via
      // purchasePackage (offering/package context), NOT via the direct
      // purchaseStoreProduct call. Attempting the direct call on Android returns
      // a billing-unavailable error. Route all subscription SKUs through the
      // current offering; fall back to a direct subscription product fetch only
      // when the offering doesn't contain this SKU (e.g. a new product not yet
      // in the default offering).
      if (isSubscriptionProduct(productId)) {
        const offering = await this.getCurrentOffering();
        const pkg = offering?.availablePackages?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) =>
            p.storeProduct?.productIdentifier === storeId || p.identifier === storeId,
        );
        if (pkg) {
          // purchasePackage already handles the configure guard internally.
          return await this.purchasePackage(pkg);
        }
        // Fallback: product isn't in the current offering — fetch directly.
        const subCategory = P?.PRODUCT_CATEGORY?.SUBSCRIPTION;
        const subProducts = subCategory
          ? await P.getProducts([storeId], subCategory)
          : await P.getProducts([storeId]);
        if (!subProducts?.length) return { success: false, message: 'Product not found.' };
        const { customerInfo, transaction } = await P.purchaseStoreProduct(subProducts[0]);
        return {
          success: true,
          entitlements: this.cacheFrom(customerInfo),
          transactionId: transaction?.transactionIdentifier,
        };
      }

      // ── Non-subscription products (consumables / non-consumables) ─────────
      // On Android, getProducts defaults to the SUBSCRIPTION category and
      // returns an empty list for in-app products — query NON_SUBSCRIPTION
      // explicitly so the store returns these products.
      const nonSub = P?.PRODUCT_CATEGORY?.NON_SUBSCRIPTION;
      const products = nonSub
        ? await P.getProducts([storeId], nonSub)
        : await P.getProducts([storeId]);
      if (!products?.length) return { success: false, message: 'Product not found.' };
      const { customerInfo, transaction } = await P.purchaseStoreProduct(products[0]);
      return {
        success: true,
        entitlements: this.cacheFrom(customerInfo),
        transactionId: transaction?.transactionIdentifier,
      };
    } catch (error) {
      return this.mapPurchaseError(error);
    }
  }

  /**
   * Trial / introductory-offer eligibility for a subscription product.
   *
   * iOS/StoreKit returns a definitive per-user verdict; Android and every
   * disabled/error path return 'unknown' (Google doesn't expose per-user intro
   * eligibility, and Play enforces the real terms at checkout). Never throws —
   * the paywall uses this only to avoid promising a free trial the store won't
   * honor, so 'unknown' safely leaves the trial copy as-is.
   */
  async getIntroEligibility(appProductId: string): Promise<'eligible' | 'ineligible' | 'unknown'> {
    // Only iOS/StoreKit gives a per-user answer; skip the round-trip elsewhere.
    if (Platform.OS !== 'ios') return 'unknown';
    if (!(await this.configure())) return 'unknown';
    try {
      const storeId = appToStoreProductId(appProductId);
      const P = loadPurchases();
      const map = await P.checkTrialOrIntroductoryPriceEligibility([storeId]);
      // INTRO_ELIGIBILITY_STATUS: 0 unknown, 1 ineligible, 2 eligible,
      // 3 no-intro-offer-exists. Treat "no offer" as ineligible — there is no
      // trial to advertise — so the CTA doesn't claim a free trial that can't apply.
      const status = map?.[storeId]?.status;
      if (status === 2) return 'eligible';
      if (status === 1 || status === 3) return 'ineligible';
      return 'unknown';
    } catch (error) {
      log.warn('checkTrialOrIntroductoryPriceEligibility failed', { error });
      return 'unknown';
    }
  }

  /** Restore prior purchases; returns the restored entitlements. */
  async restore(): Promise<RcEntitlements> {
    if (!(await this.configure())) return { adsRemoved: false, premium: false };
    try {
      const info = await loadPurchases().restorePurchases();
      return this.cacheFrom(info);
    } catch (error) {
      log.warn('restore failed', { error });
      return { adsRemoved: false, premium: false };
    }
  }

  /**
   * Restore prior purchases and return every owned product as an APP product id
   * (store→app mapped). Lets IAPService re-apply the benefit for each restored
   * non-consumable (perks, remove-ads, lifetime unlocks) through its normal
   * grant path — not just the ads_removed / premium entitlements. Consumables
   * are included in the raw list but IAPService filters them out (it never
   * restores gems/money). Also refreshes the entitlement cache + listeners.
   */
  async restoreProductIds(): Promise<string[]> {
    if (!(await this.configure())) return [];
    try {
      const info = await loadPurchases().restorePurchases();
      this.cacheFrom(info);
      const storeIds: string[] = info?.allPurchasedProductIdentifiers ?? [];
      // De-dupe after mapping (an app id could map from more than one store id).
      return Array.from(new Set(storeIds.map((id) => storeToAppProductId(id))));
    } catch (error) {
      log.warn('restoreProductIds failed', { error });
      return [];
    }
  }

  /** True when the prebuilt RevenueCat Paywall UI is available in this build. */
  hasPaywallUI(): boolean {
    return this.isEnabled() && !!loadPurchasesUI()?.presentPaywallIfNeeded;
  }

  /**
   * Present RevenueCat's prebuilt Paywall (designed in the RC dashboard) — only
   * when the player lacks `requiredEntitlement`. Resolves true if they end up
   * entitled (purchased/restored). Refreshes the entitlement cache afterward.
   * No-op (returns false) when the UI package or a dashboard paywall is absent.
   */
  async presentPaywall(requiredEntitlement: string = RC_ENTITLEMENT_PRO): Promise<boolean> {
    if (!(await this.configure())) return false;
    const UI = loadPurchasesUI();
    if (!UI?.presentPaywallIfNeeded) return false;
    try {
      const result = await UI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: requiredEntitlement });
      await this.getEntitlements();
      // PAYWALL_RESULT.PURCHASED / RESTORED → the user is now entitled.
      return result === 'PURCHASED' || result === 'RESTORED';
    } catch (error) {
      log.warn('presentPaywall failed', { error });
      return false;
    }
  }

  /** Present RevenueCat's Customer Center (manage / cancel / restore / refund). */
  async presentCustomerCenter(): Promise<void> {
    if (!(await this.configure())) return;
    const UI = loadPurchasesUI();
    if (!UI?.presentCustomerCenter) return;
    try {
      await UI.presentCustomerCenter();
      await this.getEntitlements();
    } catch (error) {
      log.warn('presentCustomerCenter failed', { error });
    }
  }

  /**
   * Subscribe to live entitlement changes (renewals, expiry, cross-device
   * restores). Returns an unsubscribe function. No-op when disabled.
   */
  addEntitlementsListener(cb: (e: RcEntitlements) => void): () => void {
    if (!this.isEnabled()) return () => {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (info: any) => cb(this.cacheFrom(info));
      loadPurchases().addCustomerInfoUpdateListener(handler);
      return () => {
        try {
          loadPurchases().removeCustomerInfoUpdateListener(handler);
        } catch {
          /* ignore */
        }
      };
    } catch (error) {
      log.warn('addEntitlementsListener failed', { error });
      return () => {};
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapPurchaseError(error: any): RcPurchaseResult {
    if (error?.userCancelled) return { success: false, cancelled: true, message: 'Purchase cancelled.' };
    log.warn('purchase failed', { error });
    return { success: false, message: error?.message || 'Purchase could not be completed.' };
  }
}

export const revenueCatService = new RevenueCatService();
