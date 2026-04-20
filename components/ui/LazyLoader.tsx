import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';

interface LazyLoaderProps {
  children: React.ReactNode;
  delay?: number;
  fallback?: React.ReactNode;
  style?: ViewStyle;
  threshold?: number; // Intersection observer threshold
}

export default function LazyLoader({ 
  children, 
  delay = 100, 
  fallback,
  style,
  threshold = 0.1 
}: LazyLoaderProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isVisible, delay]);

  const handleLayout = () => {
    if (containerRef.current && !isVisible) {
      // Simple visibility check - in a real app you'd use Intersection Observer
      setIsVisible(true);
    }
  };

  const defaultFallback = (
    <View style={[styles.fallback, style]}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );

  return (
    <View ref={containerRef} style={style} onLayout={handleLayout}>
      {isLoaded ? children : (fallback || defaultFallback)}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
});
