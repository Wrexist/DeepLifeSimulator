import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { DesignSystem } from '@/utils/designSystem';

interface EnhancedLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
  variant?: 'spinner' | 'dots' | 'pulse';
  showText?: boolean;
}

export default function EnhancedLoadingSpinner({
  size = 'md',
  color = DesignSystem.colors.primary[500],
  text = 'Loading...',
  variant = 'spinner',
  showText = true,
}: EnhancedLoadingSpinnerProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const dot1Value = useRef(new Animated.Value(0)).current;
  const dot2Value = useRef(new Animated.Value(0)).current;
  const dot3Value = useRef(new Animated.Value(0)).current;

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          spinnerSize: 20,
          fontSize: DesignSystem.typography.fontSize.sm,
          spacing: DesignSystem.spacing.sm,
        };
      case 'md':
        return {
          spinnerSize: 30,
          fontSize: DesignSystem.typography.fontSize.base,
          spacing: DesignSystem.spacing.md,
        };
      case 'lg':
        return {
          spinnerSize: 40,
          fontSize: DesignSystem.typography.fontSize.lg,
          spacing: DesignSystem.spacing.lg,
        };
      default:
        return {
          spinnerSize: 30,
          fontSize: DesignSystem.typography.fontSize.base,
          spacing: DesignSystem.spacing.md,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  useEffect(() => {
    if (variant === 'spinner') {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      );
      spinAnimation.start();

      return () => spinAnimation.stop();
    } else if (variant === 'pulse') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    } else if (variant === 'dots') {
      const dotAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(dot1Value, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Value, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Value, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dot1Value, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Value, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Value, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      );
      dotAnimation.start();

      return () => dotAnimation.stop();
    }
    // Default: no cleanup needed
    return undefined;
  }, [variant, spinValue, pulseValue, dot1Value, dot2Value, dot3Value]);

  const renderSpinner = () => {
    if (variant === 'spinner') {
      const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      });

      return (
        <Animated.View
          style={[
            styles.spinner,
            {
              width: sizeStyles.spinnerSize,
              height: sizeStyles.spinnerSize,
              borderColor: color,
              borderTopColor: 'transparent',
              transform: [{ rotate: spin }],
            },
          ]}
        />
      );
    } else if (variant === 'pulse') {
      return (
        <Animated.View
          style={[
            styles.pulse,
            {
              width: sizeStyles.spinnerSize,
              height: sizeStyles.spinnerSize,
              backgroundColor: color,
              transform: [{ scale: pulseValue }],
            },
          ]}
        />
      );
    } else if (variant === 'dots') {
      return (
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                width: sizeStyles.spinnerSize / 3,
                height: sizeStyles.spinnerSize / 3,
                backgroundColor: color,
                opacity: dot1Value,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                width: sizeStyles.spinnerSize / 3,
                height: sizeStyles.spinnerSize / 3,
                backgroundColor: color,
                opacity: dot2Value,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                width: sizeStyles.spinnerSize / 3,
                height: sizeStyles.spinnerSize / 3,
                backgroundColor: color,
                opacity: dot3Value,
              },
            ]}
          />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {renderSpinner()}
      {showText && (
        <Text
          style={[
            styles.text,
            {
              fontSize: sizeStyles.fontSize,
              marginTop: sizeStyles.spacing,
            },
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    borderWidth: 3,
    borderRadius: 50,
  },
  pulse: {
    borderRadius: 50,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 50,
    marginHorizontal: 2,
  },
  text: {
    color: DesignSystem.colors.neutral[600],
    fontFamily: DesignSystem.typography.fontFamily.medium,
    fontWeight: DesignSystem.typography.fontWeight.medium,
    textAlign: 'center',
  },
});

