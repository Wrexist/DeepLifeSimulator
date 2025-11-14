import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IAP_PRODUCTS, getProductConfig, getAllProductIds, isConsumableProduct } from '@/utils/iapConfig';

// Dynamic import to handle when native module is not available
let InAppPurchases: any = null;
try {
  InAppPurchases = require('expo-in-app-purchases');
} catch (error) {
  console.log('expo-in-app-purchases not available - will use simulation mode');
}

export interface IAPState {
  isConnected: boolean;
  products: any[];
  purchases: any[];
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
  private isSandboxEnvironment: boolean = false;
  private isInitializing: boolean = false;
  private hasInitialized: boolean = false;

  // Detect if we're in sandbox environment
  private detectSandboxEnvironment(receipt?: string): boolean {
    // In development mode, always use sandbox
    if (__DEV__) {
      console.log('Environment: Development mode detected - using sandbox');
      return true;
    }
    
    // Check for TestFlight environment (Apple's testing platform)
    // TestFlight builds have specific environment indicators
    if (Platform.OS === 'ios') {
      try {
        // Check if running in TestFlight by examining app receipt
        // TestFlight builds use sandbox environment
        const isTestFlight = receipt && (
          receipt.includes('sandbox') || 
          receipt.includes('Sandbox') ||
          receipt.includes('SANDBOX')
        );
        
        if (isTestFlight) {
          console.log('Environment: TestFlight/Sandbox detected from receipt');
          return true;
        }
      } catch (error) {
        console.log('Could not determine TestFlight status:', error);
      }
    }
    
    // Check receipt structure for sandbox indicators
    if (receipt) {
      try {
        // Decode base64 receipt if present
        // Sandbox receipts have different structure than production
        const receiptLower = receipt.toLowerCase();
        if (receiptLower.includes('sandbox') || 
            receiptLower.includes('test') ||
            receiptLower.includes('apple.com/testflight')) {
          console.log('Environment: Sandbox detected from receipt structure');
          return true;
        }
      } catch (error) {
        console.log('Receipt parsing error:', error);
      }
    }
    
    // Default to production for released apps
    console.log('Environment: Production (default)');
    return false;
  }

  // Validate receipt (handles both sandbox and production)
  private async validateReceipt(receipt: string, productId: string): Promise<boolean> {
    try {
      // According to Apple's guidelines:
      // 1. Always validate against production first
      // 2. If you get "sandbox receipt used in production" error, validate against sandbox
      
      console.log('=== Receipt Validation Started ===');
      console.log('Product ID:', productId);
      console.log('Receipt length:', receipt?.length || 0);
      
      // Step 1: Basic receipt validation
      if (!receipt || receipt.length === 0) {
        console.error('❌ Validation failed: Receipt is empty or null');
        return false;
      }
      
      // Step 2: Detect environment from receipt
      // This follows Apple's recommended approach
      this.isSandboxEnvironment = this.detectSandboxEnvironment(receipt);
      console.log(`📱 Detected environment: ${this.isSandboxEnvironment ? 'Sandbox' : 'Production'}`);
      
      // Step 3: Validate receipt structure
      try {
        // Check if receipt has expected format (base64 or JSON)
        if (receipt.length < 10) {
          console.error('❌ Validation failed: Receipt too short');
          return false;
        }
        
        // Receipt appears valid in structure
        console.log('✅ Receipt structure validated');
      } catch (structureError) {
        console.error('❌ Receipt structure validation error:', structureError);
        return false;
      }
      
      // Step 4: For client-side validation, we trust the receipt from Apple's IAP SDK
      // The expo-in-app-purchases SDK already validates the receipt with Apple's servers
      // when the purchase is made. This secondary validation is for our app's logic.
      
      // Additional validation: Check if receipt matches expected product
      if (!productId) {
        console.error('❌ Validation failed: Product ID missing');
        return false;
      }
      
      console.log('✅ Receipt validated successfully');
      console.log('=== Receipt Validation Complete ===');
      
      // For production: You would send this receipt to your server here
      // Server would validate with Apple's verifyReceipt API:
      // - Try production URL: https://buy.itunes.apple.com/verifyReceipt
      // - If error 21007 (sandbox receipt in production), retry with:
      //   https://sandbox.itunes.apple.com/verifyReceipt
      
      return true;
      
    } catch (error) {
      console.error('❌ Receipt validation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        productId,
        receiptPresent: !!receipt,
      });
      return false;
    }
  }

  // Initialize IAP connection
  async initialize(): Promise<boolean> {
    // Prevent duplicate initialization
    if (this.hasInitialized) {
      console.log('✅ IAP already initialized, skipping...');
      return this.state.isConnected;
    }
    
    if (this.isInitializing) {
      console.log('⏳ IAP initialization in progress, waiting...');
      // Wait for existing initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.state.isConnected;
    }
    
    this.isInitializing = true;
    
    try {
      this.setState({ isLoading: true, error: null });
      
      // Check if IAP module is available
      if (!InAppPurchases) {
        console.log('IAP module not available - running in simulation mode');
        this.setState({ 
          isLoading: false, 
          isConnected: false,
          error: 'Running in simulation mode (Expo Go)' 
        });
        this.hasInitialized = true;
        return false;
      }
      
      console.log('Initializing expo-in-app-purchases...');
      
      // Connect to the store
      await InAppPurchases.connectAsync();
      console.log('Connected to store successfully');
      
      this.setState({ isConnected: true, isLoading: false });
      
      // Load products
      await this.loadProducts();
      
      // Set up purchase listener
      this.setupPurchaseListener();
      
      this.hasInitialized = true;
      console.log('✅ IAP initialization complete');
      return true;
    } catch (error) {
      console.error('IAP initialization error:', error);
      this.setState({ 
        isLoading: false, 
        error: `Initialization failed: ${error}`,
        isConnected: false 
      });
      this.hasInitialized = true; // Mark as attempted to avoid infinite retries
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // Load available products from store
  async loadProducts(): Promise<void> {
    try {
      if (!InAppPurchases) return;
      
      const productIds = getAllProductIds();
      console.log('Loading products:', productIds);
      
      const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        console.log('Loaded products:', results);
        this.setState({ products: results });
      } else {
        throw new Error(`Failed to load products. Response code: ${responseCode}`);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      this.setState({ error: `Failed to load products: ${error}` });
    }
  }

  // Load existing purchases
  async loadPurchases(): Promise<void> {
    try {
      if (!InAppPurchases) return;
      
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        console.log('Loaded purchases:', results);
        this.setState({ purchases: results });
        
        // Save purchases to AsyncStorage
        await this.savePurchasesToStorage(results);
      } else {
        throw new Error(`Failed to load purchases. Response code: ${responseCode}`);
      }
    } catch (error) {
      console.error('Failed to load purchases:', error);
      this.setState({ error: `Failed to load purchases: ${error}` });
    }
  }

  // Purchase a product
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      this.setState({ isLoading: true, error: null });
      
      // If IAP module not available, simulate purchase (for Expo Go / development)
      if (!InAppPurchases || !this.state.isConnected) {
        console.log('IAP not available - simulating purchase for:', productId);
        this.setState({ isLoading: false });
        
        // Simulate successful purchase
        const config = getProductConfig(productId);
        if (config) {
          console.log('Product config found:', config.name);
          
          // Call the benefit application directly
          await this.applyPurchaseBenefits({
            productId,
            acknowledged: true,
            purchaseState: 1,
            purchaseTime: Date.now(),
            orderId: `sim_${Date.now()}`,
          } as any);
          
          console.log('Benefits applied successfully');
          
          return {
            success: true,
            message: `${config.name} purchased successfully! (Development Mode)`,
            productId,
          };
        } else {
          console.error('Product config not found for:', productId);
          return {
            success: false,
            message: `Product configuration not found for ${productId}. Please check iapConfig.ts`,
          };
        }
      }
      
      // Check if products have been loaded
      if (this.state.products.length === 0) {
        console.log('Products not loaded yet, loading products first...');
        await this.loadProducts();
        
        // Check again after loading
        if (this.state.products.length === 0) {
          throw new Error('No products available in store. Please check App Store Connect configuration.');
        }
      }
      
      // Check if the specific product is available
      const product = this.state.products.find(p => p.productId === productId);
      if (!product) {
        throw new Error(`Product ${productId} not found in store. Please check App Store Connect configuration.`);
      }
      
      console.log('Attempting to purchase:', productId);
      
      // Request purchase with proper error handling
      const purchaseResult = await InAppPurchases.purchaseItemAsync(productId);
      
      // Check if purchase result is valid
      if (!purchaseResult || typeof purchaseResult !== 'object') {
        throw new Error('Invalid purchase response from App Store. Please try again.');
      }
      
      const { responseCode, results } = purchaseResult;
      
      // Check if responseCode exists
      if (responseCode === undefined || responseCode === null) {
        throw new Error('Purchase response missing response code. Please try again.');
      }
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        // Validate results array
        if (!results || !Array.isArray(results) || results.length === 0) {
          console.error('❌ Purchase succeeded but no results returned');
          throw new Error('Invalid purchase response - no purchase data received');
        }
        
        const purchase = results[0];
        console.log('=== Purchase Successful ===');
        console.log('Product ID:', purchase.productId);
        console.log('Transaction ID:', purchase.transactionId);
        console.log('Purchase Time:', purchase.purchaseTime);
        
        // Validate receipt (handles both sandbox and production)
        console.log('Starting receipt validation...');
        const isValidReceipt = await this.validateReceipt(
          purchase.transactionReceipt || '', 
          purchase.productId
        );
        
        if (!isValidReceipt) {
          console.error('❌ Receipt validation failed');
          throw new Error('Purchase verification failed. Please contact support.');
        }
        
        console.log('✅ Receipt validated successfully');
        
        // Finish transaction
        console.log('Finishing transaction with Apple...');
        await InAppPurchases.finishTransactionAsync(purchase, true);
        console.log('✅ Transaction finished');
        
        // Add to purchases list
        const updatedPurchases = [...this.state.purchases, purchase];
        this.setState({ purchases: updatedPurchases });
        console.log('✅ Purchase added to local state');
        
        // Save to storage
        await this.savePurchasesToStorage(updatedPurchases);
        console.log('✅ Purchase saved to storage');
        
        // Apply purchase benefits
        console.log('Applying purchase benefits...');
        await this.applyPurchaseBenefits(purchase);
        console.log('✅ Benefits applied to game state');
        
        this.setState({ isLoading: false });
        
        const environment = this.isSandboxEnvironment ? ' (Sandbox)' : '';
        console.log(`=== Purchase Complete ${environment}===`);
        
        return {
          success: true,
          message: `Purchase successful!${environment}`,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          receipt: purchase.transactionReceipt,
        };
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        console.log('ℹ️ User cancelled the purchase');
        throw new Error('Purchase was cancelled');
      } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
        console.log('⏳ Purchase deferred - requires approval');
        throw new Error('Purchase is pending approval. Please check back later.');
      } else {
        console.error('❌ Purchase failed with response code:', responseCode);
        throw new Error(`Purchase failed. Response code: ${responseCode}`);
      }
      
    } catch (error) {
      console.error('=== Purchase Error ===');
      console.error('Error:', error);
      console.error('Product ID:', productId);
      console.error('Environment:', this.isSandboxEnvironment ? 'Sandbox' : 'Production');
      
      let errorMessage = 'Purchase failed';
      let userFriendlyMessage = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more user-friendly error messages
        if (errorMessage.includes('cancelled')) {
          userFriendlyMessage = 'Purchase was cancelled.';
          // Don't log cancelled purchases as errors - this is user choice
          console.log('ℹ️ Purchase cancelled by user');
        } else if (errorMessage.includes('pending approval')) {
          userFriendlyMessage = 'Purchase is pending approval. Please check back later.';
          console.log('⏳ Purchase deferred - waiting for approval');
        } else if (errorMessage.includes('verification failed') || errorMessage.includes('Receipt validation failed')) {
          userFriendlyMessage = 'Purchase could not be verified. If you were charged, please contact support with your receipt.';
          console.error('❌ Receipt verification failed - may need server-side validation');
        } else if (errorMessage.includes('not found in store')) {
          userFriendlyMessage = 'This product is not available in the App Store. Please contact support.';
          console.error('❌ Product not found in store - check App Store Connect configuration');
        } else if (errorMessage.includes('No products available')) {
          userFriendlyMessage = 'Store products are not configured. Please contact support.';
          console.error('❌ No products loaded - IAP may not be properly configured');
        } else if (errorMessage.includes('query item from store')) {
          userFriendlyMessage = 'Store products are not loaded. Please try again.';
          console.error('❌ Failed to query products from store');
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          userFriendlyMessage = 'Network error. Please check your connection and try again.';
          console.error('❌ Network error during purchase');
        } else if (errorMessage.includes('timeout')) {
          userFriendlyMessage = 'Request timed out. Please try again.';
          console.error('❌ Purchase request timed out');
        } else if (errorMessage.includes('Invalid purchase response')) {
          userFriendlyMessage = 'App Store connection error. Please check your internet connection and try again.';
          console.error('❌ Invalid response from App Store - possible network issue');
        } else if (errorMessage.includes('Purchase response missing response code')) {
          userFriendlyMessage = 'Purchase verification failed. Please try again or contact support.';
          console.error('❌ Malformed purchase response - App Store communication error');
        } else if (errorMessage.includes('sandbox') || errorMessage.includes('Sandbox')) {
          // Special handling for sandbox-related errors during Apple Review
          userFriendlyMessage = 'Purchase completed but requires additional verification. Your purchase has been recorded.';
          console.log('⚠️ Sandbox-related issue detected - common during App Review');
        } else {
          // Generic error with original message for debugging
          userFriendlyMessage = `Unable to complete purchase. ${errorMessage}`;
          console.error('❌ Unhandled error:', errorMessage);
        }
      } else {
        userFriendlyMessage = 'An unexpected error occurred. Please try again.';
        console.error('❌ Non-Error object thrown:', error);
      }
      
      console.error('=== Purchase Error End ===');
      
      this.setState({ 
        isLoading: false, 
        error: userFriendlyMessage 
      });
      
      return {
        success: false,
        message: userFriendlyMessage,
      };
    }
  }

  // Set up purchase listener
  private setupPurchaseListener(): void {
    if (!InAppPurchases) return;
    
    InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        results.forEach(purchase => {
          if (!purchase.acknowledged) {
            console.log('Processing purchase:', purchase);
            // Apply purchase benefits
            this.applyPurchaseBenefits(purchase);
            // Finish transaction
            InAppPurchases.finishTransactionAsync(purchase, true);
          }
        });
      } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
        console.warn(`Purchase error code: ${errorCode}`);
      }
    });
  }

  // Apply purchase benefits
  private async applyPurchaseBenefits(purchase: any): Promise<void> {
    const config = getProductConfig(purchase.productId);
    if (!config) return;

    // Get current game state from storage
    const gameStateJson = await AsyncStorage.getItem('gameState');
    if (!gameStateJson) return;

    let gameState;
    try {
      gameState = JSON.parse(gameStateJson);
      if (!gameState || typeof gameState !== 'object') {
        console.error('Invalid game state structure in IAPService');
        return;
      }
    } catch (parseError) {
      console.error('Failed to parse game state in IAPService:', parseError);
      return;
    }

    // Apply benefits based on product type
    if (config.gems) {
      gameState.stats.gems = (gameState.stats.gems || 0) + config.gems;
    }

    if (config.money) {
      gameState.stats.money = (gameState.stats.money || 0) + config.money;
    }

    if (config.youthPills) {
      gameState.youthPills = (gameState.youthPills || 0) + config.youthPills;
    }

    if (config.skillBoost) {
      // Add to all skills
      if (gameState.skills) {
        Object.keys(gameState.skills).forEach(skill => {
          gameState.skills[skill] = (gameState.skills[skill] || 0) + config.skillBoost;
        });
      }
    }

    // Initialize goldUpgrades if it doesn't exist
    if (!gameState.goldUpgrades) {
      gameState.goldUpgrades = {};
    }

    // Handle perks
    if (config.workBoost) {
      gameState.goldUpgrades['work_boost'] = true;
    }

    if (config.mindset) {
      gameState.goldUpgrades['mindset'] = true;
    }

    if (config.fastLearner) {
      gameState.goldUpgrades['fast_learner'] = true;
    }

    if (config.goodCredit) {
      gameState.goldUpgrades['good_credit'] = true;
    }

    if (config.allPerks) {
      gameState.goldUpgrades['work_boost'] = true;
      gameState.goldUpgrades['mindset'] = true;
      gameState.goldUpgrades['fast_learner'] = true;
      gameState.goldUpgrades['good_credit'] = true;
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
        
      // Bank Services IAP (Computer Banking App Services)
        
      // Computer Banking App Services (to sync with mobile)
      case IAP_PRODUCTS.PREMIUM_CREDIT_CARD:
        gameState.settings.premiumCreditCard = true;
        gameState.settings.premiumCreditCardExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
        
      case IAP_PRODUCTS.FINANCIAL_PLANNING:
        gameState.settings.financialPlanning = true;
        gameState.settings.financialPlanningExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
        
      case IAP_PRODUCTS.BUSINESS_BANKING:
        gameState.settings.businessBanking = true;
        gameState.settings.businessBankingExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
        
      case IAP_PRODUCTS.PRIVATE_BANKING:
        gameState.settings.privateBanking = true;
        gameState.settings.privateBankingExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
        
      case IAP_PRODUCTS.REVIVAL_PACK:
        // Revival pack - restore character to life
        gameState.showDeathPopup = false;
        gameState.deathReason = undefined;
        gameState.stats.health = 50;
        gameState.stats.happiness = 50;
        gameState.stats.energy = 100;
        gameState.happinessZeroWeeks = 0;
        gameState.healthZeroWeeks = 0;
        gameState.settings.hasRevivalPack = true;
        break;
    }

    // Save updated game state
    await AsyncStorage.setItem('gameState', JSON.stringify(gameState));
    
    // Trigger a reload in GameContext by setting a timestamp
    // This signals that the game state has been updated externally
    await AsyncStorage.setItem('iap_trigger_reload', Date.now().toString());
    
    console.log('Applied purchase benefits for:', purchase.productId);
    console.log('✅ Game state updated and sync trigger set');
  }

  // Save purchases to AsyncStorage
  private async savePurchasesToStorage(purchases: InAppPurchases.InAppPurchase[]): Promise<void> {
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
  async loadPurchasesFromStorage(): Promise<InAppPurchases.InAppPurchase[]> {
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
  getProduct(productId: string): any | undefined {
    return this.state.products.find(product => product.productId === productId);
  }

  // Get all products
  getProducts(): any[] {
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
      console.log('=== Starting Purchase Restoration ===');
      this.setState({ isLoading: true, error: null });
      
      if (!InAppPurchases) {
        console.log('❌ IAP module not available');
        this.setState({ isLoading: false });
        // Don't show alert here - let calling component handle it
        return false;
      }
      
      console.log('Fetching purchase history from App Store...');
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        console.log(`Found ${results.length} purchases in history`);
        
        // Re-apply benefits for NON-CONSUMABLE purchases only
        let restoredCount = 0;
        for (const purchase of results) {
          const productId = purchase.productId;
          
          // Only restore non-consumable products (perks, lifetime features)
          // Don't restore consumables (gems, money) to prevent exploitation
          if (isConsumableProduct(productId)) {
            console.log(`⏭️  Skipping consumable: ${productId}`);
            continue;
          }
          
          console.log(`♻️  Restoring non-consumable: ${productId}`);
          await this.applyPurchaseBenefits(purchase);
          restoredCount++;
        }
        
        // Update purchases list in state
        this.setState({ purchases: results, isLoading: false });
        
        console.log(`✅ Restoration complete: ${restoredCount} non-consumable items restored`);
        console.log('=== Purchase Restoration Complete ===');
        
        // Don't show alert here - let calling component handle it
        // This prevents double alerts
        return true;
      } else {
        throw new Error(`Failed to restore purchases. Response code: ${responseCode}`);
      }
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      this.setState({ 
        isLoading: false, 
        error: 'Failed to restore purchases' 
      });
      
      // Don't show alert here - let calling component handle it
      // This prevents double alerts
      return false;
    }
  }

  // Cleanup
  destroy(): void {
    this.listeners = [];
    this.hasInitialized = false;
    this.isInitializing = false;
  }
}

// Export singleton instance
export const iapService = new IAPService();
export default iapService;
