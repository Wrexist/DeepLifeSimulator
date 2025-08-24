import React from 'react';
import { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export default function usePressableScale() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: 80 });
  };

  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 80 });
  };

  const onHaptic = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
