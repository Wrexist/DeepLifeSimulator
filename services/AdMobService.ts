import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { iapService } from './IAPService';
import { logger } from '@/utils/logger';
import { requestTrackingPermission } from '@/utils/trackingTransparency';

// Optional AdMob dependency - handle gracefully if not available
// Lazy-load only on native platforms (not web) to avoid bundler issues
let mobileAds: any = null;
let BannerAd: any = null;
let InterstitialAd: any = null;
let RewardedAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;
let AdEventType: any = null;
let RewardedAdEventType: any = null;
let admobModuleLoaded = false;

// Check if running in Expo Go
function isExpoGo(): boolean {
  try {
    // @ts-ignore - Expo constants may not be typed
    return typeof expo !== 'undefined' && expo?.modules?.ExpoGo !== undefined;
  } catch {
    // Check for Expo Go via Constants
    try {
      // @ts-ignore
      const Constants = require('expo-constants');
      return Constants?.executionEnvironment === 'storeClient';
    } catch {
      return false;
    }
  }
}

// Lazy-load AdMob module only when needed and only on native platforms
function loadAdMobModule(): boolean {
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
    try {
      if (!admobModule) {
        throw new Error('AdMob module is null or undefined');
      }
      
      mobileAds = admobModule.default;
      BannerAd = admobModule.BannerAd;
      InterstitialAd = admobModule.InterstitialAd;
      RewardedAd = admobModule.RewardedAd;
      BannerAdSize = admobModule.BannerAdSize;
      TestIds = admobModule.TestIds;
      AdEventType = admobModule.AdEventType;
      RewardedAdEventType = admobModule.RewardedAdEventType;
      
      // Verify that mobileAds is actually callable (native module is linked)
      if (typeof mobileAds !== 'function') {
        if (__DEV__) {
          logger.warn('AdMob module loaded but mobileAds is not a function');
        }
        return false;
      }
      
      admobModuleLoaded = true;
      return true;
    } catch (accessError: any) {
      const errorMessage = accessError?.message || String(accessError);
      if (__DEV__) {
        logger.info('AdMob module loaded but native module not available:', errorMessage);
      }
      return false;
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // Check if it's a native module error
    if (errorMessage.includes('TurboModuleRegistry') || 
        errorMessage.includes('RNGoogleMobileAdsModule') ||
        errorMessage.includes('could not be found') ||
        errorMessage.includes('Invariant Violation')) {
      if (__DEV__) {
        logger.info('AdMob native module not available (likely Expo Go) - AdMob features disabled');
      }
      return false;
    }
    
    if (__DEV__) {
      logger.warn('react-native-google-mobile-ads not available - AdMob features disabled:', errorMessage);
    }
    return false;
  }
}

// AdMob Configuration
const ADMOB_CONFIG = {
  // Test IDs for development (placeholders since AdMob is disabled)
  TEST_IDS: {
    BANNER: 'test-banner-id',
    INTERSTITIAL: 'test-interstitial-id',
    REWARDED: 'test-rewarded-id',
  },

  // Production IDs - Your actual AdMob IDs
  PRODUCTION_IDS: {
    BANNER: Platform.select({
      ios: 'ca-app-pub-2286247955186424/2580373056',
      android: 'ca-app-pub-2286247955186424/2580373056',
    }) || 'ca-app-pub-2286247955186424/2580373056',

    INTERSTITIAL: Platform.select({
      ios: 'ca-app-pub-2286247955186424/6768822080',
      android: 'ca-app-pub-2286247955186424/6768822080',
    }) || 'ca-app-pub-2286247955186424/6768822080',

    REWARDED: Platform.select({
      ios: 'ca-app-pub-2286247955186424/5504358791',
      android: 'ca-app-pub-2286247955186424/5504358791',
    }) || 'ca-app-pub-2286247955186424/5504358791',
  },
};

// Ad state interface
export interface AdState {
  isBannerLoaded: boolean;
  isInterstitialLoaded: boolean;
  isRewardedLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  lastAdShown: Date | null;
  adCount: number;
}

// Reward interface
export interface AdReward {
  type: 'gems' | 'money' | 'energy' | 'experience';
  amount: number;
}

class AdMobService {
  private state: AdState = {
    isBannerLoaded: false,
    isInterstitialLoaded: false,
    isRewardedLoaded: false,
    isLoading: false,
    error: null,
    lastAdShown: null,
    adCount: 0,
  };

  private listeners: ((state: AdState) => void)[] = [];
  private isProduction = __DEV__ ? false : true; // Set to true for production
  private interstitialAd: any | null = null;
  private rewardedAd: any | null = null;

  // Initialize AdMob service
  async initialize(): Promise<void> {
    try {
      // Skip on web platform
      if (Platform.OS === 'web') {
        if (__DEV__) {
          logger.info('AdMob skipped on web platform');
        }
        this.setState({ isLoading: false, error: null });
        return;
      }

      // Lazy-load the AdMob module
      if (!loadAdMobModule() || !mobileAds) {
        if (__DEV__) {
          logger.info('AdMob module not available - ads disabled (this is normal in Expo Go)');
        }
        this.setState({ isLoading: false, error: null }); // Set error to null, not an error message
        return;
      }

      this.setState({ isLoading: true });

      // Request tracking permission (iOS)
      if (Platform.OS === 'ios') {
        try {
          await requestTrackingPermission();
        } catch (permError) {
          logger.warn('Failed to request tracking permission:', permError);
        }
      }

      // Initialize mobile ads - wrap in try-catch in case native module fails
      try {
        await mobileAds().initialize();
      } catch (initError: any) {
        // Check if it's a native module error
        if (initError?.message?.includes('TurboModuleRegistry') || 
            initError?.message?.includes('RNGoogleMobileAdsModule') ||
            initError?.message?.includes('could not be found')) {
          if (__DEV__) {
            logger.info('AdMob native module not available (likely Expo Go) - ads disabled');
          }
          this.setState({ isLoading: false, error: null });
          return;
        }
        throw initError; // Re-throw if it's a different error
      }

      // Load ads
      await this.loadInterstitialAd();
      await this.loadRewardedAd();

      this.setState({ isLoading: false, error: null });
      logger.info('AdMob service initialized successfully');
    } catch (error: any) {
      // Don't log as error if it's just missing native module (normal in Expo Go)
      if (error?.message?.includes('TurboModuleRegistry') || 
          error?.message?.includes('RNGoogleMobileAdsModule') ||
          error?.message?.includes('could not be found')) {
        if (__DEV__) {
          logger.info('AdMob native module not available (likely Expo Go) - ads disabled');
        }
        this.setState({ isLoading: false, error: null });
      } else {
        logger.error('Failed to initialize AdMob:', error);
        this.setState({ isLoading: false, error: 'Failed to initialize ads' });
      }
    }
  }

  // Get ad unit ID based on environment
  private getAdUnitId(adType: 'banner' | 'interstitial' | 'rewarded'): string {
    if (__DEV__ && TestIds) {
      // Use test IDs in development
      switch (adType) {
        case 'banner':
          return TestIds.BANNER;
        case 'interstitial':
          return TestIds.INTERSTITIAL;
        case 'rewarded':
          return TestIds.REWARDED;
      }
    }

    // Use production IDs
    return ADMOB_CONFIG.PRODUCTION_IDS[adType.toUpperCase() as keyof typeof ADMOB_CONFIG.PRODUCTION_IDS];
  }

  // Load interstitial ad
  async loadInterstitialAd(): Promise<void> {
    try {
      if (!this.shouldShowAds() || !InterstitialAd || !AdEventType) return;

      const adUnitId = this.getAdUnitId('interstitial');
      this.interstitialAd = InterstitialAd.createForAdRequest(adUnitId);

      this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        this.setState({ isInterstitialLoaded: true });
      });

      this.interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        logger.error('Interstitial ad error:', error);
        this.setState({ error: error?.message || 'Ad error' });
      });

      await this.interstitialAd.load();
    } catch (error) {
      logger.error('Failed to load interstitial ad:', error);
    }
  }

  // Show interstitial ad
  async showInterstitialAd(): Promise<boolean> {
    try {
      if (!this.shouldShowAds()) return false;
      if (!this.interstitialAd || !this.state.isInterstitialLoaded) {
        await this.loadInterstitialAd();
        return false;
      }

      const shown = await this.interstitialAd.show();
      if (shown) {
        this.setState({
          isInterstitialLoaded: false,
          lastAdShown: new Date(),
          adCount: this.state.adCount + 1,
        });
        await this.saveAdCount();
        // Reload for next time
        setTimeout(() => this.loadInterstitialAd(), 1000);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to show interstitial ad:', error);
      return false;
    }
  }

  // Load rewarded ad
  async loadRewardedAd(): Promise<void> {
    try {
      if (!this.shouldShowAds() || !RewardedAd || !RewardedAdEventType || !AdEventType) return;

      const adUnitId = this.getAdUnitId('rewarded');
      this.rewardedAd = RewardedAd.createForAdRequest(adUnitId);

      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.setState({ isRewardedLoaded: true });
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward: any) => {
        this.handleReward({
          type: 'gems',
          amount: reward.amount || 10,
        });
      });

      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        logger.error('Rewarded ad error:', error);
        this.setState({ error: error.message });
      });

      await this.rewardedAd.load();
    } catch (error) {
      logger.error('Failed to load rewarded ad:', error);
    }
  }

  // Show rewarded ad
  async showRewardedAd(): Promise<boolean> {
    try {
      if (!this.shouldShowAds()) return false;
      if (!this.rewardedAd || !this.state.isRewardedLoaded) {
        await this.loadRewardedAd();
        return false;
      }

      const shown = await this.rewardedAd.show();
      if (shown) {
        this.setState({
          isRewardedLoaded: false,
          lastAdShown: new Date(),
          adCount: this.state.adCount + 1,
        });
        await this.saveAdCount();
        // Reload for next time
        setTimeout(() => this.loadRewardedAd(), 1000);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to show rewarded ad:', error);
      return false;
    }
  }

  // Handle reward from rewarded ad
  private handleReward = async (reward: AdReward): Promise<void> => {
    try {
      logger.info('User earned reward:', { reward });

      // Apply reward to game state
      await this.applyReward(reward);

      // Load next rewarded ad
      setTimeout(() => {
        this.loadRewardedAd();
      }, 1000);
      // No cleanup needed as it's a singleton service, but we capture the ID
    } catch (error) {
      logger.error('Failed to apply reward:', error);
    }
  };

  // Apply reward to game state
  private async applyReward(reward: AdReward): Promise<void> {
    try {
      // Get current game state
      const gameStateJson = await AsyncStorage.getItem('gameState');
      if (!gameStateJson) return;

      let gameState;
      try {
        gameState = JSON.parse(gameStateJson);
          if (!gameState || typeof gameState !== 'object') {
          logger.error('Invalid game state structure in AdMobService');
          return;
        }
      } catch (parseError) {
        logger.error('Failed to parse game state in AdMobService:', parseError);
        return;
      }

      // Apply reward based on type (local cache used by this service only)
      switch (reward.type) {
        case 'gems':
          gameState.stats.gems = (gameState.stats.gems || 0) + reward.amount;
          break;
        case 'money':
          gameState.stats.money = (gameState.stats.money || 0) + reward.amount;
          break;
        case 'energy':
          gameState.stats.energy = Math.min(100, (gameState.stats.energy || 0) + reward.amount);
          break;
        case 'experience':
          // Add experience to current job or skill
          if (gameState.currentJob) {
            gameState.currentJob.experience = (gameState.currentJob.experience || 0) + reward.amount;
          }
          break;
      }

      // Save updated game state
      await AsyncStorage.setItem('gameState', JSON.stringify(gameState));

      // Persist rewards to the actual save system so they survive restarts
      try {
        if (reward.type === 'gems') {
          // Update global gems used by the real save/load flow
          const newGems = gameState.stats.gems || 0;
          await AsyncStorage.setItem('globalGems', String(newGems));

          // Also patch the last used save slot if present
          const lastSlotStr = await AsyncStorage.getItem('lastSlot');
          const lastSlot = lastSlotStr ? parseInt(lastSlotStr, 10) : NaN;
          if (!isNaN(lastSlot)) {
            const slotKey = `save_slot_${lastSlot}`;
            const slotData = await AsyncStorage.getItem(slotKey);
            if (slotData) {
              try {
                const parsed = JSON.parse(slotData);
                if (parsed && parsed.stats && typeof parsed.stats === 'object') {
                  parsed.stats.gems = Math.max(0, (parsed.stats.gems || 0) + reward.amount);
                  await AsyncStorage.setItem(slotKey, JSON.stringify(parsed));
                }
              } catch { }
            }
          }
        }
      } catch (persistError) {
        logger.warn('Ad reward persistence warning:', persistError as any);
      }

      logger.info('Reward applied successfully:', reward);
    } catch (error) {
      logger.error('Failed to apply reward to game state:', error);
    }
  }

  // Save ad count to storage
  private async saveAdCount(): Promise<void> {
    try {
      await AsyncStorage.setItem('ad_count', this.state.adCount.toString());
    } catch (error) {
      logger.error('Failed to save ad count:', error);
    }
  }

  // Load ad count from storage
  private async loadAdCount(): Promise<void> {
    try {
      const adCountStr = await AsyncStorage.getItem('ad_count');
      if (adCountStr) {
        this.setState({ adCount: parseInt(adCountStr, 10) });
      }
    } catch (error) {
      logger.error('Failed to load ad count:', error);
    }
  }

  // Get banner ad unit ID
  getBannerAdUnitId(): string {
    return this.getAdUnitId('banner');
  }

  // Get banner ad size
  getBannerAdSize(): BannerAdSize {
    return BannerAdSize.BANNER;
  }

  // Check if ads should be shown
  shouldShowAds(): boolean {
    return !iapService.isAdsRemoved();
  }

  // Get state
  getState(): AdState {
    return { ...this.state };
  }

  // Set state and notify listeners
  private setState(updates: Partial<AdState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  // Add state change listener
  addListener(listener: (state: AdState) => void): () => void {
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

  // Show ad at appropriate times
  async showAdAtAppropriateTime(): Promise<void> {
    // Show interstitial ad after certain actions
    // This can be called from game actions like completing a job, buying items, etc.

    const shouldShow = Math.random() < 0.3; // 30% chance to show ad
    if (shouldShow) {
      await this.showInterstitialAd();
    }
  }

  // Cleanup
  destroy(): void {
    this.listeners = [];
    if (this.interstitialAd) {
      this.interstitialAd.removeAllListeners();
    }
    if (this.rewardedAd) {
      this.rewardedAd.removeAllListeners();
    }
  }
}

// Export singleton instance
export const adMobService = new AdMobService();
export default adMobService;
