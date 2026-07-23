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
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ImageBackground, Platform, StyleProp, ViewStyle } from 'react-native';
import { Crown, ChevronRight, Sparkles } from 'lucide-react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import SubscriptionModal from '@/components/SubscriptionModal';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS } from '@/lib/subscription/deepLifePlus';
import { scale, fontScale } from '@/utils/scaling';

// Bespoke banner art: a glowing gold crown anchored left over a dark navy field,
// with a deliberately clean center so the DeepLife+ copy stays legible on top.
const BANNER_ART = require('@/assets/images/deeplife-plus-banner.webp');

const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const GOLD_DEEP = '#B45309';
const GOLD_HILITE = '#FFFDF0';
const INK = '#1A1206';

// Unique gradient id per badge instance so multiple crowns don't collide on web.
let _coinGradSeq = 0;

// QA/testing escape hatch: when this build-time env is 'true', the upsell renders
// even for members (who normally never see it), so the banner/badge/pill can be
// verified on a premium account in an internal-testing build. Metro inlines
// EXPO_PUBLIC_* at build time, so it is compiled to `false` in any normal
// production build where the flag is unset — it can never leak to real users.
const FORCE_UPSELL = process.env.EXPO_PUBLIC_FORCE_DEEPLIFE_UPSELL === 'true';

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
  const pulse = useRef(new Animated.Value(0)).current;     // glow halo breathe
  const breathe = useRef(new Animated.Value(0)).current;   // coin scale breathe
  const twinkle = useRef(new Animated.Value(0)).current;   // periodic sparkle
  const coinGradId = useRef(`dlpCoin${_coinGradSeq++}`).current;

  // A member normally hides every surface — unless the force flag is on (QA).
  const memberHidden = active && !FORCE_UPSELL;

  useEffect(() => {
    // Only the badge animates; the banner uses baked-in art and the inline pill
    // is static.
    if (reducedMotion || memberHidden || variant !== 'badge') {
      // Leave a calm, visible glow when motion is off (0 would read as "off").
      pulse.setValue(memberHidden ? 0 : 0.35);
      breathe.setValue(0);
      twinkle.setValue(0);
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    // A quick glint every ~2.5s: pause, flash in, fade out, long pause.
    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(twinkle, { toValue: 1, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(1700),
      ]),
    );
    glowLoop.start();
    breatheLoop.start();
    twinkleLoop.start();
    return () => {
      glowLoop.stop();
      breatheLoop.stop();
      twinkleLoop.stop();
    };
  }, [reducedMotion, memberHidden, pulse, breathe, twinkle, variant]);

  // Never upsell an existing member (unless the QA force flag is on).
  if (memberHidden) return null;

  const showTrial = DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0;
  const trialText = showTrial ? `${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-DAY FREE` : 'PREMIUM';
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const twinkleScale = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.05] });
  const modal = <SubscriptionModal visible={open} onClose={close} />;

  // ── Avatar badge: a polished gold "coin" crown the parent positions absolutely.
  // A real radial gradient (react-native-svg — the app's LinearGradient is the
  // flat fallback since expo-linear-gradient crashes on New Arch), a crisp white
  // rim, a pulsing glow halo, a gentle breathe, and a periodic sparkle glint. ──
  if (variant === 'badge') {
    const coin = scale(26);
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
          <Animated.View style={[styles.badgeCircle, { transform: [{ scale: breatheScale }] }]}>
            <Svg width={coin} height={coin} viewBox="0 0 26 26" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id={coinGradId} cx="34%" cy="28%" r="78%">
                  <Stop offset="0%" stopColor={GOLD_HILITE} />
                  <Stop offset="32%" stopColor={GOLD_SOFT} />
                  <Stop offset="70%" stopColor={GOLD} />
                  <Stop offset="100%" stopColor={GOLD_DEEP} />
                </RadialGradient>
              </Defs>
              <Circle cx="13" cy="13" r="12.3" fill={`url(#${coinGradId})`} />
              <Circle cx="13" cy="13" r="12.3" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
            </Svg>
            <Crown size={scale(13)} color={INK} fill={INK} strokeWidth={2} />
          </Animated.View>
          <Animated.View
            style={[styles.badgeSparkle, { opacity: twinkle, transform: [{ scale: twinkleScale }] }]}
            pointerEvents="none"
          >
            <Sparkles size={scale(9)} color={GOLD_HILITE} fill={GOLD_HILITE} />
          </Animated.View>
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
              Ad-free forever · +25% income · daily gems{showTrial ? ' — free for a week' : ''}
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
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: 'rgba(250, 204, 21, 0.5)',
  },
  badgeCircle: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
    // Warm depth so the coin reads as raised, not a flat sticker.
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(180, 83, 9, 0.55)' } as object,
      default: {
        shadowColor: GOLD_DEEP,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.55,
        shadowRadius: 2,
        elevation: 3,
      },
    }),
  },
  badgeSparkle: {
    position: 'absolute',
    top: scale(-1),
    right: scale(-1),
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
