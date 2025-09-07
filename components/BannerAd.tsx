import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
// import { AdMobBanner } from 'expo-ads-admob';
import { adMobService, AdState } from '@/services/AdMobService';

interface BannerAdProps {
  style?: any;
}

export default function BannerAd({ style }: BannerAdProps) {
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

  const bannerProps = adMobService.getBannerAdProps();

  return (
    <View style={[styles.container, style]}>
      {/* <AdMobBanner
        {...bannerProps}
        onDidFailToReceiveAdWithError={(error: any) => {
          console.error('Banner ad failed:', error);
        }}
      /> */}
      <Text>Banner Ad Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
