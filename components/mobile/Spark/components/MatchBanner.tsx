/**
 * MatchBanner - celebratory full-screen overlay when a match lands.
 *
 * Two side-by-side avatars with a pulsing flame between them,
 * "It's a match!" headline, and CTA to message the new match. Auto-dismisses
 * after 1.6s or on tap.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Flame, MessageCircle, X } from 'lucide-react-native';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { SPARK_COLORS, SPARK_MOTION } from '../styles/sparkTheme';
import { withAlpha } from '@/lib/config/theme';

interface MatchBannerProps {
  visible: boolean;
  partnerName: string;
  /** Remote URI for the partner's photo (degrades to an initial on load fail). */
  partnerPhoto?: string;
  /**
   * The dating profile behind the match. Takes precedence over `partnerPhoto`:
   * profiles no longer carry a photo URI, their face is derived from the id.
   */
  partnerFace?: { id: string; gender?: string; age?: number };
  playerPhoto?: string;
  onMessage: () => void;
  onDismiss: () => void;
}

export default function MatchBanner({
  visible, partnerName, partnerPhoto, partnerFace, playerPhoto, onMessage, onDismiss,
}: MatchBannerProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(1)).current;

  const reduced = useReducedMotion();
  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduced ? 0 : SPARK_MOTION.matchCelebration,
      useNativeDriver: true,
    }).start();
    if (!reduced) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flameScale, { toValue: 1.12, duration: SPARK_MOTION.flameLoop / 2, useNativeDriver: true }),
          Animated.timing(flameScale, { toValue: 1, duration: SPARK_MOTION.flameLoop / 2, useNativeDriver: true }),
        ]),
      ).start();
    }
    return () => {
      flameScale.stopAnimation();
    };
  }, [visible, opacity, flameScale, reduced]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.root, { opacity }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(SPARK_COLORS.accent, 0.93) }]}
      />

      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close match banner"
        hitSlop={8}
        style={styles.close}
      >
        <X size={fontScale(22)} color="#FFFFFF" />
      </Pressable>

      <View style={styles.avatarsRow}>
        <View style={styles.avatarWrap}>
          {/* R5-A: degrade to initial letter on load failure. */}
          <ImageWithFallback uri={playerPhoto} fallback="Y" style={styles.avatar} />
        </View>

        <Animated.View style={[styles.flameWrap, { transform: [{ scale: flameScale }] }]}>
          <Flame size={scale(56)} color="#FFFFFF" fill="#FFFFFF" />
        </Animated.View>

        <View style={styles.avatarWrap}>
          {partnerFace ? (
            <CharacterAvatar
              seed={partnerFace.id}
              sex={partnerFace.gender}
              age={partnerFace.age ?? 25}
              size={AVATAR_SIZE}
            />
          ) : (
            <ImageWithFallback uri={partnerPhoto} fallback={partnerName} style={styles.avatar} />
          )}
        </View>
      </View>

      <Text style={styles.title}>It's a match!</Text>
      <Text style={styles.subtitle}>You and {partnerName} liked each other</Text>

      <View style={styles.ctaRow}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Keep swiping"
          style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.btnSecondaryText}>Keep swiping</Text>
        </Pressable>
        <Pressable
          onPress={onMessage}
          accessibilityRole="button"
          accessibilityLabel={`Message ${partnerName}`}
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
        >
          <MessageCircle size={fontScale(16)} color={SPARK_COLORS.accent} strokeWidth={2.4} />
          <Text style={[styles.btnPrimaryText, { color: SPARK_COLORS.accent }]}>Send a message</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const AVATAR_SIZE = scale(110);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.xl,
    zIndex: Z_INDEX.MODAL,
  },
  close: {
    position: 'absolute',
    top: scale(48),
    right: scale(24),
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(-16),
    marginBottom: responsiveSpacing.lg,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  flameWrap: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scale(-12),
    zIndex: 2,
  },
  // The one headline on this screen - the only heavy weight left in Spark.
  title: {
    color: '#FFFFFF',
    fontSize: fontScale(36),
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontScale(15),
    marginTop: 6,
    marginBottom: responsiveSpacing.xl,
    textAlign: 'center',
  },
  ctaRow: {
    width: '100%',
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  btnSecondary: {
    flex: 1,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    borderRadius: scale(14),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1.4,
    minHeight: touchTargets.minimum,
    paddingVertical: responsiveSpacing.md,
    borderRadius: scale(14),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnPrimaryText: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});
