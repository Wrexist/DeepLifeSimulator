// src/utils/animated.ts
import { Animated, AnimatedTimingConfig, AnimatedSpringConfig, AnimatedDecayConfig } from 'react-native';

/**
 * Utility functions for animations with correct `useNativeDriver` usage.
 *
 * - Layout properties (width, height, margins, paddings, backgroundColor, zIndex, borders, etc.)
 *   ❌ cannot use native driver → must use `useNativeDriver: false`.
 *
 * - Transform and opacity properties (translateX/Y, scaleX/Y, rotate, opacity, etc.)
 *   ✅ can use native driver → should use `useNativeDriver: true` for better performance.
 */

/* TIMING ANIMATIONS */
export const timingLayout = (
  value: Animated.Value,
  toValue: number,
  duration = 250,
  config: Partial<AnimatedTimingConfig> = {}
) =>
  Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: false,
    ...config,
  });

export const timingNative = (
  value: Animated.Value,
  toValue: number,
  duration = 250,
  config: Partial<AnimatedTimingConfig> = {}
) =>
  Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: true,
    ...config,
  });

/* SPRING ANIMATIONS */
export const springLayout = (
  value: Animated.Value,
  toValue: number,
  config: Partial<AnimatedSpringConfig> = {}
) =>
  Animated.spring(value, {
    toValue,
    useNativeDriver: false,
    ...config,
  });

export const springNative = (
  value: Animated.Value,
  toValue: number,
  config: Partial<AnimatedSpringConfig> = {}
) =>
  Animated.spring(value, {
    toValue,
    useNativeDriver: true,
    ...config,
  });

/* DECAY ANIMATIONS */
export const decayLayout = (
  value: Animated.Value,
  config: Partial<AnimatedDecayConfig> = {}
) =>
  Animated.decay(value, {
    useNativeDriver: false,
    ...config,
  });

export const decayNative = (
  value: Animated.Value,
  config: Partial<AnimatedDecayConfig> = {}
) =>
  Animated.decay(value, {
    useNativeDriver: true,
    ...config,
  });
