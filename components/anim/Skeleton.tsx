/**
 * Skeleton — pulsing loading placeholder.
 *
 * Plain RN Animated (native driver, opacity only), no reanimated. Honours
 * reduced motion by holding a static mid-opacity block instead of pulsing.
 * Used wherever content is loading asynchronously and a blank region would
 * read as "broken" (e.g. SaveSlots while slot metadata loads).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SkeletonProps {
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export default function Skeleton({ height = 16, radius = 4, style }: SkeletonProps) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.45);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduced, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: '#253046',
          marginVertical: 6,
          opacity,
        },
        style,
      ]}
    />
  );
}
