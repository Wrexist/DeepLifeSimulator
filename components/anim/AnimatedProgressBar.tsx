import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ColorValue, StyleProp, ViewStyle } from 'react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';

type GradientColors = readonly [ColorValue, ColorValue] | readonly [ColorValue, ColorValue, ...ColorValue[]];

const DEFAULT_HEIGHT = scale(8);
const GRADIENT_RADIUS = scale(12);

interface AnimatedProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showPercentage?: boolean;
  color?: ColorValue;
  gradient?: GradientColors;
  animated?: boolean;
  label?: string;
}

export default function AnimatedProgressBar({
  progress,
  height = DEFAULT_HEIGHT,
  showPercentage = false,
  color = '#3B82F6',
  gradient,
  animated = true,
  label
}: AnimatedProgressBarProps) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  const backgroundColors = useMemo<readonly [ColorValue, ColorValue]>(
    () => (isDarkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']),
    [isDarkMode]
  );
  const clampedProgress = useMemo(() => Math.max(0, Math.min(100, progress)), [progress]);
  const progressColors = useMemo<GradientColors>(() => {
    if (gradient && gradient.length >= 2) {
      return gradient;
    }
    return [color, `${String(color)}B3`] as const;
  }, [gradient, color]);
  const progressContainerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [styles.progressContainer, { height }, isDarkMode && styles.progressContainerDark],
    [height, isDarkMode]
  );
  const progressFillStyle = useMemo<StyleProp<ViewStyle>>(() => [styles.progressFill, { height }], [height]);
  const progressFrom = useMemo(() => ({ scaleX: 0 }), []);
  const progressAnimate = useMemo(() => ({ scaleX: clampedProgress / 100 }), [clampedProgress]);
  const barTransition = useMemo(
    () =>
      animated
        ? {
            type: 'spring' as const,
            damping: 15,
            stiffness: 100,
          }
        : {
            type: 'timing' as const,
            duration: 800,
          },
    [animated]
  );
  const shineTransition = useMemo(
    () => ({
      type: 'timing' as const,
      duration: 1500,
      loop: true,
    }),
    []
  );
  const shineFrom = useMemo(() => ({ translateX: -100 }), []);
  const shineAnimate = useMemo(() => ({ translateX: 100 }), []);

  return (
    <LinearGradient colors={backgroundColors} style={styles.gradientBackground}>
      <View style={styles.container}>
        {label && (
          <View style={styles.labelContainer}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              {label}
            </Text>
            {showPercentage && (
              <Text style={[styles.percentage, isDarkMode && styles.percentageDark]}>
                {Math.round(clampedProgress)}%
              </Text>
            )}
          </View>
        )}

        <View style={progressContainerStyle}>
          <MotiView from={progressFrom} animate={progressAnimate} transition={barTransition} style={styles.progressBar}>
            <LinearGradient
              colors={progressColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={progressFillStyle}
            />
          </MotiView>

          {/* Shine Effect */}
          <MotiView from={shineFrom} animate={shineAnimate} transition={shineTransition} style={styles.shineEffect} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    width: '100%',
    borderRadius: GRADIENT_RADIUS,
    padding: scale(8),
  },
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  label: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  percentage: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#6B7280',
  },
  percentageDark: {
    color: '#9CA3AF',
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
    position: 'relative',
  },
  progressContainerDark: {
    backgroundColor: '#374151',
  },
  progressBar: {
    height: '100%',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    borderRadius: scale(4),
  },
  shineEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: scale(20),
    transform: [{ skewX: '-20deg' }],
  },
});
