import React, { useRef, useEffect } from 'react';
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
      useNativeDriver: useNativeDriver,
    }).start();
    
    previousValue.current = endValue;
  }, [value, duration, animatedValue, useNativeDriver]);

  const formatNumber = (num: number) => {
    const a = Math.floor(Math.abs(num) || 0);
    const sign = num < 0 ? '-' : '';
    
    let formatted: string;
    
    if (a >= 1_000_000_000_000_000) {
      // Quadrillions (Q)
      formatted = `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    } else if (a >= 1_000_000_000_000) {
      // Trillions (T)
      formatted = `${(a / 1_000_000_000_000).toFixed(2)}T`;
    } else if (a >= 1_000_000_000) {
      // Billions (B)
      formatted = `${(a / 1_000_000_000).toFixed(2)}B`;
    } else if (a >= 1_000_000) {
      // Millions (M)
      formatted = `${(a / 1_000_000).toFixed(2)}M`;
    } else if (a >= 1_000) {
      // Thousands (K)
      formatted = `${(a / 1_000).toFixed(2)}K`;
    } else {
      // Regular numbers
      formatted = a.toString();
    }
    
    // Remove trailing zeros and decimal point if not needed
    formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
    
    return `${sign}${formatted}`;
  };

  if (useNativeDriver) {
    return (
      <Animated.Text style={[styles.text, style]}>
        {prefix}{formatNumber(value)}{suffix}
      </Animated.Text>
    );
  }

  return (
    <Animated.Text style={[styles.text, style]}>
      {prefix}{formatNumber(animatedValue.__getValue())}{suffix}
    </Animated.Text>
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
    
    if (a >= 1_000_000_000_000_000) {
      // Quadrillions (Q)
      formatted = `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    } else if (a >= 1_000_000_000_000) {
      // Trillions (T)
      formatted = `${(a / 1_000_000_000_000).toFixed(2)}T`;
    } else if (a >= 1_000_000_000) {
      // Billions (B)
      formatted = `${(a / 1_000_000_000).toFixed(2)}B`;
    } else if (a >= 1_000_000) {
      // Millions (M)
      formatted = `${(a / 1_000_000).toFixed(2)}M`;
    } else if (a >= 1_000) {
      // Thousands (K)
      formatted = `${(a / 1_000).toFixed(2)}K`;
    } else {
      // Regular numbers
      formatted = a.toString();
    }
    
    // Remove trailing zeros and decimal point if not needed
    formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
    
    return `${sign}${formatted}`;
  };

  return (
    <Text style={[styles.text, style]}>
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
