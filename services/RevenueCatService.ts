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
 *   - The SDK is LAZY-REQUIRED so the module being absent (not yet installed,
 *     web, Expo Go) can never crash the app — every method fails soft.
 *   - `react-native-purchases` is intentionally NOT added to package.json here
 *     so current builds stay identical. Install it when you're ready with:
 *         npx expo install react-native-purchases
 *     (that picks the version matching your Expo SDK). Then set the keys +
 *     flip the flag.
 *
 * ENTITLEMENTS (create these in the RevenueCat dashboard — see the guide):
 *   - `premium`      → DeepLife+ / lifetime  → subscriptionService.hasPremiumAccess()
 *   - `ads_removed`  → Remove Ads / any premium → settings.adsRemoved
 */
import { Platform } from 'react-native';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { logger } from '@/utils/logger';

const log = logger.scope('RevenueCat');

/** Entitlement identifiers — MUST match the RevenueCat dashboard exactly. */
export const RC_ENTITLEMENT_PREMIUM = 'premium';
export const RC_ENTITLEMENT_ADS_REMOVED = 'ads_removed';

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
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
    android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readEntitlements(customerInfo: any): RcEntitlements {
  const active = customerInfo?.entitlements?.active ?? {};
  const premium = !!active[RC_ENTITLEMENT_PREMIUM];
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
  cachedEntitlements(): RcEntitlements {
    return this.cache;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cacheFrom(customerInfo: any): RcEntitlements {
    this.cache = readEntitlements(customerInfo);
    return this.cache;
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
      loadPurchases().configure({ apiKey: key });
      this.configured = true;
      log.info('configured');
      return true;
    } catch (error) {
      log.warn('configure failed', { error });
      return false;
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

  /** Purchase a raw product by id (consumables — gems / boosts). */
  async purchaseProduct(productId: string): Promise<RcPurchaseResult> {
    if (!(await this.configure())) return { success: false, message: 'Store unavailable.' };
    try {
      const products = await loadPurchases().getProducts([productId]);
      if (!products?.length) return { success: false, message: 'Product not found.' };
      const { customerInfo, transaction } = await loadPurchases().purchaseStoreProduct(products[0]);
      return {
        success: true,
        entitlements: this.cacheFrom(customerInfo),
        transactionId: transaction?.transactionIdentifier,
      };
    } catch (error) {
      return this.mapPurchaseError(error);
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
