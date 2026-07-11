import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MessageCircle, DollarSign, Gift } from 'lucide-react-native';
import { useGameState } from '@/contexts/game';
import { safeSettings } from '@/utils/safeGameState';
import {
  scale,
  responsivePadding,
  responsiveBorderRadius,
  responsiveFontSize,
  responsiveSpacing,
} from '@/utils/scaling';

interface CommunityRewardPopupProps {
  visible: boolean;
  /** One-time cash reward granted on join. */
  rewardAmount: number;
  /** Claim the reward + open Discord. */
  onJoin: () => void;
  /** Quietly dismiss ("Maybe later") — won't nag again this install. */
  onDismiss: () => void;
}

/**
 * CommunityRewardPopup — a sleek, low-key invite to join the Discord community
 * in exchange for a one-time cash reward. Presentational only: the parent owns
 * the grant + persistence (shared `discord_reward_claimed` flag) so it can't be
 * double-claimed with the Settings entry point.
 *
 * Visual language matches DailyRewardPopup (scale+fade sheet, dark/light palette)
 * so it feels native and unobtrusive rather than like an ad.
 */
export default function CommunityRewardPopup({
  visible,
  rewardAmount,
  onJoin,
  onDismiss,
}: CommunityRewardPopupProps) {
  const { gameState } = useGameState();
  const settings = safeSettings(gameState);
  const isDarkMode = settings?.darkMode || false;
  const safeRewardAmount =
    typeof rewardAmount === 'number' && isFinite(rewardAmount) && rewardAmount >= 0 ? rewardAmount : 0;

  const isMountedRef = useRef(true);
  // Guards a single tap from firing join/dismiss twice during the exit animation.
  const actionInProgressRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) actionInProgressRef.current = false;
  }, [visible]);

  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.96);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, scaleAnim, fadeAnim]);

  const animateOut = (then: () => void) => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 160, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      if (isMountedRef.current) then();
    });
  };

  const handleJoin = () => animateOut(onJoin);
  const handleDismiss = () => animateOut(onDismiss);

  const palette = isDarkMode
    ? {
        backdrop: 'rgba(0, 0, 0, 0.65)',
        sheet: '#0F172A',
        border: 'rgba(255,255,255,0.06)',
        title: '#F9FAFB',
        subtitle: '#94A3B8',
        infoBg: 'rgba(255,255,255,0.04)',
        infoText: '#D1D5DB',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.55)',
        sheet: '#FFFFFF',
        border: 'rgba(15,23,42,0.06)',
        title: '#0F172A',
        subtitle: '#64748B',
        infoBg: '#F1F5F9',
        infoText: '#475569',
      };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={[styles.overlay, { backgroundColor: palette.backdrop }]}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.sheet,
              borderColor: palette.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <MessageCircle size={scale(28)} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </View>

          <Text style={[styles.title, { color: palette.title }]}>Join the Community</Text>
          <Text style={[styles.subtitle, { color: palette.subtitle }]}>
            Tips, updates &amp; a welcome gift from the team
          </Text>

          {safeRewardAmount > 0 && (
            <View style={[styles.rewardRow, { borderColor: palette.border, backgroundColor: palette.infoBg }]}>
              <View style={[styles.rewardIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <DollarSign size={scale(20)} color="#10B981" strokeWidth={2.4} />
              </View>
              <Text style={[styles.rewardLabel, { color: palette.subtitle }]}>Welcome bonus</Text>
              <Text style={[styles.rewardAmount, { color: palette.title }]}>
                +${safeRewardAmount.toLocaleString()}
              </Text>
            </View>
          )}

          <View style={[styles.infoBlock, { backgroundColor: palette.infoBg, borderColor: palette.border }]}>
            <View style={styles.infoRow}>
              <Gift size={scale(14)} color={palette.subtitle} />
              <Text style={[styles.infoText, { color: palette.infoText }]}>
                Opens Discord — your reward is added instantly, one time.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoin}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Join our Discord and claim ${safeRewardAmount.toLocaleString()} dollars`}
          >
            <Text style={styles.joinButtonText}>
              {safeRewardAmount > 0 ? `Join & Claim $${safeRewardAmount.toLocaleString()}` : 'Join Our Discord'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
          >
            <Text style={[styles.dismissText, { color: palette.subtitle }]}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  sheet: {
    width: '100%',
    maxWidth: scale(360),
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: responsiveSpacing.lg,
    paddingTop: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.md,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  iconCircle: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    // Discord blurple — recognizable but understated.
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    marginTop: scale(2),
    marginBottom: responsiveSpacing.md,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  rewardIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardLabel: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
  },
  rewardAmount: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  infoBlock: {
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: scale(6),
    marginBottom: responsiveSpacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: responsiveFontSize.xs,
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#5865F2',
    borderRadius: responsiveBorderRadius.lg,
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dismissButton: {
    paddingVertical: responsiveSpacing.sm,
    marginTop: scale(4),
    alignItems: 'center',
  },
  dismissText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
  },
});
