/**
 * RewardedAdModal — watch ad for a follower boost.
 *
 * 1-per-week cap enforced by `watchAdForFollowerBoost` via weeksLived.
 * Verified Pro triples the reward (50 → 150 followers).
 */
import React, { useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Play, Users } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
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

  const handleWatch = useCallback(async () => {
    // P0-4: actually show a rewarded video ad and grant the boost ONLY when the
    // ad reports the reward earned. Previously the follower boost was granted with
    // no ad ever shown — a deceptive-UX (Apple 2.3.1) risk and lost ad revenue.
    const adsOn = isFeatureEnabled('adMob') && Platform.OS !== 'web';
    if (adsOn) {
      try {
        const { adMobService } = await import('@/services/AdMobService');
        const shown = await adMobService.showRewardedAd(() => {
          watchAdForFollowerBoost(setGameState, gameState);
        });
        if (shown) {
          pulseHaptics.success();
          onDismiss();
        } else {
          // Ad wasn't available — do NOT silently grant the reward.
          pulseHaptics.error();
        }
      } catch {
        pulseHaptics.error();
      }
      return;
    }
    // Ads disabled (dev / boring build) — there is no ad system to show, so grant
    // directly. Not deceptive: this configuration ships no ads at all.
    const result = watchAdForFollowerBoost(setGameState, gameState);
    if (result.success) {
      pulseHaptics.success();
      onDismiss();
    } else {
      pulseHaptics.error();
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
