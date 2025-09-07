import React, { useRef, useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  withTiming, 
  withSpring, 
  useAnimatedStyle,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface UsePressableScaleOptions {
  scale?: number;
  duration?: number;
  haptic?: boolean;
  spring?: boolean;
  glow?: boolean;
}

export default function usePressableScale(options: UsePressableScaleOptions = {}) {
  const {
    scale: scaleValue = 0.95,
    duration = 100,
    haptic = true,
    spring = true,
    glow = false
  } = options;

  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      scale.value = 1;
      glowOpacity.value = 0;
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scaleTransform = interpolate(
      scale.value,
      [0.8, 1],
      [scaleValue, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale: scaleTransform }],
      // Note: Shadow properties are not supported by native driver in Reanimated
      // Removing these to prevent "Style property 'width' is not supported" errors
      // shadowOpacity: glow ? interpolate(glowOpacity.value, [0, 1], [0, 0.3], Extrapolate.CLAMP) : undefined,
      // shadowRadius: glow ? interpolate(glowOpacity.value, [0, 1], [0, 8], Extrapolate.CLAMP) : undefined,
    };
  });

  const onPressIn = () => {
    if (isMounted.current) {
      if (spring) {
        scale.value = withSpring(scaleValue, {
          damping: 15,
          stiffness: 300,
          mass: 0.8,
        });
      } else {
        scale.value = withTiming(scaleValue, { duration });
      }
      
      if (glow) {
        glowOpacity.value = withTiming(1, { duration: 150 });
      }
    }
  };

  const onPressOut = () => {
    if (isMounted.current) {
      if (spring) {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 300,
          mass: 0.8,
        });
      } else {
        scale.value = withTiming(1, { duration });
      }
      
      if (glow) {
        glowOpacity.value = withTiming(0, { duration: 200 });
      }
    }
  };

  const onHaptic = async () => {
    if (!haptic) return;
    
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.warn('Haptic feedback not available:', error);
    }
  };

  return {
    AnimatedView: Animated.View,
    animatedStyle,
    onPressIn,
    onPressOut,
    onHaptic,
  } as const;
}