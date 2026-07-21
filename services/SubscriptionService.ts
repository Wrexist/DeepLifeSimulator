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
   * Sync subscriptions with IAP service
   */
  private async syncSubscriptions(): Promise<void> {
    const subscriptionProductIds = Object.values(SUBSCRIPTION_PRODUCTS);

    for (const productId of subscriptionProductIds) {
      const productConfig = getProductConfig(productId);
      const hasPurchased = iapService.hasPurchased(productId);
      
      if (hasPurchased) {
        const subscription: Subscription = {
          productId: productId,
          name: productConfig?.name || productId,
          isActive: true,
          autoRenew: true,
          isTrial: false,
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
    const tier = this.getSubscriptionTier();
    
    const featureTiers: Record<string, SubscriptionTier[]> = {
      'ad_free': ['premium', 'ultimate'],
      'unlimited_saves': ['premium', 'ultimate'],
      'cloud_sync': ['premium', 'ultimate'],
      'premium_themes': ['premium', 'ultimate'],
      'advanced_analytics': ['ultimate'],
      'priority_support': ['ultimate'],
      'early_access': ['ultimate'],
    };

    const requiredTiers = featureTiers[feature] || [];
    return requiredTiers.includes(tier);
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

