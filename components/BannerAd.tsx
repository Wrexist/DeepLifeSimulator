import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { adMobService, AdState } from '@/services/AdMobService';
import { logger } from '@/utils/logger';

// Conditional import for native-only AdMob components
let GoogleBannerAd: any = null;
let BannerAdSize: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admobModule = require('react-native-google-mobile-ads');
    GoogleBannerAd = admobModule.BannerAd;
    BannerAdSize = admobModule.BannerAdSize;
  } catch (error) {
    // AdMob not available
  }
}

interface BannerAdProps {
  style?: any;
}

export default function BannerAd({ style }: BannerAdProps) {
  // Return null on web or if AdMob components not available
  if (Platform.OS === 'web' || !GoogleBannerAd || !BannerAdSize) {
    return null;
  }

  const [adState, setAdState] = useState<AdState>(adMobService.getState());
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const unsubscribe = adMobService.addListener(setAdState);
    
    // Check if ads should be shown
    const checkAdVisibility = () => {
      const shouldShowAds = adMobService.shouldShowAds();
      setShouldShow(shouldShowAds);
    };
    
    checkAdVisibility();
    
    return unsubscribe;
  }, []);

  if (!shouldShow) {
    return null;
  }

  const adUnitId = adMobService.getBannerAdUnitId();
  const adSize = adMobService.getBannerAdSize();

  return (
    <View style={[styles.container, style]}>
      <GoogleBannerAd
        unitId={adUnitId}
        size={adSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          setAdState(prev => ({ ...prev, isBannerLoaded: true }));
        }}
        onAdFailedToLoad={(error) => {
          logger.error('Banner ad failed to load:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
