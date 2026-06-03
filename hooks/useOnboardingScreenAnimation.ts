import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface UseOnboardingScreenAnimationOptions {
  duration?: number;
  offsetY?: number;
  rotateBackground?: boolean;
  rotateDuration?: number;
}

export function useOnboardingScreenAnimation(options?: UseOnboardingScreenAnimationOptions) {
  const duration = options?.duration ?? 720;
  const offsetY = options?.offsetY ?? 22;
  const rotateBackground = options?.rotateBackground ?? false;
  const rotateDuration = options?.rotateDuration ?? 30000;

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;
  const rotateProgress = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!rotateBackground) {
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(rotateProgress, {
        toValue: 1,
        duration: rotateDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [rotateBackground, rotateDuration, rotateProgress]);

  const rotate = rotateProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return {
    opacity,
    translateY,
    rotate,
  };
}
