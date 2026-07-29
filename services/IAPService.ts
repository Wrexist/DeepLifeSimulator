import { Platform } from 'react-native';
import type { GameState } from '@/contexts/game/types';
import {
  IAP_PRODUCTS,
  getProductConfig,
  getSubscriptionConfig,
  getAllProductIds,
  getAllSubscriptionIds,
  isConsumableProduct,
  isSubscriptionProduct,
} from '@/utils/iapConfig';
import { logger } from '@/utils/logger';
import { track } from '@/lib/analytics';
// RevenueCat transport (opt-in). When enabled, purchases/restore route through
// RevenueCat (which verifies server-side) instead of the self-hosted verify
// server, while reusing the SAME applyBenefit grant + dedup below. No import
// cycle: RevenueCatService depends only on featureFlags/logger.
import { revenueCatService } from '@/services/RevenueCatService';
import { safeSetItem, safeGetItem, safeRemoveItem } from '@/utils/safeStorage';
import { clampHobbySkillLevel } from '@/utils/stateValidation';
import { MS_PER_DAY } from '@/lib/config/gameConstants';

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
const ENTITLEMENTS_UNREADABLE_KEY = 'entitlements_unreadable_at';
const TRUSTED_PERMANENT_PERKS_KEY = 'permanent_perks_v2';
const LEGACY_PERMANENT_PERKS_KEY = 'permanent_perks';
const ALLOW_LEGACY_LOCAL_ENTITLEMENTS =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS === 'true';

function loadInAppPurchasesModule(): boolean {
  if (InAppPurchases !== null) {
    return true;
  }

  if (inAppPurchasesLoadAttempts >= MAX_IAP_LOAD_ATTEMPTS) {
    return false;
  }

  inAppPurchasesLoadAttempts++;

  try {
    // Backed by expo-iap via a thin legacy-shaped adapter (expo-in-app-purchases
    // is deprecated/unsupported on SDK 54). See services/expoIapAdapter.ts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    InAppPurchases = require('./expoIapAdapter');
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

/**
 * Single source of truth for "what a purchased product grants" — applies a
 * product config's benefits to a GameState IN PLACE. Used by ALL three apply
 * paths: the in-memory (applyProductToState) and persisted (applyBenefitToDisk)
 * IAP fulfillment paths, and the Shop (ShopModal) path — so they can no longer
 * drift. That drift is exactly what left the $24.99 Premium Pack money
 * multiplier silently inert (and, in the Shop path, several other entitlements).
 *
 * Sets perk FLAGS only; cross-slot permanent-perk persistence (savePermanentPerk),
 * the Verified-Pro subscription, and the transaction ledger are caller concerns.
 */
export function applyProductBenefitsToState(
  gameState: GameState,
  config: NonNullable<ReturnType<typeof getProductConfig>>,
  productId: string,
): void {
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
    // Bump every hobby's skillLevel (hobbies are the game's skill system).
    if (gameState.hobbies) {
      for (const hobby of gameState.hobbies) {
        hobby.skillLevel = clampHobbySkillLevel(hobby.skillLevel + config.skillBoost);
      }
    }
  }

  // Initialize perks if it doesn't exist
  if (!gameState.perks) {
    gameState.perks = {};
  }

  if ('workBoost' in config && config.workBoost) gameState.perks.workBoost = true;
  if ('mindset' in config && config.mindset) gameState.perks.mindset = true;
  if ('fastLearner' in config && config.fastLearner) gameState.perks.fastLearner = true;
  if ('goodCredit' in config && config.goodCredit) gameState.perks.goodCredit = true;
  if ('allPerks' in config && config.allPerks) {
    gameState.perks.workBoost = true;
    gameState.perks.mindset = true;
    gameState.perks.fastLearner = true;
    gameState.perks.goodCredit = true;
    gameState.perks.unlockAllPerks = true;
  }

  // Money multiplier — income reads `goldUpgrades.multiplier` for the 1.5×, NOT
  // `settings.moneyMultiplier` (a dead flag), so set BOTH or the paid upgrade is inert.
  if (config.moneyMultiplier) {
    gameState.settings.moneyMultiplier = true;
    if (!gameState.goldUpgrades) gameState.goldUpgrades = {};
    gameState.goldUpgrades.multiplier = true;
  }

  // All gold upgrades
  if (config.allUpgrades) {
    if (!gameState.goldUpgrades) gameState.goldUpgrades = {};
    gameState.goldUpgrades.multiplier = true;
    gameState.goldUpgrades.energy_boost = true;
    gameState.goldUpgrades.happiness_boost = true;
    gameState.goldUpgrades.fitness_boost = true;
    gameState.goldUpgrades.skill_mastery = true;
    gameState.goldUpgrades.time_machine = true;
    gameState.goldUpgrades.immortality = true;
    gameState.goldUpgrades.tycoon = true;
    gameState.goldUpgrades.chronomaster = true;
  }

  // Everything unlocked
  if (config.everythingUnlocked) {
    gameState.settings.everythingUnlocked = true;
    gameState.settings.adsRemoved = true;
    gameState.settings.lifetimePremium = true;
    if (!gameState.goldUpgrades) gameState.goldUpgrades = {};
    gameState.goldUpgrades.multiplier = true;
    gameState.goldUpgrades.energy_boost = true;
    gameState.goldUpgrades.happiness_boost = true;
    gameState.goldUpgrades.fitness_boost = true;
    gameState.goldUpgrades.skill_mastery = true;
    gameState.goldUpgrades.time_machine = true;
    gameState.goldUpgrades.immortality = true;
    gameState.goldUpgrades.tycoon = true;
    gameState.goldUpgrades.chronomaster = true;
  }

  // Unlimited youth pills
  if (config.unlimitedYouthPills) {
    gameState.settings.unlimitedYouthPills = true;
    gameState.youthPills = 999999;
  }

  // Lifetime premium
  if (config.lifetimePremium) {
    gameState.settings.lifetimePremium = true;
    gameState.settings.adsRemoved = true;
  }

  // Remove ads (config flag). The REMOVE_ADS product also stamps adsRemovedDate
  // in the switch below; any other product carrying this flag just gets adsRemoved.
  if ('removeAds' in config && config.removeAds) {
    gameState.settings.adsRemoved = true;
  }

  // Special products
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

  // Validate gems (prevent NaN/Infinity)
  if (!isFinite(gameState.stats.gems) || isNaN(gameState.stats.gems)) {
    gameState.stats.gems = Math.max(0, Math.floor(gameState.stats.gems || 0));
  }
  if (gameState.stats.gems < 0) {
    gameState.stats.gems = 0;
  }
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
  private listenerRegistered: boolean = false;

  private static sanitizePermanentPerkList(perks: unknown): string[] {
    if (!Array.isArray(perks)) return [];
    return Array.from(
      new Set(
        perks
          .filter((perk): perk is string => typeof perk === 'string')
          .map((perk) => perk.trim())
          .filter((perk) => perk.length > 0),
      ),
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
        const isTestFlight =
          receipt &&
          (receipt.includes('sandbox') ||
            receipt.includes('Sandbox') ||
            receipt.includes('SANDBOX'));

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
        if (
          receiptLower.includes('sandbox') ||
          receiptLower.includes('test') ||
          receiptLower.includes('apple.com/testflight')
        ) {
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
  // P2-11: this is ONLY a structural pre-check (non-empty receipt + productId).
  // It does NOT prove the purchase is genuine — the real gate is
  // `verifyReceiptWithServer`, which MUST be called (and must pass) before any
  // `applyBenefit`. Do not treat a `true` here as authorization to grant.
  private async validateReceipt(
    receipt: string,
    productId: string,
  ): Promise<boolean> {
    try {
      // According to Apple's guidelines:
      // 1. Always validate against production first
      // 2. If you get "sandbox receipt used in production"error, validate against sandbox

      logger.debug('=== Receipt Validation Started ===', {
        productId,
        receiptLength: receipt?.length || 0,
      });

      // Step 1: Basic receipt validation
      if (!receipt || receipt.length === 0) {
        logger.error('Validation failed: Receipt is empty or null');
        return false;
      }

      // Step 2: Detect environment from receipt
      // This follows Apple's recommended approach
      this.isSandboxEnvironment = this.detectSandboxEnvironment(receipt);
      logger.info(
        `Detected environment: ${this.isSandboxEnvironment ? 'Sandbox' : 'Production'}`,
      );

      // Step 3: Validate receipt structure
      try {
        // Check if receipt has expected format (base64 or JSON)
        if (receipt.length < 10) {
          logger.error('Validation failed: Receipt too short');
          return false;
        }

        // Receipt appears valid in structure
        logger.debug(' Receipt structure validated');
      } catch (structureError) {
        logger.error('Receipt structure validation error:', structureError);
        return false;
      }

      // Step 4: For client-side validation, we trust the receipt from Apple's IAP SDK
      // expo-iap surfaces the StoreKit-verified transaction; this is a secondary app-side check
      // when the purchase is made. This secondary validation is for our app's logic.

      // Additional validation: Check if receipt matches expected product
      if (!productId) {
        logger.error('Validation failed: Product ID missing');
        return false;
      }

      logger.info(' Receipt validated successfully');
      logger.debug('=== Receipt Validation Complete ===');

      // For production: You would send this receipt to your server here
      // Server would validate with Apple's verifyReceipt API:
      // - Try production URL: https://buy.itunes.apple.com/verifyReceipt
      // - If error 21007 (sandbox receipt in production), retry with:
      // https://sandbox.itunes.apple.com/verifyReceipt

      return true;
    } catch (error) {
      logger.error('Receipt validation error:', error);
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
    transactionId?: string,
  ): Promise<boolean> {
    if (__DEV__) {
      return true;
    }

    // R7 SB-2(B): in production, missing verify URL used to fall through to
    // `return true` — every purchase passed without any server check. That's
    // a revenue leak and a likely App Store rejection. Fail closed instead:
    // refuse to grant entitlements until ops configures EXPO_PUBLIC_IAP_VERIFY_URL.
    // The preflight check (scripts/preflight-check.js section 9) is the
    // first line of defense; this runtime guard is the backstop.
    if (!IAP_VERIFY_URL) {
      logger.error(
        '[IAP_SECURITY] EXPO_PUBLIC_IAP_VERIFY_URL not configured in production. ' +
        'Refusing to grant purchase to avoid revenue leak. ' +
        'Configure via EAS secret and rebuild.',
        { productId, transactionId },
      );
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      IAP_VERIFY_TIMEOUT_MS,
    );

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
        logger.error('Receipt verification request failed', {
          status: response.status,
        });
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
      return new Set(
        parsed.filter(
          (tx): tx is string => typeof tx === 'string' && tx.length > 0,
        ),
      );
    } catch (error) {
      logger.warn('Failed to load processed IAP transactions ledger', {
        error,
      });
      return new Set();
    }
  }

  private async saveProcessedTransactions(
    transactions: Set<string>,
  ): Promise<void> {
    const trimmed = Array.from(transactions).slice(
      -MAX_PROCESSED_IAP_TRANSACTIONS,
    );
    await safeSetItem(PROCESSED_IAP_TRANSACTIONS_KEY, JSON.stringify(trimmed));
  }

  private async isTransactionProcessed(
    transactionId?: string,
  ): Promise<boolean> {
    if (!transactionId) return false;
    const transactions = await this.loadProcessedTransactions();
    return transactions.has(transactionId);
  }

  private async markTransactionProcessed(
    transactionId?: string,
  ): Promise<void> {
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
        error: __DEV__ ? devError : productionError,
      });
      this.hasInitialized = true;
      return false;
    }

    // Prevent duplicate initialization
    if (this.hasInitialized) {
      logger.debug(' IAP already initialized, skipping...');
      return this.state.isConnected;
    }

    if (this.isInitializing) {
      logger.debug('â³ IAP initialization in progress, waiting...');
      // P1-9: bound the wait so a hung connectAsync() (no native timeout) can't make
      // every concurrent caller spin forever. Cap at 15s, then proceed with current state.
      const waitStart = Date.now();
      while (this.isInitializing) {
        if (Date.now() - waitStart > 15000) {
          logger.warn('IAP init wait exceeded 15s; proceeding with current connection state');
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
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
          error: __DEV__
            ? 'Running in simulation mode (Expo Go)'
            : 'In-app purchases unavailable in this build',
        });
        this.hasInitialized = true;
        return false;
      }

      logger.info('Initializing expo-iap...');

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
      logger.info(' IAP initialization complete');
      return true;
    } catch (error) {
      logger.error('IAP initialization error:', error);
      this.setState({
        isLoading: false,
        error: `Initialization failed: ${error}`,
        isConnected: false,
      });
      this.hasInitialized = true; // Mark as attempted to avoid infinite retries
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // Load available products from store.
  //
  // The App Store can return an OK response with an EMPTY product list while the
  // catalog is still propagating (newly-approved IAPs, sandbox warm-up, flaky
  // network). Treating that first empty result as fatal is what surfaced the
  // "Store products are not configured" alert to players. So we retry a few
  // times with backoff before giving up, and record whether the catalog ended up
  // empty so callers/UI can degrade gracefully instead of erroring.
  async loadProducts(): Promise<void> {
    if (!loadInAppPurchasesModule() || !InAppPurchases) return;

    const productIds = getAllProductIds();
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug('Loading products:', { productIds, attempt });

        const { responseCode, results } =
          await InAppPurchases.getProductsAsync(productIds);

        if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
          throw new Error(`Failed to load products. Response code: ${responseCode}`);
        }

        const loaded = Array.isArray(results) ? results : [];
        if (loaded.length > 0) {
          // Subscriptions are a separate store query ('subs'); merge them into
          // the same catalog so the purchase flow can find a subscription SKU.
          const subs = await this.loadSubscriptionProducts();
          const merged = this.mergeProductCatalogs(loaded, subs);
          logger.debug('Loaded products:', {
            count: merged.length,
            products: loaded.length,
            subscriptions: subs.length,
            attempt,
          });
          this.setState({ products: merged, error: null });
          return;
        }

        // OK but empty — catalog may still be propagating. Retry before giving up.
        logger.warn('Store returned an empty product catalog', { attempt, maxAttempts });
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
        // Final attempt still empty for one-time products: still try subscriptions
        // (they may be configured even if the in-app catalog is momentarily
        // empty), then keep any previously-loaded products. Clear any stale error
        // — this is usually store-config / propagation, which the purchase flow
        // reports in friendly, actionable terms.
        {
          const subs = await this.loadSubscriptionProducts();
          const merged = this.mergeProductCatalogs(this.state.products, subs);
          this.setState({ products: merged, error: null });
        }
        return;
      } catch (error) {
        logger.error('Failed to load products:', { error, attempt });
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
        this.setState({ error: `Failed to load products: ${error}` });
      }
    }
  }

  // Fetch auto-renewing subscription products ('subs' store query). Isolated in
  // its own try/catch and returns [] on any failure so a not-yet-configured
  // subscription group can never blank out the one-time product catalog.
  private async loadSubscriptionProducts(): Promise<any[]> {
    if (!loadInAppPurchasesModule() || !InAppPurchases) return [];
    const subscriptionIds = getAllSubscriptionIds();
    if (subscriptionIds.length === 0) return [];
    try {
      const { responseCode, results } = await InAppPurchases.getProductsAsync(
        subscriptionIds,
        'subs',
      );
      if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
        logger.warn('Subscription catalog query returned non-OK', { responseCode });
        return [];
      }
      const loaded = Array.isArray(results) ? results : [];
      logger.debug('Loaded subscription products:', { count: loaded.length });
      return loaded;
    } catch (error) {
      logger.warn('Failed to load subscription products (non-fatal)', {
        error: String(error),
      });
      return [];
    }
  }

  // Merge one-time products with subscriptions, de-duped by productId so a
  // reload never stacks duplicates.
  private mergeProductCatalogs(base: any[], extra: any[]): any[] {
    const byId = new Map<string, any>();
    for (const p of [...(base || []), ...(extra || [])]) {
      if (p && p.productId) byId.set(p.productId, p);
    }
    return Array.from(byId.values());
  }

  // Load existing purchases
  async loadPurchases(): Promise<void> {
    try {
      if (!loadInAppPurchasesModule() || !InAppPurchases) return;

      const { responseCode, results } =
        await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        logger.debug('Loaded purchases:', { count: results.length });
        this.setState({ purchases: results });

        // Save purchases to AsyncStorage
        await this.savePurchasesToStorage(results);
      } else {
        throw new Error(
          `Failed to load purchases. Response code: ${responseCode}`,
        );
      }
    } catch (error) {
      logger.error('Failed to load purchases:', error);
      this.setState({ error: `Failed to load purchases: ${error}` });
    }
  }

  // Purchase a product — thin instrumentation wrapper around the purchase flow.
  // Fires the monetisation funnel events (started → succeeded/failed) exactly once
  // each, without touching the flow's many internal return points. `track()` is a
  // hard no-op unless telemetry is enabled + consented.
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    track('purchase_started', { productId });
    try {
      const result = await this.runPurchaseFlow(productId);
      track(result.success ? 'purchase_succeeded' : 'purchase_failed', { productId });
      return result;
    } catch (error) {
      track('purchase_failed', { productId, error: 'exception' });
      throw error;
    }
  }

  // Internal purchase flow (formerly the body of purchaseProduct).
  private async runPurchaseFlow(productId: string): Promise<PurchaseResult> {
    try {
      this.setState({ isLoading: true, error: null });

      // ── RevenueCat transport (opt-in) ───────────────────────────────────────
      // RC verifies the receipt server-side and finishes the transaction itself,
      // so we skip the expo-iap purchase + self-hosted verify + finishTransaction
      // and reuse the SAME applyBenefit(...) grant + exactly-once dedup below.
      if (revenueCatService.isEnabled()) {
        const config = getProductConfig(productId) || getSubscriptionConfig(productId);
        if (!config) {
          this.setState({ isLoading: false });
          return { success: false, message: `Product configuration not found for ${productId}. Please check iapConfig.ts` };
        }
        const rc = await revenueCatService.purchaseProduct(productId);
        if (rc.cancelled) {
          this.setState({ isLoading: false });
          return { success: false, message: 'Purchase was cancelled' };
        }
        if (!rc.success) {
          this.setState({ isLoading: false });
          return { success: false, message: rc.message || 'Purchase could not be completed.' };
        }
        const transactionId = rc.transactionId || `${productId}:rc:${Date.now()}`;
        // Same in-memory lock + persisted ledger the native path uses;
        // applyBenefit marks the transaction processed at its end.
        if (!this.processingTransactions.has(transactionId)) {
          this.processingTransactions.add(transactionId);
          try {
            if (!(await this.isTransactionProcessed(transactionId))) {
              await this.applyBenefit(productId, transactionId);
            }
          } finally {
            this.processingTransactions.delete(transactionId);
          }
        }
        this.setState({ isLoading: false });
        return { success: true, message: 'Purchase successful!', productId, transactionId };
      }

      // If module exists but connection is not ready, retry initialization on-demand.
      const hasNativeIapModule = loadInAppPurchasesModule() && !!InAppPurchases;
      if (hasNativeIapModule && !this.state.isConnected) {
        logger.info(
          'IAP not connected at purchase time, attempting on-demand initialization',
          { productId },
        );
        await this.initialize();
      }

      const readyForNativePurchase =
        loadInAppPurchasesModule() &&
        !!InAppPurchases &&
        this.state.isConnected;

      // If IAP module still not available, simulate purchase (for Expo Go / development)
      if (!readyForNativePurchase) {
        if (!__DEV__) {
          this.setState({ isLoading: false });
          return {
            success: false,
            message:
              'Purchase service unavailable in production build. Please update to the latest version.',
          };
        }

        logger.info('IAP not available - simulating purchase for:', {
          productId,
        });
        this.setState({ isLoading: false });

        // Simulate successful purchase. Subscriptions have no PRODUCT_CONFIG
        // (they live in SUBSCRIPTION_CONFIGS), so fall back to that so dev/Expo
        // Go can exercise the premium subscription flow too.
        const config = getProductConfig(productId) || getSubscriptionConfig(productId);
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
          throw new Error(
            'No products available. The store is temporarily unavailable — please try again in a moment.',
          );
        }
      }

      // Check if the specific product is available
      const product = this.state.products.find(
        (p) => p.productId === productId,
      );
      if (!product) {
        throw new Error(
          `Product ${productId} not found in store. Please check App Store Connect configuration.`,
        );
      }

      const purchasingSubscription = isSubscriptionProduct(productId);
      logger.info('Attempting to purchase:', { productId, subscription: purchasingSubscription });

      // Request purchase with proper error handling
      // Ensure module is loaded before use
      if (!loadInAppPurchasesModule() || !InAppPurchases) {
        throw new Error('IAP module not available');
      }
      // Subscriptions must be requested under the 'subs' type or the store
      // rejects the SKU; one-time products default to 'in-app'.
      const purchaseResult = await InAppPurchases.purchaseItemAsync(
        productId,
        purchasingSubscription ? 'subs' : 'in-app',
      );

      // Check if purchase result is valid
      if (!purchaseResult || typeof purchaseResult !== 'object') {
        throw new Error(
          'Invalid purchase response from App Store. Please try again.',
        );
      }

      const { responseCode, results } = purchaseResult;

      // Check if responseCode exists
      if (responseCode === undefined || responseCode === null) {
        throw new Error(
          'Purchase response missing response code. Please try again.',
        );
      }

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        // Validate results array
        if (!results || !Array.isArray(results) || results.length === 0) {
          logger.error('Purchase succeeded but no results returned');
          throw new Error(
            'Invalid purchase response - no purchase data received',
          );
        }

        const purchase = results[0];
        logger.info('=== Purchase Successful ===', {
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          purchaseTime: purchase.purchaseTime,
        });

        // Validate receipt (handles both sandbox and production)
        logger.info('Starting receipt validation...');
        const isValidReceipt = await this.validateReceipt(
          purchase.transactionReceipt || '',
          purchase.productId,
        );

        if (!isValidReceipt) {
          logger.error('Receipt validation failed');
          throw new Error(
            'Purchase verification failed. Please contact support.',
          );
        }

        const serverVerified = await this.verifyReceiptWithServer(
          purchase.transactionReceipt || '',
          purchase.productId,
          purchase.transactionId,
        );
        if (!serverVerified) {
          logger.error('Server-side receipt verification failed');
          throw new Error('Purchase could not be verified by server.');
        }

        logger.info(' Receipt validated successfully');

        const transactionId =
          purchase.transactionId ||
          `${purchase.productId}:${purchase.purchaseTime || Date.now()}`;

        // CRASH FIX (A-2): In-memory lock prevents concurrent processing of same transaction
        if (this.processingTransactions.has(transactionId)) {
          logger.warn(
            'Transaction already being processed, skipping duplicate',
            { transactionId },
          );
          this.setState({ isLoading: false });
          return {
            success: true,
            message: 'Purchase already being processed',
            productId: purchase.productId,
          };
        }
        this.processingTransactions.add(transactionId);

        try {
          const alreadyProcessed =
            await this.isTransactionProcessed(transactionId);

          // Add to purchases list (dedupe by transaction id when available)
          const updatedPurchases = [
            ...this.state.purchases.filter(
              (existing) =>
                !transactionId || existing.transactionId !== transactionId,
            ),
            purchase,
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
            logger.info(
              'Skipping duplicate entitlement grant for processed transaction',
              {
                productId: purchase.productId,
                transactionId,
              },
            );
          }
        } finally {
          // CRASH FIX (A-2): Always release lock
          this.processingTransactions.delete(transactionId);
        }

        // Finish transaction with store AFTER benefit is applied and persisted.
        // If this fails, the store will retry via the purchase listener on next launch.
        // Subscriptions must be acknowledged, NOT consumed — consuming a
        // subscription on Android lets it be re-bought and breaks the
        // entitlement. Everything else keeps its existing finish behavior.
        try {
          await InAppPurchases.finishTransactionAsync(
            purchase,
            !isSubscriptionProduct(purchase.productId),
          );
          logger.info('Transaction finished with store');
        } catch (finishError) {
          logger.warn(
            'finishTransactionAsync failed (non-fatal, benefit already granted)',
            { error: String(finishError) },
          );
        }

        this.setState({ isLoading: false });

        const environment = this.isSandboxEnvironment ? '(Sandbox)' : '';
        logger.info(`=== Purchase Complete ${environment}===`);

        return {
          success: true,
          message: `Purchase successful!${environment}`,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          receipt: purchase.transactionReceipt,
        };
      } else if (
        responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED
      ) {
        logger.info('ℹ️ User cancelled the purchase');
        throw new Error('Purchase was cancelled');
      } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
        logger.info('â³ Purchase deferred - requires approval');
        throw new Error(
          'Purchase is pending approval. Please check back later.',
        );
      } else {
        logger.error('Purchase failed with response code:', { responseCode });
        throw new Error(`Purchase failed. Response code: ${responseCode}`);
      }
    } catch (error) {
      logger.error('=== Purchase Error ===', {
        error,
        productId,
        environment: this.isSandboxEnvironment ? 'Sandbox' : 'Production',
      });

      let errorMessage = 'Purchase failed';
      let userFriendlyMessage = '';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more user-friendly error messages
        if (errorMessage.includes('cancelled')) {
          userFriendlyMessage = 'Purchase was cancelled.';
          // Don't log cancelled purchases as errors - this is user choice
          logger.info('ℹ️ Purchase cancelled by user');
        } else if (errorMessage.includes('pending approval')) {
          userFriendlyMessage =
            'Purchase is pending approval. Please check back later.';
          logger.info('â³ Purchase deferred - waiting for approval');
        } else if (
          errorMessage.includes('verification failed') ||
          errorMessage.includes('Receipt validation failed')
        ) {
          userFriendlyMessage =
            'Purchase could not be verified. If you were charged, please contact support with your receipt.';
          logger.error(
            'Receipt verification failed - may need server-side validation',
          );
        } else if (errorMessage.includes('not found in store')) {
          userFriendlyMessage =
            'This item is temporarily unavailable. Please try again later.';
          logger.error(
            'Product not found in store - check App Store Connect configuration',
          );
        } else if (errorMessage.includes('No products available')) {
          userFriendlyMessage =
            'The store is temporarily unavailable. Please check your connection and try again in a moment.';
          logger.error(
            'No products loaded - IAP may not be properly configured',
          );
        } else if (errorMessage.includes('query item from store')) {
          userFriendlyMessage =
            'Store products are not loaded. Please try again.';
          logger.error('Failed to query products from store');
        } else if (
          errorMessage.includes('network') ||
          errorMessage.includes('connection')
        ) {
          userFriendlyMessage =
            'Network error. Please check your connection and try again.';
          logger.error('Network error during purchase');
        } else if (errorMessage.includes('timeout')) {
          userFriendlyMessage = 'Request timed out. Please try again.';
          logger.error('Purchase request timed out');
        } else if (errorMessage.includes('Invalid purchase response')) {
          userFriendlyMessage =
            'App Store connection error. Please check your internet connection and try again.';
          logger.error(
            'Invalid response from App Store - possible network issue',
          );
        } else if (
          errorMessage.includes('Purchase response missing response code')
        ) {
          userFriendlyMessage =
            'Purchase verification failed. Please try again or contact support.';
          logger.error(
            'Malformed purchase response - App Store communication error',
          );
        } else if (
          errorMessage.includes('sandbox') ||
          errorMessage.includes('Sandbox')
        ) {
          // Special handling for sandbox-related errors during Apple Review
          userFriendlyMessage =
            'Purchase completed but requires additional verification. Your purchase has been recorded.';
          logger.warn(
            '¸ Sandbox-related issue detected - common during App Review',
          );
        } else {
          // Generic error with original message for debugging
          userFriendlyMessage = `Unable to complete purchase. ${errorMessage}`;
          logger.error('Unhandled error:', { errorMessage });
        }
      } else {
        userFriendlyMessage = 'An unexpected error occurred. Please try again.';
        logger.error('Non-Error object thrown:', { error });
      }

      logger.error('=== Purchase Error End ===');

      this.setState({
        isLoading: false,
        error: userFriendlyMessage,
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

    // Guard against stacking listeners across re-inits (each call replaces the
    // single native listener, but the flag keeps intent explicit and lets
    // destroy() know whether teardown is needed).
    if (this.listenerRegistered) return;

    InAppPurchases.setPurchaseListener(
      ({ responseCode, results, errorCode }: any) => {
        if (responseCode === InAppPurchases.IAPResponseCode.OK) {
          results.forEach((purchase: any) => {
            // P0-16: `purchase.acknowledged` is Android-only — on iOS every
            // listener fire would re-enter this branch for every queued
            // transaction, triggering server round trips and floods of
            // forceSave calls. Check the local transaction ledger FIRST and
            // only proceed when this specific transaction is genuinely new.
            void (async () => {
              try {
                const transactionId =
                  purchase.transactionId ||
                  `${purchase.productId}:${purchase.purchaseTime || Date.now()}`;
                if (await this.isTransactionProcessed(transactionId)) {
                  // Already applied — still finish on the platform so it stops
                  // being re-delivered, but no other work.
                  try {
                    await InAppPurchases.finishTransactionAsync(purchase, !isSubscriptionProduct(purchase.productId));
                  } catch (err) {
                    logger.warn('finishTransactionAsync failed on duplicate', { err });
                  }
                  return;
                }
                // P0-17: cross-path double-grant guard. The interactive
                // `runPurchaseFlow` marks a transaction in `processingTransactions`
                // (in-memory) but only writes the persisted ledger
                // (`markTransactionProcessed`) at the END of `applyBenefit`, after
                // an async disk read/write. If this listener fires for the same
                // transactionId while the foreground grant is mid-flight, the
                // persisted `isTransactionProcessed` check above still returns
                // false and both paths would call `applyBenefit`, double-granting a
                // consumable (gems/money). Consult the same in-memory lock the
                // foreground path uses so only one path applies the benefit.
                if (this.processingTransactions.has(transactionId)) {
                  logger.info(
                    '[IAP listener] transaction already being processed by foreground flow, skipping',
                    { transactionId },
                  );
                  return;
                }
                // Android: also respect acknowledged flag (don't re-grant).
                // Still finish the transaction so the platform stops
                // re-delivering it (otherwise Android loops on redelivery).
                // NB: this returns BEFORE we take the in-memory lock, so there is
                // no lock to leak on this path.
                if (purchase.acknowledged === true) {
                  try {
                    await InAppPurchases.finishTransactionAsync(purchase, !isSubscriptionProduct(purchase.productId));
                  } catch (err) {
                    logger.warn('finishTransactionAsync failed on acknowledged', { err });
                  }
                  return;
                }

                // Take the in-memory lock only once we're committed to the grant
                // path; the `finally` below always releases it.
                this.processingTransactions.add(transactionId);
                try {
                  logger.info('Processing purchase:', { purchase });
                  const receiptValid = await this.validateReceipt(
                    purchase.transactionReceipt || '',
                    purchase.productId,
                  );
                  const serverVerified = await this.verifyReceiptWithServer(
                    purchase.transactionReceipt || '',
                    purchase.productId,
                    purchase.transactionId,
                  );
                  if (!receiptValid || !serverVerified) {
                    logger.warn('Skipping unverified purchase from listener', {
                      productId: purchase.productId,
                      transactionId: purchase.transactionId,
                    });
                    return;
                  }

                  await this.applyBenefit(purchase.productId, transactionId);
                  await InAppPurchases.finishTransactionAsync(purchase, !isSubscriptionProduct(purchase.productId));
                } finally {
                  // Release the in-memory lock once this path is done (the
                  // persisted ledger now records the grant for cold starts).
                  this.processingTransactions.delete(transactionId);
                }
              } catch (err) {
                logger.error('[IAP listener] Failed to process purchase', err);
              }
            })();
          });
        } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
          logger.warn(`Purchase error code: ${errorCode}`);
        }
      },
    );

    this.listenerRegistered = true;
  }

  // Apply purchase benefits (Disk Fallback)
  private async applyBenefitToDisk(
    purchase: any,
    transactionId?: string,
    options?: { skipBenefitReapply?: boolean },
  ): Promise<void> {
    const config = getProductConfig(purchase.productId);
    // Subscriptions have no one-time PRODUCT_CONFIG (they live in
    // SUBSCRIPTION_CONFIGS) but DO need disk fulfillment — the Verified-Pro
    // block below grants their perks. Only bail when the SKU is neither a
    // configured one-time product nor a known subscription.
    const isSubscription = isSubscriptionProduct(purchase.productId);
    if (!config && !isSubscription) return;

    // Resolve authoritative slot. Prefer currentSlot, keep lastSlot fallback for legacy writes.
    const currentSlotRaw = await safeGetItem('currentSlot');
    const legacyLastSlotRaw = await safeGetItem('lastSlot');
    const parsedCurrentSlot = currentSlotRaw
      ? parseInt(currentSlotRaw, 10)
      : NaN;
    const parsedLastSlot = legacyLastSlotRaw
      ? parseInt(legacyLastSlotRaw, 10)
      : NaN;
    const slotToUse =
      [parsedCurrentSlot, parsedLastSlot].find(
        (slot) => slot >= 1 && slot <= 3,
      ) || 1;

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
      const { decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } =
        await import('@/utils/saveValidation');
      const decoded = decodePersistedSaveEnvelope(gameStateJson, {
        allowLegacy: shouldAllowUnsignedLegacySaves(),
      });
      if (!decoded.valid || typeof decoded.data !== 'string') {
        logger.error('Save envelope verification failed in IAPService', {
          error: decoded.error,
        });
        return;
      }

      gameState = JSON.parse(decoded.data);
      if (!gameState || typeof gameState !== 'object') {
        logger.error('Invalid game state structure in IAPService');
        return;
      }
      // P2-9: defensively backfill core shape — `applyBenefitToDisk` mutates
      // `gameState.stats.gems`, `.money`, `.perks.*`, `.settings.*` directly.
      // If a save was loaded mid-migration and one of these is missing, the
      // mutation NPEs and the user is charged but receives nothing.
      if (!gameState.stats || typeof gameState.stats !== 'object') {
        gameState.stats = { gems: 0, money: 0, health: 50, happiness: 50, energy: 50, fitness: 50, reputation: 50 };
      }
      if (!gameState.perks || typeof gameState.perks !== 'object') gameState.perks = {};
      if (!gameState.settings || typeof gameState.settings !== 'object') gameState.settings = {};
    } catch (parseError) {
      logger.error('Failed to parse game state in IAPService:', parseError);
      return;
    }

    // Apply all config benefits via the single shared helper (same logic the
    // in-memory applyProductToState path uses — they can no longer drift).
    // SKIP when the in-memory updater already applied + persisted them: this
    // helper is additive for consumables (gems/money/youthPills `+=`), so a
    // second pass over the already-credited save double-grants the purchase.
    // Subscriptions have no `config`; their fulfillment is the Verified-Pro
    // block below, so skip the one-time-product benefit/perk application.
    if (config) {
      if (!options?.skipBenefitReapply) {
        applyProductBenefitsToState(gameState, config, purchase.productId);
      }

      // Disk path only: persist permanent (cross-slot) perks to storage.
      await this.persistPermanentPerks(config);
    }

    // ─── Pulse Verified Pro subscription fulfillment (v13+) ───
    // Mirrors `subscribeVerifiedPro`from contexts/game/actions/VibeActions.ts.
    // Inlined here because IAP fulfillment runs against a fetched gameState
    // (no setGameState available) — the action and the inline path must stay
    // in sync for shape, signup-bonus rule, and perks.
    // Detect by SKU rather than IAP_PRODUCTS enum because subscription SKUs
    // live in SUBSCRIPTION_PRODUCTS (utils/iapConfig.ts) — Platform.select'd
    // strings that vary by iOS/Android storefront.
    if (
      typeof purchase.productId === 'string' &&
      /^(deeplife_premium_monthly|deeplife_premium_yearly|deeplife\.premium\.monthly|deeplife\.premium\.yearly)$/i.test(
        purchase.productId,
      )
    ) {
      const isYearly = /yearly/i.test(purchase.productId);
      const durationMs = (isYearly ? 365 : 30) * MS_PER_DAY;

      if (!gameState.socialMedia) {
        gameState.socialMedia = {
          followers: 0,
          influenceLevel: 'novice',
          totalPosts: 0,
          viralPosts: 0,
          brandPartnerships: 0,
          engagementRate: 0,
        };
      }
      const welcomeAlreadyClaimed = gameState.socialMedia.verifiedProWelcomeClaimed === true;
      gameState.socialMedia.verifiedPro = {
        active: true,
        subscribedTimestamp: Date.now(),
        expiresTimestamp: Date.now() + durationMs,
        sku: purchase.productId,
        perksUnlocked: {
          blueCheckmark: true,
          postBoostMultiplier: 1.25,
          analyticsUnlocked: true,
          noAdsInFeed: true,
          longerPosts: true,
        },
      };
      // Signup-bonus followers — ONCE per save. ANTI-EXPLOIT: gate on a sticky
      // flag, not the transient `active` flag, so cancel→resubscribe can't
      // re-mint the +500 (cancelVerifiedPro never clears the flag).
      if (!welcomeAlreadyClaimed) {
        gameState.socialMedia.verifiedProWelcomeClaimed = true;
        gameState.socialMedia.followers =
          (gameState.socialMedia.followers ?? 0) + 500;
      }
      if (gameState.userProfile) {
        gameState.userProfile.verified = true;
      }
    }

    // B-4: Write processed transaction ID into save envelope for cross-device resilience
    if (transactionId) {
      const existingTxs: string[] = Array.isArray(
        gameState.processedIAPTransactions,
      )
        ? gameState.processedIAPTransactions
        : [];
      if (!existingTxs.includes(transactionId)) {
        // Keep capped to prevent unbounded growth (same cap as AsyncStorage ledger)
        gameState.processedIAPTransactions = [
          ...existingTxs,
          transactionId,
        ].slice(-MAX_PROCESSED_IAP_TRANSACTIONS);
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

    // Save updated game state via the shared save queue so the write is
    // serialized with autosaves (no concurrent overwrites that could drop
    // a granted entitlement) and goes through the same pruning + envelope
    // + double-buffer path as every other save.
    try {
      const { forceSave } = await import('@/utils/saveQueue');
      await forceSave(slotToUse, gameState);

      await safeSetItem('currentSlot', String(slotToUse));

      logger.info('Applied purchase benefits for:', {
        productId: purchase.productId,
      });
      logger.info('Game state updated and sync trigger set', {
        slot: slotToUse,
      });
    } catch (error) {
      logger.error(
        'Failed to save game state after applying purchase benefits:',
        error,
      );
      throw error; // Re-throw to let caller handle it
    }
  }

  /**
   * Persist permanent (cross-slot) perks for a purchased product. Mirrors the
   * inline savePermanentPerk calls the disk-apply path used to interleave —
   * kept as a separate step so all the state-mutation logic lives in the shared
   * applyProductBenefitsToState helper. Public so the Shop path (ShopModal)
   * persists perks through the exact same routine as IAP fulfillment.
   */
  public async persistPermanentPerks(
    config: NonNullable<ReturnType<typeof getProductConfig>>,
  ): Promise<void> {
    if ('workBoost' in config && config.workBoost) await this.savePermanentPerk('workBoost');
    if ('mindset' in config && config.mindset) await this.savePermanentPerk('mindset');
    if ('fastLearner' in config && config.fastLearner) await this.savePermanentPerk('fastLearner');
    if ('goodCredit' in config && config.goodCredit) await this.savePermanentPerk('goodCredit');
    if ('allPerks' in config && config.allPerks) {
      // P2-11: inspect results so partial failures don't disappear silently.
      const perkResults = await Promise.allSettled([
        this.savePermanentPerk('workBoost'),
        this.savePermanentPerk('mindset'),
        this.savePermanentPerk('fastLearner'),
        this.savePermanentPerk('goodCredit'),
        this.savePermanentPerk('unlockAllPerks'),
      ]);
      const failed = perkResults.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.warn(`[IAP] ${failed.length}/5 permanent perk writes failed`, { failed });
      }
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
  /**
   * True when a permanent-entitlement envelope EXISTS but could not be
   * verified. Distinct from "no purchases": the player bought something and we
   * cannot read it, which is a restore prompt, not an empty account.
   */
  static entitlementsUnreadable = false;

  /** Has this install seen an unreadable entitlement envelope? */
  static async areEntitlementsUnreadable(): Promise<boolean> {
    if (IAPService.entitlementsUnreadable) return true;
    try {
      return (await safeGetItem(ENTITLEMENTS_UNREADABLE_KEY)) != null;
    } catch {
      return false;
    }
  }

  /** Clear the marker once entitlements have been read or restored. */
  static async clearEntitlementsUnreadable(): Promise<void> {
    IAPService.entitlementsUnreadable = false;
    try {
      await safeRemoveItem(ENTITLEMENTS_UNREADABLE_KEY);
    } catch {
      // Non-critical.
    }
  }

  static async loadPermanentPerks(): Promise<string[]> {
    try {
      const trustedEnvelope = await safeGetItem(TRUSTED_PERMANENT_PERKS_KEY);
      if (trustedEnvelope) {
        const { decodePersistedSaveEnvelope } =
          await import('@/utils/saveValidation');
        const decoded = decodePersistedSaveEnvelope(trustedEnvelope, {
          allowLegacy: false,
        });
        if (decoded.valid && typeof decoded.data === 'string') {
          const parsed = JSON.parse(decoded.data);
          const source = Array.isArray(parsed) ? parsed : parsed?.perks;
          await IAPService.clearEntitlementsUnreadable();
          return IAPService.sanitizePermanentPerkList(source);
        }

        // The two failure modes are NOT the same, and collapsing them cost a
        // paying player their purchases with one logger.warn: an ABSENT
        // envelope genuinely means no purchases, but a PRESENT one that will
        // not verify means the entitlements are intact and unreadable — a key
        // change, not an empty account. Fail closed either way, but record the
        // difference so the app can offer a restore instead of silently
        // presenting a paying player as never having bought anything.
        // 2026-07-29 audit SEC-7.
        logger.error('Trusted permanent perks envelope failed validation — entitlements unreadable', {
          error: decoded.error,
        });
        IAPService.entitlementsUnreadable = true;
        await safeSetItem(ENTITLEMENTS_UNREADABLE_KEY, String(Date.now())).catch(() => {});
      }

      if (!ALLOW_LEGACY_LOCAL_ENTITLEMENTS) {
        // Fail closed in production-like environments: no trusted envelope, no entitlements.
        return [];
      }

      const legacyPerks = await safeGetItem(LEGACY_PERMANENT_PERKS_KEY);
      if (!legacyPerks) return [];
      const parsedLegacy = JSON.parse(legacyPerks);
      const sanitizedLegacy =
        IAPService.sanitizePermanentPerkList(parsedLegacy);

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
      const purchasesData = purchases.map((purchase) => ({
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
    return this.state.purchases.some(
      (purchase) => purchase.productId === productId,
    );
  }

  // Check if ads are removed
  isAdsRemoved(): boolean {
    // When RevenueCat drives entitlements, its cached `ads_removed`/`premium`
    // is authoritative alongside the local purchase ledger.
    if (revenueCatService.isEnabled() && revenueCatService.cachedEntitlements().adsRemoved) {
      return true;
    }
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
    return this.state.products.find(
      (product) => product.productId === productId,
    );
  }

  // Get all products
  getProducts(): any[] {
    return this.state.products;
  }

  // True only when the store connected AND a non-empty catalog actually loaded.
  // UI can use this to disable/hide buy buttons (with a "store unavailable" note)
  // instead of letting a tap fail with an error alert.
  isStoreAvailable(): boolean {
    return this.state.isConnected && this.state.products.length > 0;
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
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  // Restore purchases
  async restorePurchases(): Promise<boolean> {
    try {
      logger.info('=== Starting Purchase Restoration ===');
      this.setState({ isLoading: true, error: null });

      // RevenueCat restore (opt-in): RC re-applies entitlements server-side and
      // fires the customer-info listener → SubscriptionReconciler syncs
      // settings.adsRemoved / premium into game state. Beyond those two
      // entitlements, re-apply every restored NON-CONSUMABLE (perks, premium
      // credit card, lifetime unlocks, etc.) through the normal grant path so
      // permanent perks not represented by an entitlement are also restored.
      if (revenueCatService.isEnabled()) {
        const restoredIds = await revenueCatService.restoreProductIds();
        let restoredCount = 0;
        for (const productId of restoredIds) {
          // Never restore consumables (gems / money) — prevents re-granting them.
          if (isConsumableProduct(productId)) {
            continue;
          }
          // RC verifies ownership server-side; dedupe so a benefit is applied at
          // most once even across repeated restores.
          const transactionId = `rc_restore:${productId}`;
          if (await this.isTransactionProcessed(transactionId)) {
            continue;
          }
          await this.applyBenefit(productId, transactionId);
          restoredCount++;
        }
        const e = revenueCatService.cachedEntitlements();
        this.setState({ isLoading: false });
        return restoredCount > 0 || e.adsRemoved || e.premium;
      }

      if (!loadInAppPurchasesModule() || !InAppPurchases) {
        logger.warn('IAP module not available');
        this.setState({ isLoading: false });
        // Don't show alert here - let calling component handle it
        return false;
      }

      logger.info('Fetching purchase history from App Store...');
      const { responseCode, results } =
        await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        logger.info(`Found ${results.length} purchases in history`);

        // Re-apply benefits for NON-CONSUMABLE purchases only
        let restoredCount = 0;
        for (const purchase of results) {
          const productId = purchase.productId;

          // Only restore non-consumable products (perks, lifetime features)
          // Don't restore consumables (gems, money) to prevent exploitation
          if (isConsumableProduct(productId)) {
            logger.debug(`â­ï¸ Skipping consumable: ${productId}`);
            continue;
          }

          logger.info(`â™»ï¸ Restoring non-consumable: ${productId}`);
          const receiptValid = await this.validateReceipt(
            purchase.transactionReceipt || '',
            purchase.productId,
          );
          const serverVerified = await this.verifyReceiptWithServer(
            purchase.transactionReceipt || '',
            purchase.productId,
            purchase.transactionId,
          );
          if (!receiptValid || !serverVerified) {
            logger.warn('Skipping unverified restored purchase', {
              productId: purchase.productId,
              transactionId: purchase.transactionId,
            });
            continue;
          }

          const transactionId =
            purchase.transactionId ||
            `${purchase.productId}:${purchase.purchaseTime || Date.now()}`;
          const alreadyProcessed =
            await this.isTransactionProcessed(transactionId);
          if (!alreadyProcessed) {
            await this.applyBenefit(purchase.productId, transactionId);
            restoredCount++;
          }
        }

        // Update purchases list in state
        this.setState({ purchases: results, isLoading: false });

        logger.info(
          ` Restoration complete: ${restoredCount} non-consumable items restored`,
        );
        logger.info('=== Purchase Restoration Complete ===');

        // Don't show alert here - let calling component handle it
        // This prevents double alerts
        return true;
      } else {
        throw new Error(
          `Failed to restore purchases. Response code: ${responseCode}`,
        );
      }
    } catch (error) {
      logger.error('Failed to restore purchases:', error);
      this.setState({
        isLoading: false,
        error: 'Failed to restore purchases',
      });

      // Don't show alert here - let calling component handle it
      // This prevents double alerts
      return false;
    }
  }

  // Cleanup
  destroy(): void {
    // Tear down the native purchase listener so re-init doesn't stack handlers.
    try {
      if (loadInAppPurchasesModule()) {
        InAppPurchases?.setPurchaseListener?.(null);
      }
    } catch (err) {
      logger.warn('Failed to clear purchase listener on destroy', { err });
    }
    this.listenerRegistered = false;
    this.listeners = [];
    this.hasInitialized = false;
    this.isInitializing = false;
  }

  // Hook for in-memory state updates
  private stateUpdater: ((productId: string) => Promise<boolean>) | null = null;

  public setStateUpdater(
    updater: ((productId: string) => Promise<boolean>) | null,
  ) {
    this.stateUpdater = updater;
  }

  // Apply benefit (handles both in-memory and disk)
  private async applyBenefit(
    productId: string,
    transactionId?: string,
  ): Promise<void> {
    // 1. Try in-memory update. When the in-memory updater (IAPHandler) applies
    //    the product to live state AND persists it (saveGame) — which it does
    //    before resolving — the disk path below must NOT additively re-apply the
    //    same config benefits, or every consumable (gems/money/youthPills) is
    //    granted twice.
    let inMemoryApplied = false;
    if (this.stateUpdater) {
      try {
        inMemoryApplied = (await this.stateUpdater(productId)) === true;
        logger.info(` Benefit applied via in-memory updater: ${productId}`);
      } catch (error) {
        logger.error('Error in state updater:', error);
      }
    }

    // 2. Always touch disk as the source of truth for cold start AND for the
    //    disk-only concerns (permanent perks, subscription fulfillment, the
    //    transaction ledger). Re-apply the additive config benefits ONLY when
    //    the in-memory path did not already apply + persist them.
    logger.info(`Applying benefit to disk: ${productId}`);
    await this.applyBenefitToDisk({ productId }, transactionId, {
      skipBenefitReapply: inMemoryApplied,
    });

    // 3. Mark transaction processed only after entitlement grant succeeds.
    if (transactionId) {
      await this.markTransactionProcessed(transactionId);
    }
  }

  // Pure function to apply benefits to a game state object
  // Returns true if benefits were applied, false otherwise
  /**
   * Mutates`gameState`in place (legacy pattern). Prefer tightening callers to pass a full`GameState`.
   */
  public applyProductToState(gameState: GameState, productId: string): boolean {
    const config = getProductConfig(productId);
    if (!config) return false;

    applyProductBenefitsToState(gameState, config, productId);
    return true;
  }
}

// Export singleton instance
export const iapService = new IAPService();
export default iapService;
