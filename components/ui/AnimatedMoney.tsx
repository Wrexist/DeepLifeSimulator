import React, { useRef, useEffect, useState } from 'react';
import { Text, Animated, StyleSheet, TextStyle } from 'react-native';

interface AnimatedMoneyProps {
  value: number;
  duration?: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
  precision?: number;
  useNativeDriver?: boolean;
}

export default function AnimatedMoney({
  value,
  duration = 1000,
  style,
  prefix = '$',
  suffix = '',
  precision = 0,
  useNativeDriver = false,
}: AnimatedMoneyProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = React.useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    
    // Reset animation value to start
    animatedValue.setValue(startValue);
    
    // Animate to new value
    Animated.timing(animatedValue, {
      toValue: endValue,
      duration: duration,
      useNativeDriver: false, // Always use false for better performance
    }).start();
    
    // Use listener for smooth updates
    const listener = animatedValue.addListener(({ value: currentValue }) => {
      setDisplayValue(Math.round(currentValue));
    });

    previousValue.current = endValue;

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, animatedValue]);

  const formatNumber = (num: number) => {
    const a = Math.floor(Math.abs(num) || 0);
    const sign = num < 0 ? '-' : '';
    
    let formatted: string;
    
    // Always remove decimals for better readability in TopStatsBar
    if (a >= 1_000_000_000_000_000) {
      // Quadrillions (Q)
      formatted = `${Math.floor(a / 1_000_000_000_000_000)}Q`;
    } else if (a >= 1_000_000_000_000) {
      // Trillions (T)
      formatted = `${Math.floor(a / 1_000_000_000_000)}T`;
    } else if (a >= 1_000_000_000) {
      // Billions (B)
      formatted = `${Math.floor(a / 1_000_000_000)}B`;
    } else if (a >= 1_000_000) {
      // Millions (M)
      formatted = `${Math.floor(a / 1_000_000)}M`;
    } else if (a > 10_000) {
      // Thousands (K) - only for numbers above 10,000
      formatted = `${Math.floor(a / 1_000)}K`;
    } else {
      // Regular numbers (0-10,000) - show full number
      formatted = a.toLocaleString();
    }
    
    return `${sign}${formatted}`;
  };

  return (
    <Text 
      style={[styles.text, style]}
      numberOfLines={1}
      adjustsFontSizeToFit={true}
      minimumFontScale={0.7}
    >
      {prefix}{formatNumber(displayValue)}{suffix}
    </Text>
  );
}

// Alternative version that works with native driver
export function AnimatedMoneyNative({
  value,
  duration = 1000,
  style,
  prefix = '$',
  suffix = '',
  precision = 0,
}: Omit<AnimatedMoneyProps, 'useNativeDriver'>) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    const startValue = displayValue;
    
    animatedValue.setValue(startValue);
    
    Animated.timing(animatedValue, {
      toValue: value,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setDisplayValue(value);
      }
    });

    const listener = animatedValue.addListener(({ value: currentValue }) => {
      setDisplayValue(Math.round(currentValue));
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, animatedValue, displayValue]);

  const formatNumber = (num: number) => {
    const a = Math.floor(Math.abs(num) || 0);
    const sign = num < 0 ? '-' : '';
    
    let formatted: string;
    
    // Always remove decimals for better readability in TopStatsBar
    if (a >= 1_000_000_000_000_000) {
      // Quadrillions (Q)
      formatted = `${Math.floor(a / 1_000_000_000_000_000)}Q`;
    } else if (a >= 1_000_000_000_000) {
      // Trillions (T)
      formatted = `${Math.floor(a / 1_000_000_000_000)}T`;
    } else if (a >= 1_000_000_000) {
      // Billions (B)
      formatted = `${Math.floor(a / 1_000_000_000)}B`;
    } else if (a >= 1_000_000) {
      // Millions (M)
      formatted = `${Math.floor(a / 1_000_000)}M`;
    } else if (a > 10_000) {
      // Thousands (K) - only for numbers above 10,000
      formatted = `${Math.floor(a / 1_000)}K`;
    } else {
      // Regular numbers (0-10,000) - show full number
      formatted = a.toLocaleString();
    }
    
    return `${sign}${formatted}`;
  };

  return (
    <Text 
      style={[styles.text, style]}
      numberOfLines={1}
      adjustsFontSizeToFit={true}
      minimumFontScale={0.7}
    >
      {prefix}{formatNumber(displayValue)}{suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    color: '#1F2937',
  },
});
