/**
 * Animated Moti Replacements
 *
 * Drop-in replacements for moti's MotiView and MotiText using React Native's
 * built-in Animated API. Supports from → animate transitions with timing and
 * spring configs. Exit animations are not supported (require unmount delay).
 *
 * Supported animated properties:
 *   opacity, translateY, translateX, scale, shadowOpacity, shadowRadius
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  Animated,
  ViewProps,
  TextProps,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface TransitionConfig {
  type?: 'timing' | 'spring';
  duration?: number;
  delay?: number;
  damping?: number;
  stiffness?: number;
  mass?: number;
}

interface AnimatedStyleValues {
  opacity?: number;
  translateY?: number;
  translateX?: number;
  scale?: number;
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
const TRANSFORM_KEYS = new Set(['translateY', 'translateX', 'scale']);
const STYLE_KEYS = new Set(['opacity', 'shadowOpacity', 'shadowRadius', 'width', 'height']);
const ALL_KEYS = [...TRANSFORM_KEYS, ...STYLE_KEYS] as const;

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
    ) as Array<keyof AnimatedStyleValues>;
  }, []); // Stable — animation keys don't change after mount

  // Create one Animated.Value per key
  const animatedValues = useRef<Record<string, Animated.Value>>({});
  if (keys.length > 0 && Object.keys(animatedValues.current).length === 0) {
    for (const key of keys) {
      const initialValue = from?.[key] ?? animate?.[key] ?? 0;
      animatedValues.current[key] = new Animated.Value(initialValue);
    }
  }

  // Animate to target on mount (and when animate changes)
  // useNativeDriver: false for broad property support (shadow, layout props)
  useEffect(() => {
    if (!animate || keys.length === 0) return;

    const animations = keys.map((key) => {
      const av = animatedValues.current[key];
      if (!av) return null;
      const toValue = animate[key] ?? 0;

      if (transition?.type === 'spring') {
        return Animated.spring(av, {
          toValue,
          damping: transition.damping ?? 15,
          stiffness: transition.stiffness ?? 150,
          mass: transition.mass ?? 1,
          delay: transition.delay ?? 0,
          useNativeDriver: false,
        });
      }

      return Animated.timing(av, {
        toValue,
        duration: transition?.duration ?? 300,
        delay: transition?.delay ?? 0,
        useNativeDriver: false,
      });
    }).filter(Boolean) as Animated.CompositeAnimation[];

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [animate]); // Re-run if animate object identity changes

  // Build transform array and flat style
  const animatedStyle = useMemo(() => {
    const style: Record<string, any> = {};
    const transform: Array<Record<string, Animated.Value>> = [];

    for (const key of keys) {
      const av = animatedValues.current[key];
      if (!av) continue;

      if (TRANSFORM_KEYS.has(key)) {
        transform.push({ [key]: av });
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
  ViewProps & MotiProps & { style?: ViewStyle | ViewStyle[] }
> = ({ from, animate, exit, transition, style, children, ...rest }) => {
  const animatedStyle = useAnimatedValues(from, animate, transition);

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
};

export const MotiText: React.FC<
  TextProps & MotiProps & { style?: TextStyle | TextStyle[] }
> = ({ from, animate, exit, transition, style, children, ...rest }) => {
  const animatedStyle = useAnimatedValues(from, animate, transition);

  return (
    <Animated.Text style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.Text>
  );
};
