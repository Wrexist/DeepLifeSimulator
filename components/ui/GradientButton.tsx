/**
 * GradientButton — a modern, tactile CTA with real depth.
 *
 * The app's LinearGradient is stubbed to a flat single color (the expo module
 * crashes on iOS 26), so buttons looked like flat slabs. This draws a real
 * vertical gradient with react-native-svg, adds a soft top "glass" shine and a
 * colored glow shadow, and gives a subtle press-scale — clean and immersive on
 * every platform. Disabled renders a calm muted surface with no glow.
 */
import React, { useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { fontScale, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** [top, mid, bottom] — top lightest for a raised, glossy feel. */
  colors: [string, string, string];
  /** Glow/shadow color (usually the mid gradient color). */
  glow: string;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

// Unique-ish gradient id per render so multiple buttons don't collide on web.
let _gid = 0;

export default function GradientButton({
  label,
  onPress,
  disabled = false,
  colors,
  glow,
  icon,
  style,
  accessibilityLabel,
}: GradientButtonProps) {
  const press = useRef(new Animated.Value(0)).current;
  const idRef = useRef(`gb${_gid++}`);
  const gid = idRef.current;

  const scaleAnim = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  const animateTo = (v: number) =>
    Animated.timing(press, { toValue: v, duration: 90, useNativeDriver: true }).start();

  // Colored glow gives the depth/immersion; suppressed when disabled.
  const glowStyle: ViewStyle = disabled
    ? {}
    : Platform.select<ViewStyle>({
        web: { boxShadow: `0px ${scale(6)}px ${scale(16)}px ${glow}59` } as ViewStyle,
        ios: {
          shadowColor: glow,
          shadowOffset: { width: 0, height: scale(5) },
          shadowOpacity: 0.45,
          shadowRadius: scale(9),
        },
        android: { elevation: 6 },
        default: {},
      }) ?? {};

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, glowStyle, style]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        disabled={disabled || !onPress}
        onPressIn={() => animateTo(1)}
        onPressOut={() => animateTo(0)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        style={styles.touch}
      >
        <View style={styles.clip}>
          {disabled ? (
            <View style={styles.disabledFill} />
          ) : (
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                {/* Main depth gradient: light top → dark bottom. */}
                <SvgLinearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors[0]} />
                  <Stop offset="0.55" stopColor={colors[1]} />
                  <Stop offset="1" stopColor={colors[2]} />
                </SvgLinearGradient>
                {/* Glass shine: a soft white highlight over the top third. */}
                <SvgLinearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid}-fill)`} />
              <Rect x="0" y="0" width="100%" height="45%" fill={`url(#${gid}-shine)`} />
            </Svg>
          )}

          <View style={styles.content}>
            {icon}
            <Text style={[styles.label, disabled ? styles.labelDisabled : styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  touch: {
    borderRadius: responsiveBorderRadius.md,
  },
  clip: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    minHeight: verticalScale(44),
    justifyContent: 'center',
  },
  disabledFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(7),
    paddingVertical: verticalScale(11),
    paddingHorizontal: scale(14),
  },
  label: {
    fontSize: fontScale(13.5),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelDisabled: {
    color: 'rgba(226, 232, 240, 0.5)',
  },
});
