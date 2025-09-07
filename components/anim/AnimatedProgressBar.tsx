import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';

interface AnimatedProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showPercentage?: boolean;
  color?: string;
  gradient?: string[];
  animated?: boolean;
  label?: string;
}

export default function AnimatedProgressBar({
  progress,
  height = 8,
  showPercentage = false,
  color = '#3B82F6',
  gradient,
  animated = true,
  label
}: AnimatedProgressBarProps) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  const clampedProgress = Math.max(0, Math.min(100, progress));

  const progressColors = gradient || [color, color + '80'];

  return (
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
      
      <View style={[
        styles.progressContainer,
        { height },
        isDarkMode && styles.progressContainerDark
      ]}>
        <MotiView
          from={{ scaleX: 0 }}
          animate={{ scaleX: clampedProgress / 100 }}
          transition={{
            type: animated ? 'spring' : 'timing',
            damping: 15,
            stiffness: 100,
            duration: animated ? undefined : 800,
          }}
          style={styles.progressBar}
        >
          <LinearGradient
            colors={progressColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { height }]}
          />
        </MotiView>
        
        {/* Shine Effect */}
        <MotiView
          from={{ translateX: -100 }}
          animate={{ translateX: 100 }}
          transition={{
            type: 'timing',
            duration: 1500,
            loop: true,
          }}
          style={styles.shineEffect}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  percentageDark: {
    color: '#9CA3AF',
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressContainerDark: {
    backgroundColor: '#374151',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    borderRadius: 4,
  },
  shineEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 20,
    transform: [{ skewX: '-20deg' }],
  },
});
