import {
  AdMobBanner,
  AdMobInterstitial,
  AdMobRewarded,
  setTestDeviceIDAsync,
  BannerAdSize,
  TestIds,
} from 'expo-ads-admob';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { iapService } from './IAPService';

// AdMob Configuration
const ADMOB_CONFIG = {
  // Test IDs for development
  TEST_IDS: {
    BANNER: TestIds.BANNER,
    INTERSTITIAL: TestIds.INTERSTITIAL,
    REWARDED: TestIds.REWARDED,
  },
  
  // Production IDs - Replace with your actual AdMob IDs
  PRODUCTION_IDS: {
    BANNER: Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    }) || 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    
    INTERSTITIAL: Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    }) || 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    
    REWARDED: Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    }) || 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
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
  private interstitialAd: AdMobInterstitial | null = null;
  private rewardedAd: AdMobRewarded | null = null;

  // Initialize AdMob service
  async initialize(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });
      
      // Set test device ID for development
      if (!this.isProduction) {
        await setTestDeviceIDAsync('EMULATOR');
      }
      
      // Load ads
      await this.loadInterstitialAd();
      await this.loadRewardedAd();
      
      // Load ad count from storage
      await this.loadAdCount();
      
      this.setState({ isLoading: false });
      console.log('AdMob service initialized successfully');
    } catch (error) {
      console.error('AdMob initialization error:', error);
      this.setState({ 
        isLoading: false, 
        error: `AdMob initialization failed: ${error}` 
      });
    }
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
    try {
      if (this.interstitialAd) {
        await this.interstitialAd.dismissAsync();
      }

      this.interstitialAd = new AdMobInterstitial(this.getAdUnitId('interstitial'));
      
      await this.interstitialAd.loadAsync();
      this.setState({ isInterstitialLoaded: true });
      
      console.log('Interstitial ad loaded successfully');
    } catch (error) {
      console.error('Failed to load interstitial ad:', error);
      this.setState({ 
        isInterstitialLoaded: false,
        error: `Failed to load interstitial ad: ${error}` 
      });
    }
  }

  // Show interstitial ad
  async showInterstitialAd(): Promise<boolean> {
    try {
      // Check if ads are removed
      if (iapService.isAdsRemoved()) {
        console.log('Ads removed - skipping interstitial');
        return false;
      }

      // Check if ad is loaded
      if (!this.state.isInterstitialLoaded || !this.interstitialAd) {
        console.log('Interstitial ad not loaded');
        await this.loadInterstitialAd();
        return false;
      }

      // Check ad frequency (don't show too often)
      if (this.state.lastAdShown) {
        const timeSinceLastAd = Date.now() - this.state.lastAdShown.getTime();
        if (timeSinceLastAd < 60000) { // 1 minute minimum between ads
          console.log('Ad shown too recently, skipping');
          return false;
        }
      }

      await this.interstitialAd.showAsync();
      
      this.setState({ 
        lastAdShown: new Date(),
        adCount: this.state.adCount + 1 
      });
      
      await this.saveAdCount();
      
      // Load next ad
      setTimeout(() => {
        this.loadInterstitialAd();
      }, 1000);
      
      console.log('Interstitial ad shown successfully');
      return true;
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      this.setState({ error: `Failed to show interstitial ad: ${error}` });
      return false;
    }
  }

  // Load rewarded ad
  async loadRewardedAd(): Promise<void> {
    try {
      if (this.rewardedAd) {
        await this.rewardedAd.dismissAsync();
      }

      this.rewardedAd = new AdMobRewarded(this.getAdUnitId('rewarded'));
      
      // Set up event listeners
      this.rewardedAd.addEventListener('rewardedVideoUserDidEarnReward', this.handleReward);
      this.rewardedAd.addEventListener('rewardedVideoDidLoad', () => {
        this.setState({ isRewardedLoaded: true });
      });
      this.rewardedAd.addEventListener('rewardedVideoDidFailToLoad', (error) => {
        this.setState({ 
          isRewardedLoaded: false,
          error: `Rewarded ad failed to load: ${error}` 
        });
      });
      
      await this.rewardedAd.loadAsync();
      console.log('Rewarded ad loaded successfully');
    } catch (error) {
      console.error('Failed to load rewarded ad:', error);
      this.setState({ 
        isRewardedLoaded: false,
        error: `Failed to load rewarded ad: ${error}` 
      });
    }
  }

  // Show rewarded ad
  async showRewardedAd(): Promise<boolean> {
    try {
      // Check if ads are removed
      if (iapService.isAdsRemoved()) {
        console.log('Ads removed - skipping rewarded ad');
        return false;
      }

      // Check if ad is loaded
      if (!this.state.isRewardedLoaded || !this.rewardedAd) {
        console.log('Rewarded ad not loaded');
        await this.loadRewardedAd();
        return false;
      }

      await this.rewardedAd.showAsync();
      
      this.setState({ 
        lastAdShown: new Date(),
        adCount: this.state.adCount + 1 
      });
      
      await this.saveAdCount();
      
      console.log('Rewarded ad shown successfully');
      return true;
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      this.setState({ error: `Failed to show rewarded ad: ${error}` });
      return false;
    }
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

      const gameState = JSON.parse(gameStateJson);

      // Apply reward based on type
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
    return {
      bannerSize: BannerAdSize.BANNER,
      adUnitID: this.getAdUnitId('banner'),
      servePersonalizedAds: true,
      onDidFailToReceiveAdWithError: (error: any) => {
        console.error('Banner ad failed to load:', error);
        this.setState({ error: `Banner ad failed: ${error}` });
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
