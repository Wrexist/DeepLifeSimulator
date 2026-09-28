import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Shared immediate press response. No haptic on routine taps; no layout animation. */
export default function MotionPressable({ children, style, disabled, onPressIn, onPressOut, ...props }:
  Omit<PressableProps, 'style' | 'children'> & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    value.stopAnimation();
    if (reduced) { value.setValue(1); return; }
    Animated.timing(value, { toValue, duration: 140, useNativeDriver: true }).start();
  };
  return <Animated.View style={{ transform: [{ scale: value }] }}>
    <Pressable {...props} disabled={disabled}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled || props.accessibilityState?.disabled }}
      onPressIn={event => { animate(0.975); onPressIn?.(event); }}
      onPressOut={event => { animate(1); onPressOut?.(event); }}
      style={({ pressed }) => [style, { opacity: disabled ? 0.5 : pressed ? 0.86 : 1 }]}>
      {children}
    </Pressable>
  </Animated.View>;
}
