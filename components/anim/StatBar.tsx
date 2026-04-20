import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';

interface StatBarProps {
  pct: number; // 0-100
  height?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * Animated stat bar that smoothly fills from previous value to current pct%.
 * Uses Animated.timing on width for smooth transitions.
 * Color auto-selects green/yellow/red based on percentage unless overridden.
 */
export default function StatBar({ pct, height = 10, color, style }: StatBarProps) {
  const fillColor = color ?? (pct > 66 ? '#22c55e' : pct > 33 ? '#eab308' : '#ef4444');
  const clampedPct = Math.max(0, Math.min(100, pct));
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: clampedPct,
      duration: 350,
      useNativeDriver: false, // width can't use native driver
    }).start();
  }, [clampedPct, widthAnim]);

  const widthInterpolated = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[{ backgroundColor: '#1f2937', borderRadius: 8, overflow: 'hidden', height }, style]}>
      <Animated.View
        style={{
          height: '100%',
          width: widthInterpolated,
          backgroundColor: fillColor,
          borderRadius: 8,
        }}
      />
    </View>
  );
}
