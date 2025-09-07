import {
  initConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  Product,
  Purchase,
  SubscriptionPurchase,
  ProductPurchase,
  PurchaseError,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IAP_PRODUCTS, getProductConfig, getAllProductIds } from '@/utils/iapConfig';

export interface IAPState {
  isConnected: boolean;
  products: Product[];
  purchases: Purchase[];
  isLoading: boolean;
  error: string | null;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  productId?: string;
  transactionId?: string;
  receipt?: string;
}

class IAPService {
  private state: IAPState = {
    isConnected: false,
    products: [],
    purchases: [],
    isLoading: false,
    error: null,
  };

  private listeners: ((state: IAPState) => void)[] = [];

  // Initialize IAP connection
  async initialize(): Promise<boolean> {
    try {
      this.setState({ isLoading: true, error: null });
      
      // Initialize connection
      const result = await initConnection();
      console.log('IAP Connection result:', result);
      
      if (result) {
        this.setState({ isConnected: true });
        
        // Load products
        await this.loadProducts();
        
        // Load existing purchases
        await this.loadPurchases();
        
        this.setState({ isLoading: false });
        return true;
      } else {
        this.setState({ 
          isLoading: false, 
          error: 'Failed to connect to store' 
        });
        return false;
      }
    } catch (error) {
      console.error('IAP initialization error:', error);
      this.setState({ 
        isLoading: false, 
        error: `Initialization failed: ${error}` 
      });
      return false;
    }
  }

  // Load available products from store
  async loadProducts(): Promise<void> {
    try {
      const productIds = getAllProductIds();
      console.log('Loading products:', productIds);
      
      const products = await getProducts({ skus: productIds });
      console.log('Loaded products:', products);
      
      this.setState({ products });
    } catch (error) {
      console.error('Failed to load products:', error);
      this.setState({ error: `Failed to load products: ${error}` });
    }
  }

  // Load existing purchases
  async loadPurchases(): Promise<void> {
    try {
      const purchases = await getAvailablePurchases();
      console.log('Loaded purchases:', purchases);
      
      this.setState({ purchases });
      
      // Save purchases to AsyncStorage
      await this.savePurchasesToStorage(purchases);
    } catch (error) {
      console.error('Failed to load purchases:', error);
      this.setState({ error: `Failed to load purchases: ${error}` });
    }
  }

  // Purchase a product
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      this.setState({ isLoading: true, error: null });
      
      console.log('Attempting to purchase:', productId);
      
      // Request purchase
      const purchase = await requestPurchase({
        sku: productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });
      
      console.log('Purchase result:', purchase);
      
      // Finish transaction
      await this.finishTransaction(purchase);
      
      // Add to purchases list
      const updatedPurchases = [...this.state.purchases, purchase];
      this.setState({ purchases: updatedPurchases });
      
      // Save to storage
      await this.savePurchasesToStorage(updatedPurchases);
      
      // Apply purchase benefits
      await this.applyPurchaseBenefits(purchase);
      
      this.setState({ isLoading: false });
      
      return {
        success: true,
        message: 'Purchase successful!',
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        receipt: purchase.transactionReceipt,
      };
      
    } catch (error) {
      console.error('Purchase error:', error);
      
      let errorMessage = 'Purchase failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      this.setState({ 
        isLoading: false, 
        error: errorMessage 
      });
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  // Finish transaction
  private async finishTransaction(purchase: Purchase): Promise<void> {
    try {
      await finishTransaction({
        purchase,
        isConsumable: this.isConsumableProduct(purchase.productId),
      });
      console.log('Transaction finished:', purchase.transactionId);
    } catch (error) {
      console.error('Failed to finish transaction:', error);
      throw error;
    }
  }

  // Check if product is consumable
  private isConsumableProduct(productId: string): boolean {
    const config = getProductConfig(productId);
    return !!(config?.gems || config?.money || config?.duration);
  }

  // Apply purchase benefits
  private async applyPurchaseBenefits(purchase: Purchase): Promise<void> {
    const config = getProductConfig(purchase.productId);
    if (!config) return;

    // Get current game state from storage
    const gameStateJson = await AsyncStorage.getItem('gameState');
    if (!gameStateJson) return;

    const gameState = JSON.parse(gameStateJson);

    // Apply benefits based on product type
    if (config.gems) {
      gameState.stats.gems = (gameState.stats.gems || 0) + config.gems;
    }

    if (config.money) {
      gameState.stats.money = (gameState.stats.money || 0) + config.money;
    }

    // Handle special products
    switch (purchase.productId) {
      case IAP_PRODUCTS.REMOVE_ADS:
        gameState.settings.adsRemoved = true;
        gameState.settings.adsRemovedDate = new Date().toISOString();
        break;
        
      case IAP_PRODUCTS.PREMIUM_PASS:
        gameState.settings.premiumPass = true;
        gameState.settings.premiumPassExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
        
      case IAP_PRODUCTS.DOUBLE_MONEY:
        gameState.settings.doubleMoney = true;
        gameState.settings.doubleMoneyExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
        
      case IAP_PRODUCTS.UNLIMITED_ENERGY:
        gameState.settings.unlimitedEnergy = true;
        gameState.settings.unlimitedEnergyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        break;
    }

    // Save updated game state
    await AsyncStorage.setItem('gameState', JSON.stringify(gameState));
    
    console.log('Applied purchase benefits for:', purchase.productId);
  }

  // Save purchases to AsyncStorage
  private async savePurchasesToStorage(purchases: Purchase[]): Promise<void> {
    try {
      const purchasesData = purchases.map(purchase => ({
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        purchaseTime: purchase.purchaseTime,
        transactionReceipt: purchase.transactionReceipt,
      }));
      
      await AsyncStorage.setItem('iap_purchases', JSON.stringify(purchasesData));
    } catch (error) {
      console.error('Failed to save purchases to storage:', error);
    }
  }

  // Load purchases from AsyncStorage
  async loadPurchasesFromStorage(): Promise<Purchase[]> {
    try {
      const purchasesJson = await AsyncStorage.getItem('iap_purchases');
      if (purchasesJson) {
        return JSON.parse(purchasesJson);
      }
      return [];
    } catch (error) {
      console.error('Failed to load purchases from storage:', error);
      return [];
    }
  }

  // Check if user has purchased a specific product
  hasPurchased(productId: string): boolean {
    return this.state.purchases.some(purchase => purchase.productId === productId);
  }

  // Check if ads are removed
  isAdsRemoved(): boolean {
    return this.hasPurchased(IAP_PRODUCTS.REMOVE_ADS);
  }

  // Check if premium pass is active
  isPremiumPassActive(): boolean {
    const purchase = this.state.purchases.find(p => p.productId === IAP_PRODUCTS.PREMIUM_PASS);
    if (!purchase) return false;
    
    // Check if 30 days have passed since purchase
    const purchaseDate = new Date(purchase.purchaseTime);
    const expiryDate = new Date(purchaseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return new Date() < expiryDate;
  }

  // Get product by ID
  getProduct(productId: string): Product | undefined {
    return this.state.products.find(product => product.productId === productId);
  }

  // Get all products
  getProducts(): Product[] {
    return this.state.products;
  }

  // Get state
  getState(): IAPState {
    return { ...this.state };
  }

  // Set state and notify listeners
  private setState(updates: Partial<IAPState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  // Add state change listener
  addListener(listener: (state: IAPState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  // Restore purchases
  async restorePurchases(): Promise<boolean> {
    try {
      this.setState({ isLoading: true, error: null });
      
      await this.loadPurchases();
      
      this.setState({ isLoading: false });
      
      Alert.alert(
        'Purchases Restored',
        'Your previous purchases have been restored successfully!'
      );
      
      return true;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      this.setState({ 
        isLoading: false, 
        error: 'Failed to restore purchases' 
      });
      
      Alert.alert(
        'Restore Failed',
        'Failed to restore purchases. Please try again.'
      );
      
      return false;
    }
  }

  // Validate receipt (for server-side validation)
  async validateReceipt(receipt: string, productId: string): Promise<boolean> {
    // This would typically involve sending the receipt to your server
    // for validation with Apple/Google servers
    console.log('Validating receipt for:', productId);
    
    // For now, we'll just return true
    // In production, implement proper server-side validation
    return true;
  }

  // Cleanup
  destroy(): void {
    this.listeners = [];
  }
}

// Export singleton instance
export const iapService = new IAPService();
export default iapService;
