import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

interface SkeletonProps {
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export default function Skeleton({ height = 16, radius = 4, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: '#253046',
          marginVertical: 6,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
