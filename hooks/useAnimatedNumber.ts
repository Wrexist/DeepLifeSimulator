import { useEffect, useRef } from 'react';
import { useSharedValue, withTiming, useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';

interface UseAnimatedNumberOptions {
  duration?: number;
  easing?: 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut';
  precision?: number;
}

export default function useAnimatedNumber(
  targetValue: number, 
  options: UseAnimatedNumberOptions = {}
) {
  const {
    duration = 1000,
    easing = 'easeOut',
    precision = 0
  } = options;

  const animatedValue = useSharedValue(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      animatedValue.value = withTiming(targetValue, {
        duration,
        easing: easing === 'linear' ? undefined : 
                easing === 'ease' ? undefined :
                easing === 'easeIn' ? undefined :
                easing === 'easeOut' ? undefined :
                easing === 'easeInOut' ? undefined : undefined
      });
    }
  }, [targetValue, duration, easing]);

  const animatedStyle = useAnimatedStyle(() => {
    const currentValue = interpolate(
      animatedValue.value,
      [0, targetValue],
      [0, targetValue],
      Extrapolate.CLAMP
    );

    return {
      opacity: 1,
    };
  });

  const getDisplayValue = () => {
    return Math.round(animatedValue.value * Math.pow(10, precision)) / Math.pow(10, precision);
  };

  return {
    animatedStyle,
    getDisplayValue,
    animatedValue,
  };
}
