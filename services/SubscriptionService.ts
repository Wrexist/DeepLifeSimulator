import { iapService } from './IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  private constructor() {
    this.loadSubscriptions();
    this.initializeIAPListeners();
  }

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Initialize IAP service listeners
   */
  private initializeIAPListeners(): void {
    iapService.addListener((state) => {
      this.syncSubscriptions();
    });
  }

  /**
   * Load subscriptions from storage
   */
  private async loadSubscriptions(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('subscriptions');
      if (data) {
        const parsed = JSON.parse(data);
        this.subscriptions = new Map(parsed);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load subscriptions:', error);
      }
    }
  }

  /**
   * Save subscriptions to storage
   */
  private async saveSubscriptions(): Promise<void> {
    try {
      const data = Array.from(this.subscriptions.entries());
      await AsyncStorage.setItem('subscriptions', JSON.stringify(data));
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save subscriptions:', error);
      }
    }
  }

  /**
   * Sync subscriptions with IAP service
   */
  private async syncSubscriptions(): Promise<void> {
    const subscriptionProducts = Object.values(IAP_PRODUCTS).filter(
      product => product.type === 'subscription'
    );

    for (const product of subscriptionProducts) {
      const hasPurchased = iapService.hasPurchased(product.id);
      
      if (hasPurchased) {
        const subscription: Subscription = {
          productId: product.id,
          name: product.name,
          isActive: true,
          autoRenew: true,
          isTrial: false,
        };

        this.subscriptions.set(product.id, subscription);
      } else {
        // Check if subscription expired
        const existing = this.subscriptions.get(product.id);
        if (existing && existing.isActive) {
          existing.isActive = false;
          this.subscriptions.set(product.id, existing);
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

    // Check for ultimate tier
    const hasUltimate = activeSubs.some(sub => 
      sub.productId.includes('ultimate') || sub.productId.includes('premium_plus')
    );
    
    if (hasUltimate) {
      return 'ultimate';
    }

    // Check for premium tier
    const hasPremium = activeSubs.some(sub => 
      sub.productId.includes('premium') || sub.productId.includes('subscription')
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
        console.error('Failed to restore subscriptions:', error);
      }
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(productId: string): Promise<void> {
    const subscription = this.subscriptions.get(productId);
    if (subscription) {
      subscription.autoRenew = false;
      this.subscriptions.set(productId, subscription);
      await this.saveSubscriptions();
      this.notifyListeners();
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
          console.error('Error in subscription listener:', error);
        }
      }
    });
  }
}

export const subscriptionService = SubscriptionService.getInstance();
export default subscriptionService;

