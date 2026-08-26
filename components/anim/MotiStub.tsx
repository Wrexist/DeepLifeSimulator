/**
 * Animated Moti Replacements
 *
 * Drop-in replacements for moti's MotiView and MotiText using React Native's
 * built-in Animated API. Supports from → animate transitions with timing and
 * spring configs, optional looping. Exit animations are not supported.
 *
 * Supported animated properties:
 *   opacity, translateY, translateX, scale, scaleX, scaleY, rotate,
 *   shadowOpacity, shadowRadius, width, height
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  Animated,
  ViewProps,
  TextProps,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { animation } from '@/lib/config/theme';

interface TransitionConfig {
  type?: 'timing' | 'spring';
  duration?: number;
  delay?: number;
  damping?: number;
  stiffness?: number;
  mass?: number;
  loop?: boolean;
  // Accepted for moti compatibility; the stub always restarts (does not reverse)
  // on loop, which matches repeatReverse: false. repeatReverse: true is ignored.
  repeatReverse?: boolean;
}

interface AnimatedStyleValues {
  opacity?: number;
  translateY?: number;
  translateX?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: string; // e.g. '360deg'
  shadowOpacity?: number;
  shadowRadius?: number;
  width?: number;
  height?: number;
}

interface MotiProps {
  from?: AnimatedStyleValues;
  animate?: AnimatedStyleValues;
  exit?: AnimatedStyleValues; // Acknowledged but not animated on unmount
  transition?: TransitionConfig;
}

// The set of properties we can animate via transforms or direct style
const TRANSFORM_KEYS = new Set(['translateY', 'translateX', 'scale', 'scaleX', 'scaleY', 'rotate']);
const STYLE_KEYS = new Set(['opacity', 'shadowOpacity', 'shadowRadius', 'width', 'height']);
const ALL_KEYS = [...TRANSFORM_KEYS, ...STYLE_KEYS] as const;

// Keys the native animation driver can handle: opacity + the transform family.
// A node runs on the native driver only when EVERY animated key is native-safe;
// if any key is layout (width/height) or paint (shadow*/color) the whole node
// stays JS-driven, so one style object never mixes native- and JS-driven values
// (RN throws when a single node receives both).
const NATIVE_SAFE_KEYS = new Set([
  'opacity',
  'scale', 'scaleX', 'scaleY',
  'translateX', 'translateY',
  'rotate', 'rotateX', 'rotateY', 'rotateZ',
  'perspective', 'skewX', 'skewY',
]);

// `rotate` takes string degree values like '360deg'; everything else is numeric.
function toNumber(key: string, val: number | string | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (key === 'rotate') return parseFloat(val) || 0;
  return 0;
}

function useAnimatedValues(
  from: AnimatedStyleValues | undefined,
  animate: AnimatedStyleValues | undefined,
  transition: TransitionConfig | undefined,
) {
  // Determine which keys are being animated
  const keys = useMemo(() => {
    const keySet = new Set<string>();
    if (from) Object.keys(from).forEach((k) => keySet.add(k));
    if (animate) Object.keys(animate).forEach((k) => keySet.add(k));
    return Array.from(keySet).filter((k) =>
      ALL_KEYS.includes(k as any),
    ) as (keyof AnimatedStyleValues)[];
  }, []); // Stable - animation keys don't change after mount

  // Create one Animated.Value per key
  const animatedValues = useRef<Record<string, Animated.Value>>({});
  if (keys.length > 0 && Object.keys(animatedValues.current).length === 0) {
    for (const key of keys) {
      const initialValue = toNumber(key, from?.[key] ?? animate?.[key]);
      animatedValues.current[key] = new Animated.Value(initialValue);
    }
  }

  // Animate to target on mount (and when animate changes).
  // Native driver when every animated key is transform/opacity; otherwise JS so
  // layout/shadow/color props still animate (see NATIVE_SAFE_KEYS). The decision
  // is made once per node, so a node never mixes native- and JS-driven values.
  useEffect(() => {
    if (!animate || keys.length === 0) return;

    const useNative = keys.every((key) => NATIVE_SAFE_KEYS.has(key));

    let animations = keys.map((key) => {
      const av = animatedValues.current[key];
      if (!av) return null;
      const toValue = toNumber(key, animate[key]);

      // Defaults come from the design system's motion tokens (`gentle` spring,
      // `normal` duration) so unconfigured transitions share one motion voice.
      if (transition?.type === 'spring') {
        return Animated.spring(av, {
          toValue,
          damping: transition.damping ?? animation.spring.gentle.damping,
          stiffness: transition.stiffness ?? animation.spring.gentle.stiffness,
          mass: transition.mass ?? 1,
          delay: transition.delay ?? 0,
          useNativeDriver: useNative,
        });
      }

      return Animated.timing(av, {
        toValue,
        duration: transition?.duration ?? animation.normal,
        delay: transition?.delay ?? 0,
        useNativeDriver: useNative,
      });
    }).filter(Boolean) as Animated.CompositeAnimation[];

    if (transition?.loop) {
      animations = animations.map((anim) => Animated.loop(anim));
    }

    if (animations.length === 0) return;

    // Capture the composite so it can be stopped on unmount / re-run. Without
    // this, looping animations (LoadingSpinner, AnimatedProgressBar - both
    // mount/unmount constantly) kept running on the UI thread forever, the same
    // leak class fixed in TopStatsBar.
    const composite = Animated.parallel(animations);
    composite.start();
    return () => composite.stop();
  }, [animate]); // Re-run if animate object identity changes

  // Build transform array and flat style
  const animatedStyle = useMemo(() => {
    const style: Record<string, any> = {};
    const transform: Record<string, any>[] = [];

    for (const key of keys) {
      const av = animatedValues.current[key];
      if (!av) continue;

      if (TRANSFORM_KEYS.has(key)) {
        if (key === 'rotate') {
          // Transform.rotate needs a degree string, so interpolate the
          // numeric Animated.Value into 'Ndeg' across a wide identity range.
          transform.push({
            rotate: av.interpolate({
              inputRange: [-3600, 3600],
              outputRange: ['-3600deg', '3600deg'],
            }),
          });
        } else {
          transform.push({ [key]: av });
        }
      } else {
        style[key] = av;
      }
    }

    if (transform.length > 0) {
      style.transform = transform;
    }

    return style;
  }, [keys]);

  return animatedStyle;
}

export const MotiView: React.FC<
  ViewProps & MotiProps & { style?: StyleProp<ViewStyle> }
> = ({ from, animate, exit, transition, style, children, ...rest }) => {
  const animatedStyle = useAnimatedValues(from, animate, transition);

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
};

export const MotiText: React.FC<
  TextProps & MotiProps & { style?: StyleProp<TextStyle> }
> = ({ from, animate, exit, transition, style, children, ...rest }) => {
  const animatedStyle = useAnimatedValues(from, animate, transition);

  return (
    <Animated.Text style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.Text>
  );
};
