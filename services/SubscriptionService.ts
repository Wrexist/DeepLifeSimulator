import { Platform, Linking } from 'react-native';
import { iapService } from './IAPService';
import { revenueCatService } from './RevenueCatService';
import { SUBSCRIPTION_PRODUCTS, IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { safeSetItem, safeGetItem } from '@/utils/safeStorage';
import { logger } from '@/utils/logger';
import { SUBSCRIPTION_MANAGE_URL_IOS, SUBSCRIPTION_MANAGE_URL_ANDROID } from '@/lib/config/appConfig';

export interface Subscription {
  productId: string;
  name: string;
  isActive: boolean;
  expiresAt?: number;
  autoRenew: boolean;
  trialEndsAt?: number;
  isTrial: boolean;
}

export type SubscriptionTier = 'free' | 'premium' | 'ultimate';


/** Days in a subscription term, matching what IAPService stamps at purchase. */
const SUBSCRIPTION_TERM_DAYS = { monthly: 30, yearly: 365 } as const;

/**
 * End of a subscription's paid term, in epoch ms — or `undefined` when unknown.
 *
 * `syncSubscriptions` used to mark a subscription active purely because the
 * product was present in `iapService.hasPurchased(...)`. That reads the
 * purchase LEDGER, which `restorePurchases` fills from
 * `getPurchaseHistoryAsync()` — purchase history, including subscriptions that
 * expired or were cancelled long ago. `Subscription.expiresAt` was declared and
 * never assigned or read. So a lapsed subscriber tapped Restore Purchases and
 * had the full premium tier restored indefinitely, for free, on any build
 * without RevenueCat keys (which includes the `preview` EAS profile).
 * 2026-07-30 audit MON-3.
 *
 * Returns `undefined` when the record carries no usable timestamp. Callers must
 * treat that as "unknown", NOT as "expired" — revoking on a missing timestamp
 * would strip a paying subscriber's access, the same failure mode as MON-1.
 */
export function subscriptionExpiryFor(
  productId: string,
  purchaseTime: number | undefined,
): number | undefined {
  const purchasedAt = Number(purchaseTime);
  if (!Number.isFinite(purchasedAt) || purchasedAt <= 0) return undefined;
  const termDays = /yearly|annual/i.test(productId)
    ? SUBSCRIPTION_TERM_DAYS.yearly
    : SUBSCRIPTION_TERM_DAYS.monthly;
  return purchasedAt + termDays * 24 * 60 * 60 * 1000;
}

/** Is a subscription with this expiry still live at `now`? Unknown expiry = yes. */
export function isSubscriptionActiveAt(expiresAt: number | undefined, now: number): boolean {
  return expiresAt === undefined || now < expiresAt;
}

class SubscriptionService {
  private static instance: SubscriptionService;
  private subscriptions: Map<string, Subscription> = new Map();
  private listeners: ((subscriptions: Subscription[]) => void)[] = [];
  private _initialized: Promise<void>;
  // R3-F: capture the unsubscribe so we can release the iapService listener.
  private unsubscribeIAP?: () => void;

  private constructor() {
    this._initialized = this.loadSubscriptions();
    this.initializeIAPListeners();
  }

  /** Tear down listeners. Useful for tests + hot-reload. */
  dispose(): void {
    if (this.unsubscribeIAP) {
      this.unsubscribeIAP();
      this.unsubscribeIAP = undefined;
    }
  }

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Wait for subscription data to finish loading from storage.
   * Call this before checking subscription status at startup.
   */
  async waitForInitialization(): Promise<void> {
    await this._initialized;
  }

  /**
   * Initialize IAP service listeners
   */
  private initializeIAPListeners(): void {
    const result = iapService.addListener((_state) => {
      this.syncSubscriptions();
    });
    if (typeof result === 'function') {
      this.unsubscribeIAP = result;
    }
  }

  /**
   * Load subscriptions from storage
   */
  private async loadSubscriptions(): Promise<void> {
    try {
      const data = await safeGetItem('subscriptions');
      if (data) {
        const parsed = JSON.parse(data);
        // Validate the shape before constructing the Map — storage drift to a
        // non-entry shape would otherwise throw and break init.
        if (
          Array.isArray(parsed) &&
          parsed.every((entry) => Array.isArray(entry) && entry.length === 2)
        ) {
          this.subscriptions = new Map(parsed);
        } else {
          this.subscriptions = new Map();
        }
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to load subscriptions:', error);
      }
    }
  }

  /**
   * Save subscriptions to storage
   */
  private async saveSubscriptions(): Promise<void> {
    try {
      const data = Array.from(this.subscriptions.entries());
      await safeSetItem('subscriptions', JSON.stringify(data));
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to save subscriptions:', error);
      }
    }
  }

  /**
   * When does this subscription's paid term end, given the ledger?
   *
   * Thin wrapper over the pure `subscriptionExpiryFor` so the term rule can be
   * tested without standing up this singleton.
   */
  private subscriptionExpiryForProduct(productId: string): number | undefined {
    const record = typeof iapService.getLatestPurchase === 'function'
      ? iapService.getLatestPurchase(productId)
      : null;
    return subscriptionExpiryFor(productId, record?.purchaseTime);
  }

  /**
   * Sync subscriptions with IAP service
   */
  private async syncSubscriptions(): Promise<void> {
    const subscriptionProductIds = Object.values(SUBSCRIPTION_PRODUCTS);

    for (const productId of subscriptionProductIds) {
      const productConfig = getProductConfig(productId);
      const hasPurchased = iapService.hasPurchased(productId);

      if (hasPurchased) {
        // ENFORCE THE TERM. `isActive` used to be `true` purely because the
        // product appeared in `iapService.hasPurchased(...)` — which reads
        // `state.purchases`, filled by `restorePurchases` from
        // `getPurchaseHistoryAsync()`. That is purchase HISTORY: it lists
        // subscriptions that expired or were cancelled long ago. `expiresAt`
        // was declared on the Subscription type and never assigned or read
        // anywhere in the repo.
        //
        // So a lapsed subscriber tapped Restore Purchases and got the whole
        // premium tier back indefinitely — ad-free, the Legacy Pass premium
        // track, +25% career income, the 250/day gem drop instead of 20, and
        // 20% off gem upgrades — without paying. `syncSubscriptions` re-runs on
        // every iapService state change, so one Restore was enough.
        //
        // This path is live in any build without RevenueCat keys, which
        // includes the `preview` EAS profile. 2026-07-30 audit MON-3.
        const expiresAt = this.subscriptionExpiryForProduct(productId);
        const stillActive = isSubscriptionActiveAt(expiresAt, Date.now());

        const subscription: Subscription = {
          productId: productId,
          name: productConfig?.name || productId,
          isActive: stillActive,
          autoRenew: true,
          isTrial: false,
          expiresAt,
        };

        this.subscriptions.set(productId, subscription);
      } else {
        // Check if subscription expired
        const existing = this.subscriptions.get(productId);
        if (existing && existing.isActive) {
          existing.isActive = false;
          this.subscriptions.set(productId, existing);
        }
      }
    }

    await this.saveSubscriptions();
    this.notifyListeners();
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  /**
   * Get subscription by product ID
   */
  getSubscription(productId: string): Subscription | undefined {
    return this.subscriptions.get(productId);
  }

  /**
   * Check if user has active subscription
   */
  hasActiveSubscription(): boolean {
    return this.getActiveSubscriptions().length > 0;
  }

  /**
   * Get current subscription tier
   */
  getSubscriptionTier(): SubscriptionTier {
    // When RevenueCat drives billing it is the single authoritative source for
    // the subscription tier, so every gate agrees. We deliberately do NOT fall
    // back to the local auto-renewing records here — they can be stale once RC
    // owns billing. The one-time lifetime unlock is a separate migration path,
    // honored via hasLifetimePremium() / hasPremiumAccess(), not this method.
    if (revenueCatService.isEnabled()) {
      return revenueCatService.cachedEntitlements().premium ? 'premium' : 'free';
    }

    const activeSubs = this.getActiveSubscriptions();

    if (activeSubs.length === 0) {
      return 'free';
    }

    // Check for premium tier using actual product IDs
    const hasPremium = activeSubs.some(sub =>
      sub.productId.includes('deeplife_premium')
    );

    if (hasPremium) {
      return 'premium';
    }

    return 'free';
  }

  /**
   * True if the player owns the one-time "Lifetime Premium" unlock (a
   * non-consumable IAP, tracked in the purchase ledger rather than as a
   * subscription).
   */
  hasLifetimePremium(): boolean {
    return iapService.hasPurchased(IAP_PRODUCTS.LIFETIME_PREMIUM);
  }

  /**
   * The single question every premium gate should ask: does this player have
   * premium access RIGHT NOW — via an active auto-renewing subscription OR the
   * one-time lifetime unlock? Both routes grant the same entitlements (Legacy
   * Pass premium track, ad-free, exclusive cosmetics).
   */
  hasPremiumAccess(): boolean {
    // When RevenueCat drives entitlements, its cached `premium` is authoritative
    // alongside the local subscription/lifetime state.
    if (revenueCatService.isEnabled() && revenueCatService.cachedEntitlements().premium) {
      return true;
    }
    return this.getSubscriptionTier() !== 'free' || this.hasLifetimePremium();
  }

  /**
   * Check if feature is available for current tier
   */
  hasFeature(feature: string): boolean {
    // Premium-tier features derive from hasPremiumAccess() so they agree with
    // every other premium gate — RevenueCat entitlement, an active subscription,
    // OR the one-time lifetime unlock all grant them. Ultimate-only features
    // still require the explicit 'ultimate' tier.
    const premiumFeatures = new Set([
      'ad_free',
      'unlimited_saves',
      'cloud_sync',
      'premium_themes',
    ]);
    if (premiumFeatures.has(feature)) {
      return this.hasPremiumAccess();
    }

    const ultimateFeatures = new Set([
      'advanced_analytics',
      'priority_support',
      'early_access',
    ]);
    if (ultimateFeatures.has(feature)) {
      return this.getSubscriptionTier() === 'ultimate';
    }

    return false;
  }

  /**
   * Purchase subscription
   */
  async purchaseSubscription(productId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await iapService.purchaseProduct(productId);
      
      if (result.success) {
        await this.syncSubscriptions();
        return { success: true, message: 'Subscription activated successfully!' };
      }
      
      return { success: false, message: result.message || 'Purchase failed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Purchase premium via EITHER path: an auto-renewing subscription
   * (deeplife_premium_monthly / _yearly) OR the one-time lifetime unlock
   * (deeplife_lifetime_premium). Both flow through the same store purchase; we
   * then re-sync so `hasPremiumAccess()` reflects the new entitlement. Callers
   * don't need to know which kind they bought.
   */
  async purchasePremium(productId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await iapService.purchaseProduct(productId);
      if (result.success) {
        // Refresh subscription state (no-op for the one-time unlock, which is
        // tracked in the IAP purchase ledger and read via hasLifetimePremium()).
        await this.syncSubscriptions();
        const lifetime = productId === IAP_PRODUCTS.LIFETIME_PREMIUM;
        return {
          success: true,
          message: lifetime
            ? 'Premium unlocked forever — thank you!'
            : 'Subscription activated successfully!',
        };
      }
      return { success: false, message: result.message || 'Purchase failed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Restore subscriptions
   */
  async restoreSubscriptions(): Promise<void> {
    try {
      await iapService.restorePurchases();
      await this.syncSubscriptions();
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to restore subscriptions:', error);
      }
    }
  }

  /**
   * Cancel subscription — opens platform subscription management
   * Apple/Google control subscription renewal; the app cannot cancel directly.
   */
  async cancelSubscription(_productId: string): Promise<void> {
    const url = Platform.select({
      ios: SUBSCRIPTION_MANAGE_URL_IOS,
      android: SUBSCRIPTION_MANAGE_URL_ANDROID,
    });

    if (url) {
      await Linking.openURL(url);
    }
  }

  /**
   * Add subscription listener
   */
  addListener(listener: (subscriptions: Subscription[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const subscriptions = Array.from(this.subscriptions.values());
    this.listeners.forEach(listener => {
      try {
        listener(subscriptions);
      } catch (error) {
        if (__DEV__) {
          logger.error('Error in subscription listener:', error);
        }
      }
    });
  }
}

export const subscriptionService = SubscriptionService.getInstance();
export default subscriptionService;

