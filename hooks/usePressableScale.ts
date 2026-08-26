/**
 * usePressableScale — press animation hook using React Native Animated API
 *
 * Provides scale + opacity feedback on press-in / press-out for buttons and cards.
 * Replaces the old reanimated-based version that was disabled to fix TurboModule crashes.
 */

import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { haptic } from '@/utils/haptics';
import { animation } from '@/lib/config/theme';

interface UsePressableScaleOptions {
  /** Scale factor on press (default 0.96) */
  scale?: number;
  /** Animation duration in ms (default 100) */
  duration?: number;
  /** Trigger haptic on press (default true) */
  haptic?: boolean;
  /** Use spring animation instead of timing (default false) */
  spring?: boolean;
  /** Unused — kept for API compat */
  glow?: boolean;
  /** Unused — kept for API compat */
  hapticEnabled?: boolean;
}

export default function usePressableScale(options: UsePressableScaleOptions = {}) {
  const {
    scale = 0.96,
    duration = animation.micro,
    haptic: doHaptic = true,
    spring = false,
  } = options;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (doHaptic) haptic.light();

    if (spring) {
      Animated.spring(scaleAnim, {
        toValue: scale,
        ...animation.spring.snappy,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: scale,
        duration,
        useNativeDriver: true,
      }).start();
    }
  }, [scale, duration, spring, doHaptic, scaleAnim]);

  const onPressOut = useCallback(() => {
    if (spring) {
      // `gentle` (stiffness 150) is deliberately softer than the old inline
      // 200: press-in snaps, release settles - the standard asymmetry.
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...animation.spring.gentle,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    }
  }, [duration, spring, scaleAnim]);

  const animatedStyle = { transform: [{ scale: scaleAnim }] };

  // onHaptic kept for callers that trigger haptic independently
  const onHaptic = useCallback(() => {
    if (doHaptic) haptic.medium();
  }, [doHaptic]);

  return {
    AnimatedView: Animated.View,
    animatedStyle,
    onPressIn,
    onPressOut,
    onHaptic,
  } as const;
}
