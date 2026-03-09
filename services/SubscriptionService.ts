import { Platform, Linking } from 'react-native';
import { iapService } from './IAPService';
import { SUBSCRIPTION_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
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

  private constructor() {
    this._initialized = this.loadSubscriptions();
    this.initializeIAPListeners();
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
    iapService.addListener((_state) => {
      this.syncSubscriptions();
    });
  }

  /**
   * Load subscriptions from storage
   */
  private async loadSubscriptions(): Promise<void> {
    try {
      const data = await safeGetItem('subscriptions');
      if (data) {
        const parsed = JSON.parse(data);
        this.subscriptions = new Map(parsed);
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

