import { responsiveSpacing as layoutSpace , fontScale, responsiveBorderRadius, scale } from '@/utils/scaling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { uiPalette } from '@/lib/config/theme';
/**
 * Shared CTA: restrained color depth without a glass overlay or colored halo.
 * Semantic colors, primary/secondary emphasis and reduced-motion press feedback
 * remain owned by the existing button API.
 */
import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

import { haptic } from '@/utils/haptics';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** [top, mid, bottom] - top lightest for a raised, glossy feel. */
  colors: [string, string, string];
  /** Accent used for secondary surface and border; retained API name. */
  glow: string;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /**
   * 'primary' (default) is the saturated gradient - ONE per
   * viewport. 'secondary' is the same button flat: a tint of the glow colour,
   * a rim, the label in that colour. Lists of cards used to stack a saturated
   * primary on every row, so none of them read as the one to press.
   */
  emphasis?: 'primary' | 'secondary';
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
  emphasis = 'primary',
}: GradientButtonProps) {
  const reduced = useReducedMotion();
  const secondary = emphasis === 'secondary';
  const press = useRef(new Animated.Value(0)).current;
  const idRef = useRef(`gb${_gid++}`);
  const gid = idRef.current;

  const scaleAnim = press.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 0.97] });

  const animateTo = (v: number) =>
    Animated.timing(press, { toValue: v, duration: reduced ? 0 : 140, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ scale: scaleAnim }], backgroundColor: disabled || secondary ? 'transparent' : colors[2] },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        disabled={disabled || !onPress}
        onPressIn={() => {
          haptic.light();
          animateTo(1);
        }}
        onPressOut={() => animateTo(0)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: disabled || !onPress }}
        style={styles.touch}
      >
        <View style={styles.clip}>
          {disabled ? (
            <View style={styles.disabledFill} />
          ) : secondary ? (
            <View style={[styles.disabledFill, { backgroundColor: `${glow}24`, borderColor: `${glow}59` }]} />
          ) : (
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                {/* Main depth gradient: light top → dark bottom. */}
                <SvgLinearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors[0]} />
                  <Stop offset="0.55" stopColor={colors[1]} />
                  <Stop offset="1" stopColor={colors[2]} />
                </SvgLinearGradient>
              </Defs>
              {/* Rounded rects (rx/ry = the button radius) so the gradient shape
                  itself is rounded - no square-corner seam against the clip. */}
              <Rect x="0" y="0" width="100%" height="100%" rx={RADIUS} ry={RADIUS} fill={`url(#${gid}-fill)`} />
            </Svg>
          )}

          <View style={styles.content}>
            {icon}
            <Text
              style={[
                styles.label,
                disabled ? styles.labelDisabled : secondary ? { color: colors[0], fontWeight: '600' } : styles.labelActive,
              ]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const RADIUS = responsiveBorderRadius.md;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS,
  },
  touch: {
    borderRadius: RADIUS,
  },
  clip: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    minHeight: scale(44),
    justifyContent: 'center',
  },
  disabledFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layoutSpace.sm,
    paddingVertical: layoutSpace.sm,
    paddingHorizontal: layoutSpace.compact,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: fontScale(13),
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  labelActive: {
    color: uiPalette.white,
  },
  labelDisabled: {
    color: 'rgba(226, 232, 240, 0.5)',
  },
});
