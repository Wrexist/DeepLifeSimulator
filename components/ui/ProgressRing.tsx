/**
 * ProgressRing - a premium circular-progress ring for long-running/ongoing
 * state (e.g. a career's promotion progress). React Native port of the classic
 * SVG-stroke progress ring, using react-native-svg + Animated (RN has no CSS
 * custom properties / conic-gradient / keyframes, so those become Animated
 * loops and react-native-svg primitives).
 *
 * Five stacked layers, back → front:
 *   1. soft radial halo glow (react-native-svg RadialGradient), gently pulsing
 *   2. a thin accent arc that orbits the ring continuously
 *   3. the ring: a faint full-circle track + the animated fill arc
 *   4. center content (children)
 *   5. a rounded "NN%" pill overlapping the ring's bottom edge
 *
 * All color is theme-driven via props (accent/track/surface/ink) with sensible
 * defaults, and the `state` prop flips accent → positive in one place. Honors
 * prefers-reduced-motion (no loops, snap the fill instead of sliding).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { accent as themeAccent } from '@/lib/config/theme';
import { fontScale, scale } from '@/utils/scaling';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Unique-ish gradient id per mount so multiple rings on one screen don't all
// reference the same `url(#halo)` def (which would pull the wrong color).
let _ringId = 0;

export interface ProgressRingProps {
  /** 0–100 */
  value: number;
  /** Outer diameter in px (pre-scale). Default 92. */
  size?: number;
  /** Ring stroke width. Default ~7. */
  strokeWidth?: number;
  /** "active" uses --accent; "done" swaps everything to --positive. */
  state?: 'active' | 'done';
  /** Accent color for the active state (default: theme info blue). */
  accentColor?: string;
  /** Positive color for the done state (default: theme success green). */
  positiveColor?: string;
  /** Faint full-circle track color. */
  trackColor?: string;
  /** Solid surface the pill sits on (so it punches through the ring). */
  surfaceColor?: string;
  /** Pill border (hairline). */
  borderColor?: string;
  /** Pill text color. */
  inkColor?: string;
  /** Show the NN% pill (default true). */
  showPill?: boolean;
  /**
   * Ambient looping motion (pulsing halo + orbiting sweep). Default true for a
   * standalone showpiece; pass false in dense lists so a dozen rings stay calm
   * (the fill still animates on value changes).
   */
  ambient?: boolean;
  /** Accessibility label for the progressbar. */
  label?: string;
  /** Centered content (icon / illustration). */
  children?: React.ReactNode;
  style?: ViewStyle;
}

export default function ProgressRing({
  value,
  size = 92,
  strokeWidth = 7,
  state = 'active',
  accentColor = themeAccent.info,
  positiveColor = themeAccent.success,
  trackColor = 'rgba(148, 163, 184, 0.22)',
  surfaceColor = '#0F172A',
  borderColor = 'rgba(255, 255, 255, 0.12)',
  inkColor = '#F8FAFC',
  showPill = true,
  ambient = true,
  label,
  children,
  style,
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const motion = ambient && !reduced; // looping halo/orbit only when both allow
  const haloId = useRef(`halo${_ringId++}`).current;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const color = state === 'done' ? positiveColor : accentColor;

  const D = scale(size);
  const stroke = scale(strokeWidth);
  const c = D / 2;
  const r = c - stroke / 2 - scale(2);
  const circumference = 2 * Math.PI * r;

  // --- Fill arc: stroke-dashoffset math ---------------------------------
  // The fill circle draws its whole stroke over `circumference`; offsetting the
  // dash by circumference × (1 − value/100) hides the remainder, so the visible
  // stroke *is* the progress. Rotating −90° starts it at 12 o'clock, clockwise.
  const targetOffset = circumference * (1 - clamped / 100);
  const dashOffset = useRef(new Animated.Value(targetOffset)).current;

  useEffect(() => {
    if (reduced) {
      dashOffset.setValue(targetOffset); // snap, no slide
      return;
    }
    Animated.timing(dashOffset, {
      toValue: targetOffset,
      duration: 700,
      easing: Easing.bezier(0.22, 1, 0.36, 1), // ease-out-back
      useNativeDriver: false, // SVG props can't use the native driver
    }).start();
  }, [targetOffset, reduced, dashOffset]);

  // --- Ambient motion (loops independently of progress) -----------------
  const spin = useRef(new Animated.Value(0)).current; // orbiting sweep
  const halo = useRef(new Animated.Value(0)).current; // pulsing halo

  useEffect(() => {
    if (!motion) return;
    const orbit = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    orbit.start();
    pulse.start();
    return () => { orbit.stop(); pulse.stop(); };
  }, [motion, spin, halo]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  // The orbiting sweep is a short bright arc (~12% of the circle) that spins.
  const sweepArc = circumference * 0.12;

  return (
    <View
      style={[{ width: D, height: D }, styles.root, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progress'}
      accessibilityValue={{ now: Math.round(clamped), min: 0, max: 100 }}
    >
      {/* 1. Halo glow - only for the animated showpiece (hero). List rings skip
          it: lighter, and avoids many rings sharing a halo def. */}
      {motion && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.center, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
          pointerEvents="none"
        >
          <Svg width={D} height={D}>
            <Defs>
              <RadialGradient id={haloId} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <Stop offset="70%" stopColor={color} stopOpacity={0.06} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={c} cy={c} r={c} fill={`url(#${haloId})`} />
          </Svg>
        </Animated.View>
      )}

      {/* 2. Orbiting accent sweep */}
      {motion && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spinDeg }] }]} pointerEvents="none">
          <Svg width={D} height={D}>
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              opacity={0.55}
              strokeDasharray={`${sweepArc} ${circumference}`}
              transform={`rotate(-90 ${c} ${c})`}
            />
          </Svg>
        </Animated.View>
      )}

      {/* 3. Track + fill ring */}
      <Svg width={D} height={D} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>

      {/* 4. Center content */}
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>

      {/* 5. NN% pill */}
      {showPill && (
        <View style={[styles.pill, { backgroundColor: surfaceColor, borderColor }]} pointerEvents="none">
          <Text style={[styles.pillValue, { color: inkColor }]}>{Math.round(clamped)}</Text>
          <Text style={[styles.pillPct, { color: inkColor }]}>%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    bottom: -scale(6),
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: scale(9),
    paddingVertical: scale(2),
    borderRadius: scale(999),
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillValue: {
    fontSize: fontScale(13),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  pillPct: {
    fontSize: fontScale(9),
    fontWeight: '700',
    marginLeft: scale(1),
  },
});
