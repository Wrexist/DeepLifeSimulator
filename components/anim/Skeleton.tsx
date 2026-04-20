import React from 'react';
import { View, ViewStyle } from 'react-native';

interface SkeletonProps {
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

// TEMPORARY: react-native-reanimated removed to fix TurboModule crash
// This is a static placeholder until we identify the crash culprit
export default function Skeleton({ height = 16, radius = 4, style }: SkeletonProps) {
  // Removed animation to avoid dependency on react-native-reanimated

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: '#253046',
          marginVertical: 6,
          opacity: 0.5, // Static opacity instead of animated
        },
        style,
      ]}
    />
  );
}
