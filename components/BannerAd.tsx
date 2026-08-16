import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { adMobService } from '@/services/AdMobService';
import type { AdMobPaidEvent } from '@/lib/ads/adRevenueTracking';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import { useGameSettings } from '@/contexts/game';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import { useGemStore } from '@/contexts/GemStoreContext';
import { getThemeColors } from '@/lib/config/theme';
import { scale } from '@/utils/scaling';

interface BannerAdProps {
  style?: any;
}

/**
 * No banner until the player is this many in-game weeks in (one game year).
 *
 * ── Why a new player sees no ads at all ───────────────────────────────────
 * Interstitials already had a 104-week grace (`lib/ads/interstitial.ts`), so a
 * new player met none of those for two game years. The banner had NO grace and
 * rendered on the home tab from week one — which made it the ONLY ad a new
 * player ever saw, and they saw it immediately, in the session where they were
 * still deciding whether to keep the app.
 *
 * A 3-star review named exactly that: "ads would surely ruin it already, so
 * start without them to get more users." The interstitial policy already
 * agreed with that reviewer; the banner had simply never been held to it.
 *
 * One year rather than the interstitial's two: a banner is far less intrusive
 * than a full-screen takeover, so it can start earning sooner. What matters is
 * that the FIRST session is clean, and a first session is nowhere near 52
 * weeks of play.
 */
const BANNER_GRACE_WEEKS = WEEKS_PER_YEAR;

/**
 * BannerAd — renders a Google AdMob banner when the ad SDK is available.
 * Returns null (invisible) when:
 *  - ads are not initialized / module not loaded
 *  - the circuit breaker has tripped
 *  - the ad fails to load
 *  - the player is still inside `BANNER_GRACE_WEEKS`
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

  // Read AFTER the other hooks so hook order stays fixed; the early returns
  // below are all after every hook in this component.
  //
  // `?? 0` alone would let NaN and -Infinity through, and `NaN < GRACE` is
  // FALSE — so a corrupt counter would fail toward showing an ad to a brand-new
  // player, the exact thing the grace exists to prevent. Anything not finite is
  // treated as week zero, which errs toward the quieter first session.
  //
  // Measured in weeks into THIS life, not the absolute counter: `weeksLived` is
  // seeded from the starting age ((age - 18) * 52), so every scenario starting
  // past 18 was already a year "in" on frame one and got banner ads in its first
  // session — the grace applied to exactly one of the eight scenario ages.
  // CLAUDE.md §4.2.
  const weeksLived = useGameSelector((st) =>
    weeksSinceLifeStart(st?.weeksLived, st?.lifeStartWeek)
  );

  if (adError || !isReady || adsRemoved) return null;
  // New players get a clean first year. See BANNER_GRACE_WEEKS.
  if (weeksLived < BANNER_GRACE_WEEKS) return null;

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
