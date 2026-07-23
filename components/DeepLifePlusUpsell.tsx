/**
 * DeepLifePlusUpsell — one component, three looks, all opening the DeepLife+
 * paywall via the shared `useDeepLifePlusUpsell` hook and all self-hiding for
 * existing members.
 *
 *   variant="banner"  — a fancy full-width gold card for the gem/IAP shop.
 *   variant="inline"  — a compact "go ad-free" pill for the rewarded-ad sheet.
 *   variant="badge"   — a small glowing crown to pin beside the player avatar.
 *
 * Each instance owns its own SubscriptionModal fallback (only shown when the
 * RevenueCat paywall isn't available), so you can drop it anywhere.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ImageBackground, StyleProp, ViewStyle } from 'react-native';
import { Crown, ChevronRight, Sparkles } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import SubscriptionModal from '@/components/SubscriptionModal';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS } from '@/lib/subscription/deepLifePlus';
import { scale, fontScale } from '@/utils/scaling';

const LinearGradient = LinearGradientFallback;

// Bespoke banner art: a glowing gold crown anchored left over a dark navy field,
// with a deliberately clean center so the DeepLife+ copy stays legible on top.
const BANNER_ART = require('@/assets/images/deeplife-plus-banner.webp');

const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const GOLD_DEEP = '#B45309';
const INK = '#1A1206';

interface Props {
  variant?: 'banner' | 'inline' | 'badge';
  /** Analytics label for which surface opened the paywall. */
  surface: string;
  /** Optional positioning/style from the parent (used for the avatar badge). */
  style?: StyleProp<ViewStyle>;
}

export default function DeepLifePlusUpsell({ variant = 'banner', surface, style }: Props) {
  const { active, open, present, close } = useDeepLifePlusUpsell(surface);
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only the badge's crown glows; the banner now uses baked-in art and the
    // inline pill has no glow, so skip the loop for them.
    if (reducedMotion || active || variant !== 'badge') {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, active, pulse, variant]);

  // Never upsell an existing member.
  if (active) return null;

  const showTrial = DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0;
  const trialText = showTrial ? `${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-DAY FREE` : 'PREMIUM';
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const modal = <SubscriptionModal visible={open} onClose={close} />;

  // ── Avatar badge: a small glowing crown the parent positions absolutely ──
  if (variant === 'badge') {
    return (
      <>
        <TouchableOpacity
          onPress={present}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Open DeepLife Plus${showTrial ? `, ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-day free trial` : ''}`}
          style={[styles.badgeWrap, style]}
        >
          <Animated.View
            style={[styles.badgeGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[GOLD_SOFT, GOLD, GOLD_DEEP]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badgeCircle}
          >
            <Crown size={scale(14)} color={INK} fill={INK} strokeWidth={2} />
          </LinearGradient>
        </TouchableOpacity>
        {modal}
      </>
    );
  }

  // ── Ad-sheet inline: a compact "go ad-free" pill ──
  if (variant === 'inline') {
    return (
      <>
        <TouchableOpacity
          onPress={present}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Remove ads with DeepLife Plus"
          style={[styles.inline, style]}
        >
          <Crown size={fontScale(15)} color={GOLD} fill={GOLD} />
          <Text style={styles.inlineText}>
            Tired of ads? Go ad-free with <Text style={styles.inlineBrand}>DeepLife+</Text>
          </Text>
          <ChevronRight size={fontScale(15)} color={GOLD_SOFT} />
        </TouchableOpacity>
        {modal}
      </>
    );
  }

  // ── Shop banner: the fancy full-width card, over bespoke crown art ──
  return (
    <>
      <TouchableOpacity
        onPress={present}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`DeepLife Plus${showTrial ? `, ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-day free trial` : ''} — ad-free plus exclusive perks`}
        style={[styles.banner, style]}
      >
        <ImageBackground
          source={BANNER_ART}
          style={styles.bannerFill}
          imageStyle={styles.bannerImg}
          resizeMode="cover"
        >
          {/* The art keeps the crown on the left; reserve that zone so the copy
              lands on the dark center. Text shadows on the title/subtitle keep
              them legible no matter how the art crops across screen widths.
              (No scrim overlay: this component's LinearGradient is the flat
              LinearGradientFallback, which can't render a directional scrim, and
              a flat tint would dim the crown the design depends on.) */}
          <View style={styles.bannerCrownSpacer} pointerEvents="none" />

          <View style={styles.bannerBody}>
            <View style={styles.bannerTitleRow}>
              <Text style={styles.bannerTitle}>
                DeepLife<Text style={styles.bannerPlus}>+</Text>
              </Text>
              <View style={styles.bannerFlag}>
                <Sparkles size={fontScale(9)} color={INK} />
                <Text style={styles.bannerFlagText}>{trialText}</Text>
              </View>
            </View>
            <Text style={styles.bannerSub} numberOfLines={2}>
              Ad-free forever · exclusive perks · a monthly gem drop{showTrial ? ' — free for a week' : ''}
            </Text>
          </View>

          <ChevronRight size={fontScale(22)} color={GOLD_SOFT} />
        </ImageBackground>
      </TouchableOpacity>
      {modal}
    </>
  );
}

const styles = StyleSheet.create({
  // Avatar badge
  badgeWrap: { width: scale(30), height: scale(30), alignItems: 'center', justifyContent: 'center' },
  badgeGlow: {
    position: 'absolute',
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(250, 204, 21, 0.45)',
  },
  badgeCircle: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },

  // Ad-sheet inline pill
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginTop: scale(12),
    paddingVertical: scale(9),
    paddingHorizontal: scale(12),
    borderRadius: scale(14),
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.40)',
  },
  inlineText: { flexShrink: 1, color: GOLD_SOFT, fontSize: fontScale(12.5), fontWeight: '700' },
  inlineBrand: { color: GOLD, fontWeight: '900' },

  // Shop banner
  banner: { borderRadius: scale(18), overflow: 'hidden', marginBottom: scale(14) },
  bannerFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    minHeight: scale(88),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.45)',
    borderRadius: scale(18),
  },
  bannerImg: { borderRadius: scale(18) },
  // Leaves the art's left-anchored crown uncovered; the copy sits on the dark center.
  bannerCrownSpacer: { width: '30%' },
  bannerBody: { flex: 1, gap: scale(3) },
  bannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: fontScale(18),
    fontWeight: '900',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  bannerPlus: { color: GOLD },
  bannerFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    backgroundColor: GOLD,
    borderRadius: scale(7),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  bannerFlagText: { color: INK, fontSize: fontScale(9), fontWeight: '900', letterSpacing: 0.3 },
  bannerSub: {
    color: 'rgba(253, 230, 138, 0.95)',
    fontSize: fontScale(11.5),
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
