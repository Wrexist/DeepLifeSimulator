import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

// CRITICAL: EMERGENCY DISABLE FOR TESTFLIGHT
// AdMob is causing native crashes during TurboModule initialization
// This happens BEFORE JavaScript error handlers can intercept
// We MUST completely disable AdMob until the native crash is resolved
const ADMOB_EMERGENCY_DISABLE = true; // Set to false to re-enable AdMob

// Track if module has been loaded successfully
let admobModuleLoaded = false;
let mobileAds: any = null;
let InterstitialAd: any = null;
let RewardedAd: any = null;
let AdEventType: any = null;

// Check if running in Expo Go (native modules not available)
function isExpoGo(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    // Try to detect Expo Go by checking for execution environment
    const Constants = require('expo-constants');
    if (Constants?.default?.executionEnvironment === 'storeClient') {
      return true;
    }
    return false;
  } catch {
      return false;
    }
  }
}

// Lazy-load AdMob module only when needed and only on native platforms
function loadAdMobModule(): boolean {
  // CRITICAL: Emergency disable for TestFlight
  if (ADMOB_EMERGENCY_DISABLE) {
    if (__DEV__) {
      logger.info('AdMob EMERGENCY DISABLED - skipping all initialization');
    }
    return false;
  }

  // Skip on web platform
  if (Platform.OS === 'web') {
    return false;
  }

  // Skip in Expo Go (native modules not available)
  if (isExpoGo()) {
    if (__DEV__) {
      logger.info('AdMob skipped - running in Expo Go (native modules not available)');
    }
    return false;
  }

  // If already loaded, return success
  if (admobModuleLoaded && mobileAds) {
    return true;
  }

  // Try to load the module
  // Note: The require() call itself might throw if the native module isn't available
  // This happens because the module tries to access TurboModuleRegistry during initialization
  try {
    // Use dynamic require with string concatenation to prevent static bundler analysis
    // This pattern makes it harder for the bundler to statically resolve the require
    const moduleName = 'react-native-google-mobile-ads';
    
    // Wrap require in a function that can catch synchronous errors
    let admobModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      admobModule = require(moduleName);
    } catch (requireError: any) {
      // The error might be thrown during module initialization
      const errorMessage = requireError?.message || String(requireError);
      
      // Check if it's a native module error (common in Expo Go)
      if (errorMessage.includes('TurboModuleRegistry') || 
          errorMessage.includes('RNGoogleMobileAdsModule') ||
          errorMessage.includes('could not be found') ||
          errorMessage.includes('Invariant Violation')) {
        if (__DEV__) {
          logger.info('AdMob native module not available (likely Expo Go) - AdMob features disabled');
        }
        return false;
      }
      // Re-throw if it's a different error
      throw requireError;
    }
    
    // If module loaded, try to access exports
    // This might also fail if the module loaded but native module isn't linked
    if (!admobModule) {
      if (__DEV__) {
        logger.warn('AdMob module loaded but is null or undefined');
      }
      return false;
    }

    // Try to access the exports
    try {
      mobileAds = admobModule.default?.mobileAds;
      InterstitialAd = admobModule.InterstitialAd;
      RewardedAd = admobModule.RewardedAd;
      AdEventType = admobModule.AdEventType;
    } catch (accessError: any) {
      const errorMessage = accessError?.message || String(accessError);
      
      // Check if it's a native module error
      if (errorMessage.includes('TurboModuleRegistry') || 
          errorMessage.includes('RNGoogleMobileAdsModule') ||
          errorMessage.includes('could not be found')) {
        if (__DEV__) {
          logger.info('AdMob exports not available - AdMob features disabled');
        }
        return false;
      }
      // Re-throw if it's a different error
      throw accessError;
    }

    // Verify all required exports are available
    if (!mobileAds || !InterstitialAd || !RewardedAd || !AdEventType) {
      if (__DEV__) {
        logger.warn('AdMob module missing required exports - ads disabled');
      }
      return false;
    }

    admobModuleLoaded = true;
    if (__DEV__) {
      logger.info('AdMob module loaded successfully');
    }
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || String(error) || '';
    
    // Check if it's a native module error (common in Expo Go or when module isn't linked)
    if (errorMessage.includes('TurboModuleRegistry') || 
        errorMessage.includes('RNGoogleMobileAdsModule') ||
        errorMessage.includes('could not be found')) {
      if (__DEV__) {
        logger.info('AdMob native module not available - ads disabled');
      }
    } else {
      // Log unexpected errors
      logger.warn('Failed to load AdMob module:', errorMessage);
    }
    return false;
  }
}

export interface AdMobState {
  isLoading: boolean;
  isInitialized: boolean;
  isInterstitialLoaded: boolean;
  isRewardedLoaded: boolean;
  error: string | null;
}

class AdMobService {
  private state: AdMobState = {
    isLoading: false,
    isInitialized: false,
    isInterstitialLoaded: false,
    isRewardedLoaded: false,
    error: null,
  };

  private listeners: Array<(state: AdMobState) => void> = [];
  private interstitialAd: any = null;
  private rewardedAd: any = null;

  private setState(newState: Partial<AdMobState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  addListener(listener: (state: AdMobState) => void) {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): AdMobState {
    return { ...this.state };
  }

  /**
   * Should ads be shown in this environment?
   */
  private shouldShowAds(): boolean {
    // CRITICAL: Emergency disable for TestFlight
    if (ADMOB_EMERGENCY_DISABLE) {
      return false;
    }

    // Don't show ads on web
    if (Platform.OS === 'web') {
      return false;
    }

    // Don't show ads in Expo Go
    if (isExpoGo()) {
      return false;
    }

    // Only show if initialized
    return this.state.isInitialized;
  }

  /**
   * Get the appropriate ad unit ID for the platform and ad type
   */
  private getAdUnitId(type: 'interstitial' | 'rewarded'): string {
    // Test ad unit IDs from Google
    // Replace these with your actual ad unit IDs in production
    if (type === 'interstitial') {
      return Platform.OS === 'ios'
        ? 'ca-app-pub-3940256099942544/4411468910' // iOS test interstitial
        : 'ca-app-pub-3940256099942544/1033173712'; // Android test interstitial
    } else {
      return Platform.OS === 'ios'
        ? 'ca-app-pub-3940256099942544/1712485313' // iOS test rewarded
        : 'ca-app-pub-3940256099942544/5224354917'; // Android test rewarded
    }
  }

  /**
   * Initialize AdMob service
   * MUST be called before showing ads
   */
  async initialize(): Promise<void> {
    // CRITICAL: Emergency disable for TestFlight
    if (ADMOB_EMERGENCY_DISABLE) {
      if (__DEV__) {
        logger.info('AdMob EMERGENCY DISABLED - initialization skipped');
      }
      this.setState({
        isLoading: false,
        isInitialized: false,
        error: 'AdMob disabled for TestFlight stability'
      });
      return;
    }

    // Skip on web
    if (Platform.OS === 'web') {
      logger.info('AdMob skipped - web platform not supported');
      this.setState({ isLoading: false, error: null });
      return;
    }

    // Skip in Expo Go
    if (isExpoGo()) {
      logger.info('AdMob skipped - running in Expo Go (native modules not available)');
      this.setState({ isLoading: false, error: null });
      return;
    }

    // CRITICAL: Do NOT attempt to load AdMob module
    // The native module is causing crashes during TurboModule initialization
    // This happens BEFORE JavaScript error handlers can intercept
    logger.info('AdMob initialization skipped due to native crashes in TurboModule');
    this.setState({
      isLoading: false,
      isInitialized: false,
      error: 'AdMob disabled due to native crashes'
    });
  }

  /**
   * Load an interstitial ad
   */
  async loadInterstitialAd(): Promise<void> {
    // All ad operations disabled
    return;
  }

  /**
   * Show an interstitial ad
   */
  async showInterstitialAd(): Promise<boolean> {
    // All ad operations disabled
    return false;
  }

  /**
   * Load a rewarded ad
   */
  async loadRewardedAd(): Promise<void> {
    // All ad operations disabled
    return;
  }

  /**
   * Show a rewarded ad and call the callback when user earns reward
   */
  async showRewardedAd(onReward: () => void): Promise<boolean> {
    // All ad operations disabled
    return false;
  }

  /**
   * Clean up ad resources
   */
  cleanup(): void {
    // Nothing to clean up
    this.interstitialAd = null;
    this.rewardedAd = null;
    this.setState({
      isInterstitialLoaded: false,
      isRewardedLoaded: false,
    });
  }
}

// Export singleton instance
export const adMobService = new AdMobService();
