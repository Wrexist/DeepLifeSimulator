// DISABLED: react-native-reanimated removed to fix TurboModule crash
// This hook now returns non-animated versions
import { useEffect, useRef } from 'react';

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
    precision = 0
  } = options;

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Non-animated empty style
  const animatedStyle = { opacity: 1 };

  // Return target value directly (no animation)
  const getDisplayValue = () => {
    return Math.round(targetValue * Math.pow(10, precision)) / Math.pow(10, precision);
  };

  // Return a simple ref object instead of SharedValue
  const animatedValue = { value: targetValue };

  return {
    animatedStyle,
    getDisplayValue,
    animatedValue,
  };
}
