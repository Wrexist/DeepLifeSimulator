import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text, ViewStyle, Platform } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;

const NATIVE_OK = Platform.OS !== 'web';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  height?: number;
  width?: string | number;
  showPercentage?: boolean;
  animated?: boolean;
  duration?: number;
  color?: string[];
  backgroundColor?: string;
  style?: ViewStyle;
  label?: string;
}

export default function ProgressIndicator({
  progress,
  height = 8,
  width = '100%',
  showPercentage = false,
  animated = true,
  duration = 500,
  color = ['#3B82F6', '#1D4ED8'],
  backgroundColor = '#E5E7EB',
  style,
  label,
}: ProgressIndicatorProps) {
  // 0..1 value; we animate transform:scaleX (native-safe)
  const value = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, progress)) / 100; // 0..1
    if (animated) {
      Animated.timing(value, {
        toValue: clamped,
        duration,
        useNativeDriver: NATIVE_OK, // native on iOS/Android, JS on web
      }).start();
    } else {
      value.setValue(clamped);
    }
  }, [progress, animated, duration, value]);

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: NATIVE_OK }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1500, useNativeDriver: NATIVE_OK }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  // scaleX 0..1 instead of width interpolation
  const scaleX = value;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {showPercentage && <Text style={styles.percentage}>{Math.round(progress)}%</Text>}
        </View>
      )}

      <View style={[styles.track, { height, width: width as any, backgroundColor }]}>
        <Animated.View style={[styles.progress, { width: '100%', height, transform: [{ scaleX }] }]}>
          <LinearGradient
            colors={color as unknown as readonly [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {animated && (
            <Animated.View style={[styles.shimmer, { transform: [{ translateX }] }]} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

/** Circular progress (simple faux ring). JS driver by design (layout-like). */
interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  animated?: boolean;
  duration?: number;
  showPercentage?: boolean;
  style?: ViewStyle;
}

export function CircularProgress({
  progress,
  size = 100,
  strokeWidth = 8,
  color = '#3B82F6',
  backgroundColor = '#E5E7EB',
  animated = true,
  duration = 500,
  showPercentage = true,
  style,
}: CircularProgressProps) {
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, progress));
    if (animated) {
      Animated.timing(animatedProgress, {
        toValue: clamped,
        duration,
        useNativeDriver: false, // stroke/size-like behavior â†’ JS driver
      }).start();
    } else {
      animatedProgress.setValue(clamped);
    }
  }, [progress, animated, duration, animatedProgress]);

  return (
    <View style={[styles.circularContainer, { width: size, height: size }, style]}>
      <View
        style={[
          styles.circularTrack,
          { borderWidth: strokeWidth, borderRadius: size / 2, borderColor: backgroundColor },
        ]}
      />
      <View
        style={[
          styles.circularProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderTopColor: color,
            borderRightColor: color,
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate: '-90deg' }],
            position: 'absolute',
            top: 0,
            left: 0,
          },
        ]}
      />
      {showPercentage && (
        <View style={styles.percentageContainer}>
          <Text style={styles.circularPercentage}>{Math.round(progress)}%</Text>
        </View>
      )}
    </View>
  );
}

/** Loading spinner (transform rotate). Native on device, JS on web. */
export function LoadingSpinner({
  size = 40,
  color = '#3B82F6',
  style,
}: {
  size?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, useNativeDriver: NATIVE_OK })
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.spinnerContainer, { width: size, height: size }, style]}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: size / 8,
            borderColor: color,
            borderTopColor: 'transparent',
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 14, fontWeight: '500', color: '#374151' },
  percentage: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  track: { borderRadius: 4, overflow: 'hidden', position: 'relative' },
  progress: { borderRadius: 4, overflow: 'hidden', position: 'relative' },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: '50%',
  },

  circularContainer: { justifyContent: 'center', alignItems: 'center' },
  circularTrack: { position: 'absolute', width: '100%', height: '100%' },
  circularProgress: { position: 'absolute' },
  percentageContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  circularPercentage: { fontSize: 16, fontWeight: '600', color: '#374151' },

  spinnerContainer: { justifyContent: 'center', alignItems: 'center' },
  spinner: { borderStyle: 'solid' },
});

