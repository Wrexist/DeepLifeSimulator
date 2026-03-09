import { Platform } from 'react-native';
import { IAP_PRODUCTS, getProductConfig, getAllProductIds, isConsumableProduct } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';
import { safeSetItem, safeGetItem } from '@/utils/safeStorage';

// CRITICAL: Do NOT create logger scope here - logger may not be initialized yet
// This module is imported at app startup before UI renders

// Lazy-load native module - do NOT require at module load time
// This prevents crashes if the native module fails to initialize
let InAppPurchases: any = null;
let inAppPurchasesLoadAttempts = 0;
const MAX_IAP_LOAD_ATTEMPTS = 3;
const IAP_VERIFY_URL = process.env.EXPO_PUBLIC_IAP_VERIFY_URL;
const IAP_VERIFY_TOKEN = process.env.EXPO_PUBLIC_IAP_VERIFY_TOKEN;
const IAP_VERIFY_TIMEOUT_MS = 8000;
const PROCESSED_IAP_TRANSACTIONS_KEY = 'iap_processed_transactions';
const MAX_PROCESSED_IAP_TRANSACTIONS = 2000;
const TRUSTED_PERMANENT_PERKS_KEY = 'permanent_perks_v2';
const LEGACY_PERMANENT_PERKS_KEY = 'permanent_perks';
const ALLOW_LEGACY_LOCAL_ENTITLEMENTS =
  __DEV__ || process.env.EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS === 'true';

function loadInAppPurchasesModule(): boolean {
  if (InAppPurchases !== null) {
    return true;
  }

  if (inAppPurchasesLoadAttempts >= MAX_IAP_LOAD_ATTEMPTS) {
    return false;
  }

  inAppPurchasesLoadAttempts++;

  try {
    InAppPurchases = require('expo-in-app-purchases');
    return true;
  } catch (error) {
    // Module not available - will retry on next call (up to MAX_IAP_LOAD_ATTEMPTS)
    return false;
  }
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

export class IAPService {
  private state: IAPState = {
    isConnected: false,
    products: [],
    purchases: [],
    isLoading: false,
    error: null,
  };

  private listeners: ((state: IAPState) => void)[] = [];
  private isSandboxEnvironment: boolean = false;
  // CRASH FIX (A-2): In-memory lock to prevent concurrent processing of same transaction
  private processingTransactions: Set<string> = new Set();
  private isInitializing: boolean = false;
  private hasInitialized: boolean = false;

  private static sanitizePermanentPerkList(perks: unknown): string[] {
    if (!Array.isArray(perks)) return [];
    return Array.from(
      new Set(
        perks
          .filter((perk): perk is string => typeof perk === 'string')
          .map(perk => perk.trim())
          .filter(perk => perk.length > 0)
      )
    );
  }

  private static async persistPermanentPerks(perks: string[]): Promise<void> {
    const sanitized = IAPService.sanitizePermanentPerkList(perks);
    const payload = JSON.stringify({
      v: 2,
      perks: sanitized,
    });

    const { createSaveEnvelope } = await import('@/utils/saveValidation');
    const envelope = createSaveEnvelope(payload);
    await safeSetItem(TRUSTED_PERMANENT_PERKS_KEY, envelope);

    // Legacy mirror is only kept in explicitly allowed environments.
    if (ALLOW_LEGACY_LOCAL_ENTITLEMENTS) {
      await safeSetItem(LEGACY_PERMANENT_PERKS_KEY, JSON.stringify(sanitized));
    }
  }

  static async savePermanentPerk(perkId: string): Promise<void> {
    const normalizedPerkId = typeof perkId === 'string' ? perkId.trim() : '';
    if (!normalizedPerkId) return;

    const permanentPerks = await IAPService.loadPermanentPerks();
    if (!permanentPerks.includes(normalizedPerkId)) {
      permanentPerks.push(normalizedPerkId);
      await IAPService.persistPermanentPerks(permanentPerks);
      logger.info(`Saved permanent perk: ${normalizedPerkId}`);
    }
  }

  static async hasPermanentPerk(perkId: string): Promise<boolean> {
    const normalizedPerkId = typeof perkId === 'string' ? perkId.trim() : '';
    if (!normalizedPerkId) return false;
    const permanentPerks = await IAPService.loadPermanentPerks();
    return permanentPerks.includes(normalizedPerkId);
  }

  // Detect if we're in sandbox environment
  private detectSandboxEnvironment(receipt?: string): boolean {
    // In development mode, always use sandbox
    if (__DEV__) {
      logger.debug('Environment: Development mode detected - using sandbox');
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
          logger.info('Environment: TestFlight/Sandbox detected from receipt');
          return true;
        }
      } catch (error) {
        logger.warn('Could not determine TestFlight status:', { error });
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
          logger.info('Environment: Sandbox detected from receipt structure');
          return true;
        }
      } catch (error) {
        logger.warn('Receipt parsing error:', { error });
      }
    }

    // Default to production for released apps
    logger.info('Environment: Production (default)');
    return false;
  }

  // Validate receipt (handles both sandbox and production)
  private async validateReceipt(receipt: string, productId: string): Promise<boolean> {
    try {
      // According to Apple's guidelines:
      // 1. Always validate against production first
      // 2. If you get "sandbox receipt used in production" error, validate against sandbox

      logger.debug('=== Receipt Validation Started ===', {
        productId,
        receiptLength: receipt?.length || 0
      });

      // Step 1: Basic receipt validation
      if (!receipt || receipt.length === 0) {
        logger.error('âŒ Validation failed: Receipt is empty or null');
        return false;
      }

      // Step 2: Detect environment from receipt
      // This follows Apple's recommended approach
      this.isSandboxEnvironment = this.detectSandboxEnvironment(receipt);
      logger.info(`ðŸ“± Detected environment: ${this.isSandboxEnvironment ? 'Sandbox' : 'Production'}`);

      // Step 3: Validate receipt structure
      try {
        // Check if receipt has expected format (base64 or JSON)
        if (receipt.length < 10) {
          logger.error('âŒ Validation failed: Receipt too short');
          return false;
        }

        // Receipt appears valid in structure
        logger.debug('âœ… Receipt structure validated');
      } catch (structureError) {
        logger.error('âŒ Receipt structure validation error:', structureError);
        return false;
      }

      // Step 4: For client-side validation, we trust the receipt from Apple's IAP SDK
      // The expo-in-app-purchases SDK already validates the receipt with Apple's servers
      // when the purchase is made. This secondary validation is for our app's logic.

      // Additional validation: Check if receipt matches expected product
      if (!productId) {
        logger.error('âŒ Validation failed: Product ID missing');
        return false;
      }

      logger.info('âœ… Receipt validated successfully');
      logger.debug('=== Receipt Validation Complete ===');

      // For production: You would send this receipt to your server here
      // Server would validate with Apple's verifyReceipt API:
      // - Try production URL: https://buy.itunes.apple.com/verifyReceipt
      // - If error 21007 (sandbox receipt in production), retry with:
      //   https://sandbox.itunes.apple.com/verifyReceipt

      return true;

    } catch (error) {
      logger.error('âŒ Receipt validation error:', error);
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        productId,
        receiptPresent: !!receipt,
      });
      return false;
    }
  }

  private async verifyReceiptWithServer(
    receipt: string,
    productId: string,
    transactionId?: string
  ): Promise<boolean> {
    if (__DEV__) {
      return true;
    }

    if (!IAP_VERIFY_URL) {
      logger.warn('No IAP_VERIFY_URL configured — skipping server verification (using store receipt only)');
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IAP_VERIFY_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (IAP_VERIFY_TOKEN) {
        headers.Authorization = `Bearer ${IAP_VERIFY_TOKEN}`;
      }

      const response = await fetch(IAP_VERIFY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          receipt,
          productId,
          transactionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.error('Receipt verification request failed', { status: response.status });
        return false;
      }

      const data = await response.json();
      return Boolean(data?.verified === true);
    } catch (error) {
      logger.error('Server receipt verification failed', error);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async loadProcessedTransactions(): Promise<Set<string>> {
    try {
      const raw = await safeGetItem(PROCESSED_IAP_TRANSACTIONS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((tx): tx is string => typeof tx === 'string' && tx.length > 0));
    } catch (error) {
      logger.warn('Failed to load processed IAP transactions ledger', { error });
      return new Set();
    }
  }

  private async saveProcessedTransactions(transactions: Set<string>): Promise<void> {
    const trimmed = Array.from(transactions).slice(-MAX_PROCESSED_IAP_TRANSACTIONS);
    await safeSetItem(PROCESSED_IAP_TRANSACTIONS_KEY, JSON.stringify(trimmed));
  }

  private async isTransactionProcessed(transactionId?: string): Promise<boolean> {
    if (!transactionId) return false;
    const transactions = await this.loadProcessedTransactions();
    return transactions.has(transactionId);
  }

  private async markTransactionProcessed(transactionId?: string): Promise<void> {
    if (!transactionId) return;
    const transactions = await this.loadProcessedTransactions();
    transactions.add(transactionId);
    await this.saveProcessedTransactions(transactions);
  }

  // Initialize IAP connection
  async initialize(): Promise<boolean> {
    // CRITICAL: Lazy-load native module here, not at module load time
    // This prevents crashes if the module fails to initialize
    if (!loadInAppPurchasesModule()) {
      const productionError = 'In-app purchases unavailable in this build';
      const devError = 'Running in simulation mode (Expo Go)';
      if (!__DEV__) {
        logger.error(productionError);
      } else {
        logger.warn('IAP module not available - running in simulation mode');
      }
      this.setState({
        isLoading: false,
        isConnected: false,
        error: __DEV__ ? devError : productionError
      });
      this.hasInitialized = true;
      return false;
    }

    // Prevent duplicate initialization
    if (this.hasInitialized) {
      logger.debug('âœ… IAP already initialized, skipping...');
      return this.state.isConnected;
    }

    if (this.isInitializing) {
      logger.debug('â³ IAP initialization in progress, waiting...');
      // Wait for existing initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.state.isConnected;
    }

    this.isInitializing = true;

    try {
      this.setState({ isLoading: true, error: null });

      // Check if IAP module is available (should be loaded by now)
      if (!InAppPurchases) {
        if (!__DEV__) {
          logger.error('IAP module unavailable in production build');
        } else {
          logger.warn('IAP module not available - running in simulation mode');
        }
        this.setState({
          isLoading: false,
          isConnected: false,
          error: __DEV__ ? 'Running in simulation mode (Expo Go)' : 'In-app purchases unavailable in this build'
        });
        this.hasInitialized = true;
        return false;
      }

      logger.info('Initializing expo-in-app-purchases...');

      // CRITICAL FIX: Connect to the store with defensive error handling
      // Wrap in Promise.resolve to catch any synchronous errors from native module
      await Promise.resolve().then(async () => {
        if (typeof InAppPurchases.connectAsync !== 'function') {
          throw new Error('InAppPurchases.connectAsync is not a function');
        }
        await InAppPurchases.connectAsync();
      });
      logger.info('Connected to store successfully');

      this.setState({ isConnected: true, isLoading: false });

      // Load products
      await this.loadProducts();

      // Set up purchase listener
      this.setupPurchaseListener();

      this.hasInitialized = true;
      logger.info('âœ… IAP initialization complete');
      return true;
    } catch (error) {
      logger.error('IAP initialization error:', error);
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
      if (!loadInAppPurchasesModule() || !InAppPurchases) return;

      const productIds = getAllProductIds();
      logger.debug('Loading products:', { productIds });

      const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        logger.debug('Loaded products:', { count: results.length });
        this.setState({ products: results });
      } else {
        throw new Error(`Failed to load products. Response code: ${responseCode}`);
      }
    } catch (error) {
      logger.error('Failed to load products:', error);
      this.setState({ error: `Failed to load products: ${error}` });
    }
  }

  // Load existing purchases
  async loadPurchases(): Promise<void> {
    try {
      if (!loadInAppPurchasesModule() || !InAppPurchases) return;

      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        logger.debug('Loaded purchases:', { count: results.length });
        this.setState({ purchases: results });

        // Save purchases to AsyncStorage
        await this.savePurchasesToStorage(results);
      } else {
        throw new Error(`Failed to load purchases. Response code: ${responseCode}`);
      }
    } catch (error) {
      logger.error('Failed to load purchases:', error);
      this.setState({ error: `Failed to load purchases: ${error}` });
    }
  }

  // Purchase a product
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      this.setState({ isLoading: true, error: null });

      // If module exists but connection is not ready, retry initialization on-demand.
      const hasNativeIapModule = loadInAppPurchasesModule() && !!InAppPurchases;
      if (hasNativeIapModule && !this.state.isConnected) {
        logger.info('IAP not connected at purchase time, attempting on-demand initialization', { productId });
        await this.initialize();
      }

      const readyForNativePurchase = loadInAppPurchasesModule() && !!InAppPurchases && this.state.isConnected;

      // If IAP module still not available, simulate purchase (for Expo Go / development)
      if (!readyForNativePurchase) {
        if (!__DEV__) {
          this.setState({ isLoading: false });
          return {
            success: false,
            message: 'Purchase service unavailable in production build. Please update to the latest version.',
          };
        }

        logger.info('IAP not available - simulating purchase for:', { productId });
        this.setState({ isLoading: false });

        // Simulate successful purchase
        const config = getProductConfig(productId);
        if (config) {
          logger.info('Product config found:', { name: config.name });

          // Call the benefit application directly
          await this.applyBenefit(productId);

          logger.info('Benefits applied successfully');

          return {
            success: true,
            message: `${config.name} purchased successfully! (Development Mode)`,
            productId,
          };
        } else {
          logger.error('Product config not found for:', { productId });
          return {
            success: false,
            message: `Product configuration not found for ${productId}. Please check iapConfig.ts`,
          };
        }
      }

      // Check if products have been loaded
      if (this.state.products.length === 0) {
        logger.info('Products not loaded yet, loading products first...');
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

      logger.info('Attempting to purchase:', { productId });

      // Request purchase with proper error handling
      // Ensure module is loaded before use
      if (!loadInAppPurchasesModule() || !InAppPurchases) {
        throw new Error('IAP module not available');
      }
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
          logger.error('âŒ Purchase succeeded but no results returned');
          throw new Error('Invalid purchase response - no purchase data received');
        }

        const purchase = results[0];
        logger.info('=== Purchase Successful ===', {
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          purchaseTime: purchase.purchaseTime
        });

        // Validate receipt (handles both sandbox and production)
        logger.info('Starting receipt validation...');
        const isValidReceipt = await this.validateReceipt(
          purchase.transactionReceipt || '',
          purchase.productId
        );

        if (!isValidReceipt) {
          logger.error('âŒ Receipt validation failed');
          throw new Error('Purchase verification failed. Please contact support.');
        }

        const serverVerified = await this.verifyReceiptWithServer(
          purchase.transactionReceipt || '',
          purchase.productId,
          purchase.transactionId
        );
        if (!serverVerified) {
          logger.error('Server-side receipt verification failed');
          throw new Error('Purchase could not be verified by server.');
        }

        logger.info('âœ… Receipt validated successfully');

        const transactionId = purchase.transactionId || `${purchase.productId}:${purchase.purchaseTime || Date.now()}`;

        // CRASH FIX (A-2): In-memory lock prevents concurrent processing of same transaction
        if (this.processingTransactions.has(transactionId)) {
          logger.warn('Transaction already being processed, skipping duplicate', { transactionId });
          this.setState({ isLoading: false });
          return { success: true, message: 'Purchase already being processed', productId: purchase.productId };
        }
        this.processingTransactions.add(transactionId);

        try {
          const alreadyProcessed = await this.isTransactionProcessed(transactionId);

          // Add to purchases list (dedupe by transaction id when available)
          const updatedPurchases = [
            ...this.state.purchases.filter(existing =>
              !transactionId || existing.transactionId !== transactionId
            ),
            purchase
          ];
          this.setState({ purchases: updatedPurchases });
          logger.info('Purchase added to local state');

          // Save to storage
          await this.savePurchasesToStorage(updatedPurchases);
          logger.info('Purchase saved to storage');

          if (!alreadyProcessed) {
            // Apply purchase benefits exactly once per transaction.
            logger.info('Applying purchase benefits...');
            await this.applyBenefit(purchase.productId, transactionId);
            logger.info('Benefits applied to game state');
          } else {
            logger.info('Skipping duplicate entitlement grant for processed transaction', {
              productId: purchase.productId,
              transactionId,
            });
          }
        } finally {
          // CRASH FIX (A-2): Always release lock
          this.processingTransactions.delete(transactionId);
        }

        // Finish transaction with store AFTER benefit is applied and persisted.
        // If this fails, the store will retry via the purchase listener on next launch.
        try {
          await InAppPurchases.finishTransactionAsync(purchase, true);
          logger.info('Transaction finished with store');
        } catch (finishError) {
          logger.warn('finishTransactionAsync failed (non-fatal, benefit already granted)', { error: String(finishError) });
        }

        this.setState({ isLoading: false });

        const environment = this.isSandboxEnvironment ? ' (Sandbox)' : '';
        logger.info(`=== Purchase Complete ${environment}===`);

        return {
          success: true,
          message: `Purchase successful!${environment}`,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          receipt: purchase.transactionReceipt,
        };
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        logger.info('â„¹ï¸ User cancelled the purchase');
        throw new Error('Purchase was cancelled');
      } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
        logger.info('â³ Purchase deferred - requires approval');
        throw new Error('Purchase is pending approval. Please check back later.');
      } else {
        logger.error('âŒ Purchase failed with response code:', { responseCode });
        throw new Error(`Purchase failed. Response code: ${responseCode}`);
      }

    } catch (error) {
      logger.error('=== Purchase Error ===', {
        error,
        productId,
        environment: this.isSandboxEnvironment ? 'Sandbox' : 'Production'
      });

      let errorMessage = 'Purchase failed';
      let userFriendlyMessage = '';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more user-friendly error messages
        if (errorMessage.includes('cancelled')) {
          userFriendlyMessage = 'Purchase was cancelled.';
          // Don't log cancelled purchases as errors - this is user choice
          logger.info('â„¹ï¸ Purchase cancelled by user');
        } else if (errorMessage.includes('pending approval')) {
          userFriendlyMessage = 'Purchase is pending approval. Please check back later.';
          logger.info('â³ Purchase deferred - waiting for approval');
        } else if (errorMessage.includes('verification failed') || errorMessage.includes('Receipt validation failed')) {
          userFriendlyMessage = 'Purchase could not be verified. If you were charged, please contact support with your receipt.';
          logger.error('âŒ Receipt verification failed - may need server-side validation');
        } else if (errorMessage.includes('not found in store')) {
          userFriendlyMessage = 'This product is not available in the App Store. Please contact support.';
          logger.error('âŒ Product not found in store - check App Store Connect configuration');
        } else if (errorMessage.includes('No products available')) {
          userFriendlyMessage = 'Store products are not configured. Please contact support.';
          logger.error('âŒ No products loaded - IAP may not be properly configured');
        } else if (errorMessage.includes('query item from store')) {
          userFriendlyMessage = 'Store products are not loaded. Please try again.';
          logger.error('âŒ Failed to query products from store');
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          userFriendlyMessage = 'Network error. Please check your connection and try again.';
          logger.error('âŒ Network error during purchase');
        } else if (errorMessage.includes('timeout')) {
          userFriendlyMessage = 'Request timed out. Please try again.';
          logger.error('âŒ Purchase request timed out');
        } else if (errorMessage.includes('Invalid purchase response')) {
          userFriendlyMessage = 'App Store connection error. Please check your internet connection and try again.';
          logger.error('âŒ Invalid response from App Store - possible network issue');
        } else if (errorMessage.includes('Purchase response missing response code')) {
          userFriendlyMessage = 'Purchase verification failed. Please try again or contact support.';
          logger.error('âŒ Malformed purchase response - App Store communication error');
        } else if (errorMessage.includes('sandbox') || errorMessage.includes('Sandbox')) {
          // Special handling for sandbox-related errors during Apple Review
          userFriendlyMessage = 'Purchase completed but requires additional verification. Your purchase has been recorded.';
          logger.warn('âš ï¸ Sandbox-related issue detected - common during App Review');
        } else {
          // Generic error with original message for debugging
          userFriendlyMessage = `Unable to complete purchase. ${errorMessage}`;
          logger.error('âŒ Unhandled error:', { errorMessage });
        }
      } else {
        userFriendlyMessage = 'An unexpected error occurred. Please try again.';
        logger.error('âŒ Non-Error object thrown:', { error });
      }

      logger.error('=== Purchase Error End ===');

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
    if (!loadInAppPurchasesModule() || !InAppPurchases) return;

    InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }: any) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        results.forEach((purchase: any) => {
          if (!purchase.acknowledged) {
            void (async () => {
              logger.info('Processing purchase:', { purchase });
              const receiptValid = await this.validateReceipt(
                purchase.transactionReceipt || '',
                purchase.productId
              );
              const serverVerified = await this.verifyReceiptWithServer(
                purchase.transactionReceipt || '',
                purchase.productId,
                purchase.transactionId
              );
              if (!receiptValid || !serverVerified) {
                logger.warn('Skipping unverified purchase from listener', {
                  productId: purchase.productId,
                  transactionId: purchase.transactionId,
                });
                return;
              }

              const transactionId = purchase.transactionId || `${purchase.productId}:${purchase.purchaseTime || Date.now()}`;
              const alreadyProcessed = await this.isTransactionProcessed(transactionId);
              if (!alreadyProcessed) {
                await this.applyBenefit(purchase.productId, transactionId);
              } else {
                logger.info('Skipping duplicate listener grant for processed transaction', {
                  productId: purchase.productId,
                  transactionId,
                });
              }
              await InAppPurchases.finishTransactionAsync(purchase, true);
            })();
          }
        });
      } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
        logger.warn(`Purchase error code: ${errorCode}`);
      }
    });
  }

  // Apply purchase benefits (Disk Fallback)
  private async applyBenefitToDisk(purchase: any, transactionId?: string): Promise<void> {
    const config = getProductConfig(purchase.productId);
    if (!config) return;

    // Resolve authoritative slot. Prefer currentSlot, keep lastSlot fallback for legacy writes.
    const currentSlotRaw = await safeGetItem('currentSlot');
    const legacyLastSlotRaw = await safeGetItem('lastSlot');
    const parsedCurrentSlot = currentSlotRaw ? parseInt(currentSlotRaw, 10) : NaN;
    const parsedLastSlot = legacyLastSlotRaw ? parseInt(legacyLastSlotRaw, 10) : NaN;
    const slotToUse = [parsedCurrentSlot, parsedLastSlot].find(slot => slot >= 1 && slot <= 3) || 1;

    // Get current game state from storage (slot-based)
    let gameStateJson: string | null = null;
    try {
      // CRASH FIX (A-1): Read from double-buffer system
      const { readSaveSlot } = await import('@/utils/saveValidation');
      gameStateJson = await readSaveSlot(slotToUse);
    } catch (error) {
      logger.error('Failed to get game state from storage:', error);
      return;
    }
    if (!gameStateJson) {
      logger.warn(`No save data found for slot ${slotToUse}`);
      return;
    }

    let gameState;
    try {
      const { decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import('@/utils/saveValidation');
      const decoded = decodePersistedSaveEnvelope(gameStateJson, {
        allowLegacy: shouldAllowUnsignedLegacySaves(),
      });
      if (!decoded.valid || typeof decoded.data !== 'string') {
        logger.error('Save envelope verification failed in IAPService', { error: decoded.error });
        return;
      }

      gameState = JSON.parse(decoded.data);
      if (!gameState || typeof gameState !== 'object') {
        logger.error('Invalid game state structure in IAPService');
        return;
      }
    } catch (parseError) {
      logger.error('Failed to parse game state in IAPService:', parseError);
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

    // Initialize perks if it doesn't exist
    if (!gameState.perks) {
      gameState.perks = {};
    }

    // CRITICAL FIX: Save perks to gameState.perks (not goldUpgrades) for consistency
    // Also save to permanent_perks storage for cross-slot persistence
    if (config.workBoost) {
      gameState.perks.workBoost = true;
      await this.savePermanentPerk('workBoost');
    }

    if (config.fastLearner) {
      gameState.perks.fastLearner = true;
      await this.savePermanentPerk('fastLearner');
    }

    if (config.goodCredit) {
      gameState.perks.goodCredit = true;
      await this.savePermanentPerk('goodCredit');
    }

    if (config.allPerks) {
      gameState.perks.workBoost = true;
      gameState.perks.mindset = true;
      gameState.perks.fastLearner = true;
      gameState.perks.goodCredit = true;
      gameState.perks.unlockAllPerks = true;
      // Save all perks as permanent
      await Promise.allSettled([
        this.savePermanentPerk('workBoost'),
        this.savePermanentPerk('mindset'),
        this.savePermanentPerk('fastLearner'),
        this.savePermanentPerk('goodCredit'),
        this.savePermanentPerk('unlockAllPerks'),
      ]);
    }

    // Handle money multiplier
    if (config.moneyMultiplier) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.moneyMultiplier = true;
    }

    // Handle all upgrades (gold upgrades)
    if (config.allUpgrades) {
      if (!gameState.goldUpgrades) {
        gameState.goldUpgrades = {};
      }
      gameState.goldUpgrades.multiplier = true;
      gameState.goldUpgrades.energy_boost = true;
      gameState.goldUpgrades.happiness_boost = true;
      gameState.goldUpgrades.fitness_boost = true;
      gameState.goldUpgrades.skill_mastery = true;
      gameState.goldUpgrades.time_machine = true;
      gameState.goldUpgrades.immortality = true;
    }

    // Handle everything unlocked
    if (config.everythingUnlocked) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.everythingUnlocked = true;
      gameState.settings.adsRemoved = true;
      gameState.settings.lifetimePremium = true;

      if (!gameState.goldUpgrades) {
        gameState.goldUpgrades = {};
      }
      gameState.goldUpgrades.multiplier = true;
      gameState.goldUpgrades.energy_boost = true;
      gameState.goldUpgrades.happiness_boost = true;
      gameState.goldUpgrades.fitness_boost = true;
      gameState.goldUpgrades.skill_mastery = true;
      gameState.goldUpgrades.time_machine = true;
      gameState.goldUpgrades.immortality = true;
    }

    // Handle unlimited youth pills
    if (config.unlimitedYouthPills) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.unlimitedYouthPills = true;
      // Set a very high number for practical purposes
      gameState.youthPills = 999999;
    }

    // Handle lifetime premium
    if (config.lifetimePremium) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.lifetimePremium = true;
      gameState.settings.adsRemoved = true;
    }

    // Handle special products
    switch (purchase.productId) {
      case IAP_PRODUCTS.REMOVE_ADS:
        gameState.settings.adsRemoved = true;
        gameState.settings.adsRemovedDate = new Date().toISOString();
        break;

      // Removed unused IAP products: PREMIUM_PASS, DOUBLE_MONEY, UNLIMITED_ENERGY
      // These products are not defined in IAP_PRODUCTS and are not currently used
      // Uncomment and add to iapConfig.ts if these features are needed in the future
      // case IAP_PRODUCTS.PREMIUM_PASS:
      //   gameState.settings.premiumPass = true;
      //   gameState.settings.premiumPassExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      //   break;

      // case IAP_PRODUCTS.DOUBLE_MONEY:
      //   gameState.settings.doubleMoney = true;
      //   gameState.settings.doubleMoneyExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      //   break;

      // case IAP_PRODUCTS.UNLIMITED_ENERGY:
      //   gameState.settings.unlimitedEnergy = true;
      //   gameState.settings.unlimitedEnergyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      //   break;

      // Bank Services IAP (Computer Banking App Services)

      // Computer Banking App Services (to sync with mobile)
      case IAP_PRODUCTS.PREMIUM_CREDIT_CARD:
        gameState.settings.premiumCreditCard = true;
        break;

      case IAP_PRODUCTS.FINANCIAL_PLANNING:
        gameState.settings.financialPlanning = true;
        break;

      case IAP_PRODUCTS.BUSINESS_BANKING:
        gameState.settings.businessBanking = true;
        break;

      case IAP_PRODUCTS.PRIVATE_BANKING:
        gameState.settings.privateBanking = true;
        break;

      case IAP_PRODUCTS.REVIVAL_PACK:
        // Revival pack - restore character to life with full stats
        gameState.showDeathPopup = false;
        gameState.deathReason = undefined;
        gameState.stats.health = 100;     // Full health
        gameState.stats.happiness = 100;  // Full happiness
        gameState.stats.energy = 100;     // Full energy
        gameState.happinessZeroWeeks = 0;
        gameState.healthZeroWeeks = 0;
        gameState.settings.hasRevivalPack = true;
        break;

    }

    // B-4: Write processed transaction ID into save envelope for cross-device resilience
    if (transactionId) {
      const existingTxs: string[] = Array.isArray(gameState.processedIAPTransactions) ? gameState.processedIAPTransactions : [];
      if (!existingTxs.includes(transactionId)) {
        // Keep capped to prevent unbounded growth (same cap as AsyncStorage ledger)
        gameState.processedIAPTransactions = [...existingTxs, transactionId].slice(-MAX_PROCESSED_IAP_TRANSACTIONS);
      }
    }

    // CRITICAL FIX: Validate gems to prevent NaN/Infinity
    if (!isFinite(gameState.stats.gems) || isNaN(gameState.stats.gems)) {
      logger.warn('Invalid gems value detected, fixing:', gameState.stats.gems);
      gameState.stats.gems = Math.max(0, Math.floor(gameState.stats.gems || 0));
    }
    if (gameState.stats.gems < 0) {
      gameState.stats.gems = 0;
    }

    // Save updated game state using atomic save for data integrity
    try {
      const key = `save_slot_${slotToUse}`;
      const serializedData = JSON.stringify(gameState);

      // CRASH FIX (A-1): Use double-buffer save for crash resilience
      const { doubleBufferSave, createSaveEnvelope } = await import('@/utils/saveValidation');
      const envelope = createSaveEnvelope(serializedData);
      const saveResult = await doubleBufferSave(key, envelope);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Double-buffer save failed');
      }

      await safeSetItem('currentSlot', String(slotToUse));
      await safeSetItem('lastSlot', String(slotToUse));
      await safeSetItem('lastSaveTime', Date.now().toString());

      logger.info('Applied purchase benefits for:', { productId: purchase.productId });
      logger.info('âœ… Game state updated and sync trigger set', { slot: slotToUse });
    } catch (error) {
      logger.error('Failed to save game state after applying purchase benefits:', error);
      throw error; // Re-throw to let caller handle it
    }
  }

  // Save a permanent perk to storage (cross-slot persistence)
  private async savePermanentPerk(perkId: string): Promise<void> {
    try {
      await IAPService.savePermanentPerk(perkId);
    } catch (error) {
      logger.error(`Failed to save permanent perk ${perkId}:`, error);
      // Don't throw - non-critical
    }
  }

  // Load permanent perks from storage
  static async loadPermanentPerks(): Promise<string[]> {
    try {
      const trustedEnvelope = await safeGetItem(TRUSTED_PERMANENT_PERKS_KEY);
      if (trustedEnvelope) {
        const { decodePersistedSaveEnvelope } = await import('@/utils/saveValidation');
        const decoded = decodePersistedSaveEnvelope(trustedEnvelope, { allowLegacy: false });
        if (decoded.valid && typeof decoded.data === 'string') {
          const parsed = JSON.parse(decoded.data);
          const source = Array.isArray(parsed) ? parsed : parsed?.perks;
          return IAPService.sanitizePermanentPerkList(source);
        }

        logger.warn('Trusted permanent perks envelope failed validation', {
          error: decoded.error,
        });
      }

      if (!ALLOW_LEGACY_LOCAL_ENTITLEMENTS) {
        // Fail closed in production-like environments: no trusted envelope, no entitlements.
        return [];
      }

      const legacyPerks = await safeGetItem(LEGACY_PERMANENT_PERKS_KEY);
      if (!legacyPerks) return [];
      const parsedLegacy = JSON.parse(legacyPerks);
      const sanitizedLegacy = IAPService.sanitizePermanentPerkList(parsedLegacy);

      // Auto-migrate legacy data to trusted envelope when allowed.
      if (sanitizedLegacy.length > 0) {
        await IAPService.persistPermanentPerks(sanitizedLegacy);
      }
      return sanitizedLegacy;
    } catch (error) {
      logger.error('Failed to load permanent perks:', error);
      return [];
    }
  }

  // Save purchases to AsyncStorage
  private async savePurchasesToStorage(purchases: any[]): Promise<void> {
    try {
      const purchasesData = purchases.map(purchase => ({
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        purchaseTime: purchase.purchaseTime,
        transactionReceipt: purchase.transactionReceipt,
      }));

      await safeSetItem('iap_purchases', JSON.stringify(purchasesData));
    } catch (error) {
      logger.error('Failed to save purchases to storage:', error);
    }
  }

  // Load purchases from AsyncStorage
  async loadPurchasesFromStorage(): Promise<any[]> {
    try {
      if (!ALLOW_LEGACY_LOCAL_ENTITLEMENTS) {
        return [];
      }
      const purchasesJson = await safeGetItem('iap_purchases');
      if (purchasesJson) {
        return JSON.parse(purchasesJson);
      }
      return [];
    } catch (error) {
      logger.error('Failed to load purchases from storage:', error);
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
  // NOTE: PREMIUM_PASS product is not currently defined in IAP_PRODUCTS
  // This method is disabled until the product is added to iapConfig.ts
  isPremiumPassActive(): boolean {
    // const purchase = this.state.purchases.find(p => p.productId === IAP_PRODUCTS.PREMIUM_PASS);
    // if (!purchase) return false;

    // // Check if 30 days have passed since purchase
    // const purchaseDate = new Date(purchase.purchaseTime);
    // const expiryDate = new Date(purchaseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    // return new Date() < expiryDate;
    return false; // Disabled until PREMIUM_PASS is added to IAP_PRODUCTS
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
      logger.info('=== Starting Purchase Restoration ===');
      this.setState({ isLoading: true, error: null });

      if (!loadInAppPurchasesModule() || !InAppPurchases) {
        logger.warn('âŒ IAP module not available');
        this.setState({ isLoading: false });
        // Don't show alert here - let calling component handle it
        return false;
      }

      logger.info('Fetching purchase history from App Store...');
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        logger.info(`Found ${results.length} purchases in history`);

        // Re-apply benefits for NON-CONSUMABLE purchases only
        let restoredCount = 0;
        for (const purchase of results) {
          const productId = purchase.productId;

          // Only restore non-consumable products (perks, lifetime features)
          // Don't restore consumables (gems, money) to prevent exploitation
          if (isConsumableProduct(productId)) {
            logger.debug(`â­ï¸  Skipping consumable: ${productId}`);
            continue;
          }

          logger.info(`â™»ï¸  Restoring non-consumable: ${productId}`);
          const receiptValid = await this.validateReceipt(
            purchase.transactionReceipt || '',
            purchase.productId
          );
          const serverVerified = await this.verifyReceiptWithServer(
            purchase.transactionReceipt || '',
            purchase.productId,
            purchase.transactionId
          );
          if (!receiptValid || !serverVerified) {
            logger.warn('Skipping unverified restored purchase', {
              productId: purchase.productId,
              transactionId: purchase.transactionId,
            });
            continue;
          }

          const transactionId = purchase.transactionId || `${purchase.productId}:${purchase.purchaseTime || Date.now()}`;
          const alreadyProcessed = await this.isTransactionProcessed(transactionId);
          if (!alreadyProcessed) {
            await this.applyBenefit(purchase.productId, transactionId);
            restoredCount++;
          }
        }

        // Update purchases list in state
        this.setState({ purchases: results, isLoading: false });

        logger.info(`âœ… Restoration complete: ${restoredCount} non-consumable items restored`);
        logger.info('=== Purchase Restoration Complete ===');

        // Don't show alert here - let calling component handle it
        // This prevents double alerts
        return true;
      } else {
        throw new Error(`Failed to restore purchases. Response code: ${responseCode}`);
      }
    } catch (error) {
      logger.error('âŒ Failed to restore purchases:', error);
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

  // Hook for in-memory state updates
  private stateUpdater: ((productId: string) => Promise<boolean>) | null = null;

  public setStateUpdater(updater: ((productId: string) => Promise<boolean>) | null) {
    this.stateUpdater = updater;
  }

  // Apply benefit (handles both in-memory and disk)
  private async applyBenefit(productId: string, transactionId?: string): Promise<void> {
    // 1. Try in-memory update
    if (this.stateUpdater) {
      try {
        await this.stateUpdater(productId);
        logger.info(`âœ… Benefit applied via in-memory updater: ${productId}`);
      } catch (error) {
        logger.error('Error in state updater:', error);
      }
    }

    // 2. Always update disk as backup/source of truth for cold start
    logger.info(`Applying benefit to disk: ${productId}`);
    await this.applyBenefitToDisk({ productId }, transactionId);

    // 3. Mark transaction processed only after entitlement grant succeeds.
    if (transactionId) {
      await this.markTransactionProcessed(transactionId);
    }
  }

  // Pure function to apply benefits to a game state object
  // Returns true if benefits were applied, false otherwise
  public applyProductToState(gameState: any, productId: string): boolean {
    const config = getProductConfig(productId);
    if (!config) return false;

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

    // Initialize perks if it doesn't exist
    if (!gameState.perks) {
      gameState.perks = {};
    }

    if ('workBoost' in config && config.workBoost) {
      gameState.perks.workBoost = true;
    }

    if ('mindset' in config && config.mindset) {
      gameState.perks.mindset = true;
    }

    if ('fastLearner' in config && config.fastLearner) {
      gameState.perks.fastLearner = true;
    }

    if ('goodCredit' in config && config.goodCredit) {
      gameState.perks.goodCredit = true;
    }

    if ('allPerks' in config && config.allPerks) {
      gameState.perks.workBoost = true;
      gameState.perks.mindset = true;
      gameState.perks.fastLearner = true;
      gameState.perks.goodCredit = true;
      gameState.perks.unlockAllPerks = true;
    }

    // Handle money multiplier
    if (config.moneyMultiplier) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.moneyMultiplier = true;
    }

    // Handle all upgrades (gold upgrades)
    if (config.allUpgrades) {
      if (!gameState.goldUpgrades) {
        gameState.goldUpgrades = {};
      }
      gameState.goldUpgrades.multiplier = true;
      gameState.goldUpgrades.energy_boost = true;
      gameState.goldUpgrades.happiness_boost = true;
      gameState.goldUpgrades.fitness_boost = true;
      gameState.goldUpgrades.skill_mastery = true;
      gameState.goldUpgrades.time_machine = true;
      gameState.goldUpgrades.immortality = true;
    }

    // Handle everything unlocked
    if (config.everythingUnlocked) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.everythingUnlocked = true;
      gameState.settings.adsRemoved = true;
      gameState.settings.lifetimePremium = true;

      if (!gameState.goldUpgrades) {
        gameState.goldUpgrades = {};
      }
      gameState.goldUpgrades.multiplier = true;
      gameState.goldUpgrades.energy_boost = true;
      gameState.goldUpgrades.happiness_boost = true;
      gameState.goldUpgrades.fitness_boost = true;
      gameState.goldUpgrades.skill_mastery = true;
      gameState.goldUpgrades.time_machine = true;
      gameState.goldUpgrades.immortality = true;
    }

    // Handle unlimited youth pills
    if (config.unlimitedYouthPills) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.unlimitedYouthPills = true;
      // Set a very high number for practical purposes
      gameState.youthPills = 999999;
    }

    // Handle lifetime premium
    if (config.lifetimePremium) {
      if (!gameState.settings) {
        gameState.settings = {};
      }
      gameState.settings.lifetimePremium = true;
      gameState.settings.adsRemoved = true;
    }

    // Handle special products
    switch (productId) {
      case IAP_PRODUCTS.REMOVE_ADS:
        gameState.settings.adsRemoved = true;
        gameState.settings.adsRemovedDate = new Date().toISOString();
        break;

      case IAP_PRODUCTS.PREMIUM_CREDIT_CARD:
        gameState.settings.premiumCreditCard = true;
        break;

      case IAP_PRODUCTS.FINANCIAL_PLANNING:
        gameState.settings.financialPlanning = true;
        break;

      case IAP_PRODUCTS.BUSINESS_BANKING:
        gameState.settings.businessBanking = true;
        break;

      case IAP_PRODUCTS.PRIVATE_BANKING:
        gameState.settings.privateBanking = true;
        break;

      case IAP_PRODUCTS.REVIVAL_PACK:
        gameState.showDeathPopup = false;
        gameState.deathReason = undefined;
        gameState.stats.health = 100;
        gameState.stats.happiness = 100;
        gameState.stats.energy = 100;
        gameState.happinessZeroWeeks = 0;
        gameState.healthZeroWeeks = 0;
        gameState.settings.hasRevivalPack = true;
        break;

    }

    // Validate gems
    if (!isFinite(gameState.stats.gems) || isNaN(gameState.stats.gems)) {
      gameState.stats.gems = Math.max(0, Math.floor(gameState.stats.gems || 0));
    }
    if (gameState.stats.gems < 0) {
      gameState.stats.gems = 0;
    }

    return true;
  }
}

// Export singleton instance
export const iapService = new IAPService();
export default iapService;
