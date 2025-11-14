// AdMob functionality temporarily disabled - deprecated package removed
// Note: Can be re-implemented with react-native-google-mobile-ads if needed
/* import {
  AdMobBanner,
  AdMobInterstitial,
  AdMobRewarded,
  setTestDeviceIDAsync,
  BannerAdSize,
  TestIds,
} from 'expo-ads-admob'; */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { iapService } from './IAPService';
import { requestTrackingPermission } from '@/utils/trackingTransparency';

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
    // AdMob functionality temporarily disabled
    console.log('AdMob service disabled - deprecated package removed');
    this.setState({ isLoading: false, error: null });
    return Promise.resolve();
  }

  // Get ad unit ID based on environment
  private getAdUnitId(adType: 'banner' | 'interstitial' | 'rewarded'): string {
    if (this.isProduction) {
      return ADMOB_CONFIG.PRODUCTION_IDS[adType.toUpperCase() as keyof typeof ADMOB_CONFIG.PRODUCTION_IDS];
    } else {
      return ADMOB_CONFIG.TEST_IDS[adType.toUpperCase() as keyof typeof ADMOB_CONFIG.TEST_IDS];
    }
  }

  // Load interstitial ad
  async loadInterstitialAd(): Promise<void> {
    // AdMob functionality temporarily disabled
    return Promise.resolve();
  }

  // Show interstitial ad
  async showInterstitialAd(): Promise<boolean> {
    // AdMob functionality temporarily disabled
    return Promise.resolve(false);
  }

  // Load rewarded ad
  async loadRewardedAd(): Promise<void> {
    // AdMob functionality temporarily disabled
    return Promise.resolve();
  }

  // Show rewarded ad
  async showRewardedAd(): Promise<boolean> {
    // AdMob functionality temporarily disabled
    return Promise.resolve(false);
  }

  // Handle reward from rewarded ad
  private handleReward = async (reward: AdReward): Promise<void> => {
    try {
      console.log('User earned reward:', reward);
      
      // Apply reward to game state
      await this.applyReward(reward);
      
      // Load next rewarded ad
      setTimeout(() => {
        this.loadRewardedAd();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to apply reward:', error);
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
          console.error('Invalid game state structure in AdMobService');
          return;
        }
      } catch (parseError) {
        console.error('Failed to parse game state in AdMobService:', parseError);
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
              } catch {}
            }
          }
        }
      } catch (persistError) {
        console.warn('Ad reward persistence warning:', persistError);
      }
      
      console.log('Reward applied successfully:', reward);
    } catch (error) {
      console.error('Failed to apply reward to game state:', error);
    }
  }

  // Save ad count to storage
  private async saveAdCount(): Promise<void> {
    try {
      await AsyncStorage.setItem('ad_count', this.state.adCount.toString());
    } catch (error) {
      console.error('Failed to save ad count:', error);
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
      console.error('Failed to load ad count:', error);
    }
  }

  // Get banner ad component props
  getBannerAdProps() {
    // AdMob functionality temporarily disabled
    return {
      bannerSize: 'BANNER',
      adUnitID: '',
      servePersonalizedAds: false,
      onDidFailToReceiveAdWithError: (error: any) => {
        console.log('AdMob disabled');
      },
    };
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
