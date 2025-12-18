import React from 'react';
import { View, StyleSheet } from 'react-native';

// CRITICAL: AdMob COMPLETELY DISABLED
// AdMob native module causes TurboModule crashes during app initialization
// This component now returns null until AdMob is fixed or replaced
//
// To re-enable:
// 1. Fix native AdMob crashes
// 2. Uncomment code below
// 3. Rebuild the app

interface BannerAdProps {
  style?: any;
}

export default function BannerAd({ style }: BannerAdProps) {
  // AdMob completely disabled - return null (no ads shown)
  return null;

  /* ORIGINAL CODE - DISABLED
  import { adMobService, AdState } from '@/services/AdMobService';
  import { logger } from '@/utils/logger';

  // CRITICAL: AdMob EMERGENCY DISABLED
  // AdMob is causing native TurboModule crashes during initialization
  // This is a temporary fix for TestFlight stability
  const ADMOB_EMERGENCY_DISABLE = true;

  // Conditional import for native-only AdMob components
  let GoogleBannerAd: any = null;
  let BannerAdSize: any = null;

  if (!ADMOB_EMERGENCY_DISABLE && Platform.OS !== 'web') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const admobModule = require('react-native-google-mobile-ads');
      GoogleBannerAd = admobModule.BannerAd;
      BannerAdSize = admobModule.BannerAdSize;
    } catch (error) {
      // AdMob not available
    }
  } else if (ADMOB_EMERGENCY_DISABLE) {
    logger.info('AdMob banner ads emergency disabled for TestFlight stability');
  }

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
  END DISABLED CODE */
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
