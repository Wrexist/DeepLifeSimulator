/**
 * The year-end break's intro card (lib/ads/yearEndBreak.ts).
 *
 * AdMob's rewarded-interstitial policy requires an intro before the ad that
 * names the reward and lets the player opt out. This is it: "Year N complete -
 * an ad starts in 5 s for +15 gems", with No thanks and Watch now. Skipping
 * costs nothing and is never asked again for that boundary.
 *
 * A plain absolute-fill View, NOT a react-native Modal: the ad presents its own
 * fullscreen view controller, and presenting one over an open RN Modal strands
 * an invisible touch-swallowing window on iOS (see lib/ads/rewardedAd.ts). The
 * View still blocks touches to the tabs, so Next Week cannot be tapped under it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gem } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSetGameState, useGameStateGetter } from '@/contexts/game/useGameSelector';
import { useInterruptionSlot, INTERRUPTION_PRIORITY } from '@/contexts/InterruptionContext';
import { areAdsRemoved } from '@/lib/ads/rewardedAd';
import {
  YEAR_END_BREAK,
  applyYearEndReward,
  claimYearEndReward,
  closeYearEndOffer,
  getYearEndOffer,
  subscribeYearEndOffer,
  type YearEndOffer,
} from '@/lib/ads/yearEndBreak';
import { uiPalette } from '@/lib/config/theme';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { fontScale, responsiveSpacing, scale, touchTargets } from '@/utils/scaling';
import { logger } from '@/utils/logger';

/** How long an offer may wait for the interruption slot before it is dropped. */
const SLOT_WAIT_MS = 8000;

export default function YearEndBreak() {
  const { theme } = useTheme();
  const setGameState = useSetGameState();
  const getGameState = useGameStateGetter();
  const [offer, setOffer] = useState<YearEndOffer | null>(getYearEndOffer);
  const [secondsLeft, setSecondsLeft] = useState<number>(YEAR_END_BREAK.introSeconds);
  const [playing, setPlaying] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => subscribeYearEndOffer(setOffer), []);

  // Held for the whole offer, INCLUDING while the ad plays: releasing it when
  // the ad starts would let a reward Modal present under the ad.
  const granted = useInterruptionSlot('ad:year-end-break', INTERRUPTION_PRIORITY.AD_BREAK, !!offer);

  // An offer that never gets the slot (a life moment, the week's interruption
  // budget) is dropped: the break belongs to this boundary, not a later week.
  useEffect(() => {
    if (!offer || granted || playing) return undefined;
    const t = setTimeout(() => closeYearEndOffer(), SLOT_WAIT_MS);
    return () => clearTimeout(t);
  }, [offer, granted, playing]);

  // Reset for each new offer.
  useEffect(() => {
    if (!offer) return;
    startedRef.current = false;
    setPlaying(false);
    setSecondsLeft(YEAR_END_BREAK.introSeconds);
  }, [offer]);

  const play = async () => {
    const current = getYearEndOffer();
    if (!current || startedRef.current) return;
    startedRef.current = true;
    setPlaying(true);
    try {
      // Re-read the entitlement: a Remove Ads purchase may have landed while
      // the card was up.
      if (areAdsRemoved(getGameState())) return;
      const { adMobService } = await import('@/services/AdMobService');
      await adMobService.showRewardedInterstitialAd(() => {
        if (!claimYearEndReward(current.boundaryWeek)) return;
        setGameState((prev) => applyYearEndReward(prev, current.boundaryWeek));
      }, { placement: 'year_end' });
    } catch (error) {
      logger.warn('[ads] year-end break failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPlaying(false);
      closeYearEndOffer();
    }
  };

  // Countdown, once the card is actually on screen.
  useEffect(() => {
    if (!offer || !granted || playing) return undefined;
    if (secondsLeft <= 0) {
      void play();
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play reads live state through refs/getters
  }, [offer, granted, playing, secondsLeft]);

  useEffect(() => {
    if (offer && granted && !playing) {
      AccessibilityInfo?.announceForAccessibility?.(
        `Year ${offer.yearNumber} complete. An optional ad for ${YEAR_END_BREAK.rewardGems} gems starts soon. You can skip it.`,
      );
    }
  }, [offer, granted, playing]);

  if (!offer || !granted || playing) return null;

  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={styles.iconCircle}>
          <Gem size={scale(26)} color={uiPalette.white} strokeWidth={2.4} />
        </View>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Year {offer.yearNumber} complete
        </Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          Watch a short ad and get +{YEAR_END_BREAK.rewardGems} gems.
        </Text>
        <Text style={[styles.countdown, { color: theme.textSecondary }]}>
          Ad starts in {secondsLeft}s
        </Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => closeYearEndOffer()}
            accessibilityRole="button"
            accessibilityLabel="No thanks, skip the ad"
            style={[styles.button, styles.secondary, { borderColor: theme.border }]}
          >
            <Text style={[styles.secondaryText, { color: theme.text }]}>No thanks</Text>
          </Pressable>
          <Pressable
            onPress={() => { void play(); }}
            accessibilityRole="button"
            accessibilityLabel={`Watch the ad now for ${YEAR_END_BREAK.rewardGems} gems`}
            style={[styles.button, styles.primary]}
          >
            <Text style={styles.primaryText}>Watch now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 20, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    zIndex: Z_INDEX.MODAL,
    elevation: Z_INDEX.MODAL,
  },
  card: {
    width: '100%',
    maxWidth: scale(360),
    borderRadius: scale(20),
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: fontScale(15),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
  countdown: {
    fontSize: fontScale(13),
    marginTop: responsiveSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    minHeight: touchTargets.minimum,
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.sm,
  },
  secondary: {
    borderWidth: 1,
  },
  primary: {
    backgroundColor: '#8B5CF6',
  },
  secondaryText: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  primaryText: {
    color: uiPalette.white,
    fontSize: fontScale(15),
    fontWeight: '600',
  },
});
