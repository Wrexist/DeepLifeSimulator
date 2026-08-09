import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { adMobService } from '@/services/AdMobService';
import type { AdMobPaidEvent } from '@/lib/ads/adRevenueTracking';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import { useGameSettings } from '@/contexts/game';
import { useGemStore } from '@/contexts/GemStoreContext';
import { getThemeColors } from '@/lib/config/theme';
import { scale } from '@/utils/scaling';

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
  // App-level IAP store launcher (no-op outside the provider — safe here).
  const { openStore } = useGemStore();

  useEffect(() => {
    const unsub = adMobService.addListener((state) => {
      setIsReady(state.isInitialized && !state.error);
    });
    return unsub;
  }, []);

  // Stable handler for the quiet opt-out link (avoids re-creating the arrow on
  // every render of this always-mounted leaf).
  const handleRemoveAdsPress = useCallback(() => openStore('store'), [openStore]);

  // Impression-level ad revenue → RevenueCat's Ads dashboard. AdMob refreshes
  // the banner in place, so this fires repeatedly for one mounted component;
  // the service mints an impression id per event because each paid event is
  // exactly one impression. Fully swallowed inside the service.
  const handlePaid = useCallback((event: AdMobPaidEvent) => {
    adMobService.trackBannerRevenue(adMobService.getBannerAdUnitId(), event);
  }, []);

  // Hide ads if the user purchased Remove Ads or Lifetime Premium. The
  // in-memory service check is empty on a cold start until restorePurchases()
  // completes, so also honor the persisted entitlement saved into game settings
  // (settings.adsRemoved / lifetimePremium) — otherwise ads flash back for
  // payers after every relaunch.
  const settings = useGameSettings();
  const adsRemoved =
    settings?.adsRemoved === true
    || settings?.lifetimePremium === true
    || iapService.hasPurchased(IAP_PRODUCTS.REMOVE_ADS)
    || iapService.hasPurchased(IAP_PRODUCTS.LIFETIME_PREMIUM);

  if (adError || !isReady || adsRemoved) return null;

  const NativeBanner = adMobService.getNativeBannerAd();
  const BannerSize = adMobService.getBannerAdSize();
  const unitId = adMobService.getBannerAdUnitId();

  if (!NativeBanner || !BannerSize || !unitId) return null;

  // Muted link color pulled from the theme's textMuted (dark theme resolves to
  // the same slate this used to hardcode) — no new game-state subscription, the
  // settings hook is already read above for the ad-removed entitlement.
  const removeAdsColor = getThemeColors(settings?.darkMode ?? true).textMuted;

  return (
    <View style={[styles.container, style]}>
      <NativeBanner
        unitId={unitId}
        size={BannerSize.ANCHORED_ADAPTIVE_BANNER}
        // P0-5: non-personalized ads unless ATT/consent is granted.
        requestOptions={adMobService.adRequestOptions()}
        onAdFailedToLoad={() => setAdError(true)}
        onPaid={handlePaid}
      />
      {/* Quiet opt-out: a small muted text link (not a button) sitting BELOW the
          banner — never overlapping it, and only ever rendered while ads are
          active (the component returns null when ads are removed). hitSlop lifts
          the tap target to ≥ touchTargets.minimum without changing layout. */}
      <TouchableOpacity
        onPress={handleRemoveAdsPress}
        hitSlop={{ top: scale(16), bottom: scale(16), left: scale(16), right: scale(16) }}
        accessibilityRole="button"
        accessibilityLabel="Remove ads"
      >
        <Text style={[styles.removeAdsText, { color: removeAdsColor }]}>Remove ads</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  removeAdsText: {
    marginTop: scale(4),
    fontSize: scale(11),
    // color is theme-driven (applied inline) — see removeAdsColor.
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
