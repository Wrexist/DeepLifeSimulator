import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface AnimatedButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradient?: string[];
  hapticFeedback?: boolean;
  scaleValue?: number;
  duration?: number;
  disabled?: boolean;
}

export default function AnimatedButton({
  children,
  style,
  textStyle,
  gradient = ['#3B82F6', '#2563EB'],
  hapticFeedback = true,
  scaleValue = 0.95,
  duration = 150,
  disabled = false,
  onPress,
  ...props
}: AnimatedButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (disabled) return;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleValue,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: duration,
        useNativeDriver: false,
      }),
    ]).start();

    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    if (disabled) return;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: duration,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePress = (event: any) => {
    if (disabled) return;
    
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    onPress?.(event);
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        {...props}
      >
        <LinearGradient
          colors={disabled ? ['#6B7280', '#4B5563'] : gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, disabled && styles.disabledGradient]}
        >
          <Animated.View
            style={[
              styles.glow,
              {
                opacity: glowOpacity,
                backgroundColor: gradient[0],
              },
            ]}
          />
          {children}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  disabledGradient: {
    opacity: 0.6,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
  },
});
