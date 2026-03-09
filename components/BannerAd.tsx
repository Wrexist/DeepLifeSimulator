import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { adMobService } from '@/services/AdMobService';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';

interface BannerAdProps {
  style?: any;
}

/**
 * BannerAd — renders a Google AdMob banner when the ad SDK is available.
 * Returns null (invisible) when:
 *  - ads are not initialized / module not loaded
 *  - the circuit breaker has tripped
 *  - the ad fails to load
 *
 * Never crashes — all failures result in hiding the banner.
 */
export default function BannerAd({ style }: BannerAdProps) {
  const [adError, setAdError] = useState(false);
  const [isReady, setIsReady] = useState(adMobService.isAvailable());

  useEffect(() => {
    const unsub = adMobService.addListener((state) => {
      setIsReady(state.isInitialized && !state.error);
    });
    return unsub;
  }, []);

  // Hide ads if user purchased Remove Ads or Lifetime Premium
  const adsRemoved = iapService.hasPurchased(IAP_PRODUCTS.REMOVE_ADS)
    || iapService.hasPurchased(IAP_PRODUCTS.LIFETIME_PREMIUM);

  if (adError || !isReady || adsRemoved) return null;

  const NativeBanner = adMobService.getNativeBannerAd();
  const BannerSize = adMobService.getBannerAdSize();
  const unitId = adMobService.getBannerAdUnitId();

  if (!NativeBanner || !BannerSize || !unitId) return null;

  return (
    <View style={[styles.container, style]}>
      <NativeBanner
        unitId={unitId}
        size={BannerSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setAdError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
