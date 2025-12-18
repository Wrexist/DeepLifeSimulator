// DISABLED: react-native-reanimated removed to fix TurboModule crash
// This hook now returns non-animated versions
import { useRef, useEffect } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { logger } from '@/utils/logger';
import { Platform } from 'react-native';

interface UsePressableScaleOptions {
  scale?: number;
  duration?: number;
  haptic?: boolean;
  spring?: boolean;
  glow?: boolean;
  hapticEnabled?: boolean; // Optional - pass from parent if needed
}

export default function usePressableScale(options: UsePressableScaleOptions = {}) {
  const {
    haptic = true,
    hapticEnabled = true,
  } = options;

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Non-animated empty style
  const animatedStyle = {};

  // No-op press handlers (animations disabled)
  const onPressIn = () => {
    // Animation disabled - do nothing
  };

  const onPressOut = () => {
    // Animation disabled - do nothing
  };

  const onHaptic = async () => {
    if (!haptic || !hapticEnabled) return;
    
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      if (__DEV__) {
        logger.warn('Haptic feedback not available:', error);
      }
    }
  };

  return {
    AnimatedView: View, // Use plain View instead of Animated.View
    animatedStyle,
    onPressIn,
    onPressOut,
    onHaptic,
  } as const;
}