/**
 * RewardedAdModal — watch ad for a follower boost.
 *
 * 1-per-week cap enforced by `watchAdForFollowerBoost` via weeksLived.
 * Verified Pro triples the reward (50 → 150 followers).
 */
import React, { useCallback, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Play, Users } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { adsAvailable, areAdsRemoved, runRewardedAd, isGranted } from '@/lib/ads/rewardedAd';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { watchAdForFollowerBoost } from '@/contexts/game/actions/PulseActions';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

const LinearGradient = LinearGradientFallback;

interface RewardedAdModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function RewardedAdModal({ visible, onDismiss }: RewardedAdModalProps) {
  const { gameState, setGameState } = useGame();
  const { theme } = useTheme();

  const proActive = gameState.socialMedia?.verifiedPro?.active === true;
  const expectedFollowers = proActive ? 150 : 50;

  // Re-entrancy guard for rapid double-taps on the CTA.
  const busyRef = useRef(false);

  const handleWatch = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      // P0-4: show a rewarded video ad and grant the boost ONLY when the ad
      // reports the reward earned (or when there's no ad to show — dev / ad-free).
      // Granting with no ad in an ads-on build is a deceptive-UX (Apple 2.3.1) risk
      // and lost revenue. All that logic lives in the shared `runRewardedAd`.
      const adsRemoved = areAdsRemoved(gameState);
      if (adsAvailable(adsRemoved)) {
        // A real fullscreen ad is about to present. Showing it over this open
        // RN Modal is unsupported by the ad SDK (iOS: the sheet vanishes but an
        // invisible modal window keeps eating touches — total freeze — and the
        // reward callback is lost). Dismiss the sheet FIRST and give the native
        // teardown a beat before the ad presents.
        onDismiss();
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
      }
      let result = { success: false };
      const outcome = await runRewardedAd(
        () => {
          result = watchAdForFollowerBoost(setGameState, gameState);
        },
        { adsRemoved },
      );
      // Reward earned AND the weekly cooldown allowed the grant.
      if (isGranted(outcome) && result.success) {
        pulseHaptics.success();
        onDismiss(); // no-op when the ads path already dismissed the sheet
      } else {
        pulseHaptics.error();
      }
    } finally {
      busyRef.current = false;
    }
  }, [setGameState, gameState, onDismiss]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <Play size={scale(36)} color="#FFFFFF" strokeWidth={2.4} fill="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>Watch ad → followers</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Watch a short video ad to gain followers instantly.
          </Text>

          <View style={[styles.rewardCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <View style={styles.rewardRow}>
              <Users size={fontScale(20)} color={PULSE_GRADIENT[0]} />
              <Text style={[styles.rewardValue, { color: theme.text }]}>
                +{expectedFollowers}
              </Text>
              <Text style={[styles.rewardLabel, { color: theme.textSecondary }]}>followers</Text>
            </View>
            {proActive ? (
              <Text style={[styles.proBoost, { color: PULSE_COLORS.verified }]}>
                Verified Pro: ×3 reward
              </Text>
            ) : null}
            <Text style={[styles.note, { color: theme.textMuted }]}>
              Once per in-game week.
            </Text>
          </View>

          <Pressable
            onPress={handleWatch}
            accessibilityRole="button"
            accessibilityLabel="Watch ad"
            style={styles.cta}
          >
            <LinearGradient
              colors={PULSE_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaFill}
            >
              <Text style={styles.ctaText}>Watch ad ▶</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'center',
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(22),
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontScale(13),
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.lg,
  },
  rewardCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
    gap: 4,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rewardValue: {
    fontSize: fontScale(28),
    fontWeight: '700',
  },
  rewardLabel: {
    fontSize: fontScale(13),
  },
  proBoost: {
    fontSize: fontScale(12),
    fontWeight: '600',
    marginTop: 2,
  },
  note: {
    fontSize: fontScale(11),
    marginTop: 4,
  },
  cta: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  ctaFill: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
