/**
 * GradientButton - a modern, tactile CTA with real depth.
 *
 * The app's LinearGradient is stubbed to a flat single color (the expo module
 * crashes on iOS 26), so buttons looked like flat slabs. This draws a real
 * vertical gradient with react-native-svg, adds a soft top "glass" shine and a
 * colored glow shadow, and gives a subtle press-scale - clean and immersive on
 * every platform. Disabled renders a calm muted surface with no glow.
 */
import React, { useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { fontScale, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** [top, mid, bottom] - top lightest for a raised, glossy feel. */
  colors: [string, string, string];
  /** Glow/shadow color (usually the mid gradient color). */
  glow: string;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /**
   * 'primary' (default) is the saturated gradient with a glow - ONE per
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
  const secondary = emphasis === 'secondary';
  const press = useRef(new Animated.Value(0)).current;
  const idRef = useRef(`gb${_gid++}`);
  const gid = idRef.current;

  const scaleAnim = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  const animateTo = (v: number) =>
    Animated.timing(press, { toValue: v, duration: 90, useNativeDriver: true }).start();

  // Colored glow gives the depth/immersion; suppressed when disabled. The glow
  // view carries the SAME borderRadius so the shadow is rounded (not a hard
  // rectangle poking past the corners) and a solid bottom-color background so
  // iOS has a rounded shape to cast the shadow from (the rounded SVG rect sits
  // exactly on top of it, hiding it).
  const glowStyle: ViewStyle = disabled || secondary
    ? {}
    : Platform.select<ViewStyle>({
        web: { boxShadow: `0px ${scale(5)}px ${scale(14)}px ${glow}4D` } as ViewStyle,
        ios: {
          shadowColor: glow,
          shadowOffset: { width: 0, height: scale(4) },
          shadowOpacity: 0.4,
          shadowRadius: scale(10),
        },
        android: { elevation: 6 },
        default: {},
      }) ?? {};

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ scale: scaleAnim }], backgroundColor: disabled || secondary ? 'transparent' : colors[2] },
        glowStyle,
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
        accessibilityState={{ disabled }}
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
                {/* Glass shine: soft white highlight that fades out by mid-height
                    (full-height + rounded so there's no hard cut-off line). */}
                <SvgLinearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              {/* Rounded rects (rx/ry = the button radius) so the gradient shape
                  itself is rounded - no square-corner seam against the clip. */}
              <Rect x="0" y="0" width="100%" height="100%" rx={RADIUS} ry={RADIUS} fill={`url(#${gid}-fill)`} />
              <Rect x="0" y="0" width="100%" height="100%" rx={RADIUS} ry={RADIUS} fill={`url(#${gid}-shine)`} />
            </Svg>
          )}

          <View style={styles.content}>
            {icon}
            <Text
              style={[
                styles.label,
                disabled ? styles.labelDisabled : secondary ? { color: colors[0], fontWeight: '600' } : styles.labelActive,
              ]}
              numberOfLines={1}
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
    minHeight: verticalScale(36),
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
    gap: scale(7),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
  },
  label: {
    fontSize: fontScale(13),
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
