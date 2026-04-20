import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface UseOnboardingScreenAnimationOptions {
  duration?: number;
  offsetY?: number;
}

export function useOnboardingScreenAnimation(options?: UseOnboardingScreenAnimationOptions) {
  const duration = options?.duration ?? 720;
  const offsetY = options?.offsetY ?? 22;

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [duration, opacity, translateY]);

  return {
    opacity,
    translateY,
  };
}
