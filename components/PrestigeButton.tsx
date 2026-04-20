import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { Crown, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';

interface PrestigeButtonProps {
  onPress: () => void;
}

export default function PrestigeButton({ onPress }: PrestigeButtonProps) {
  const { gameState } = useGame();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  const currentNetWorth = netWorth(gameState);
  const prestigeLevel = gameState.prestige?.prestigeLevel || 0;
  const threshold = getPrestigeThreshold(prestigeLevel);
  // Only check actual net worth, not the flag (which might be stale)
  const isAvailable = currentNetWorth >= threshold;
  const progress = Math.min(100, (currentNetWorth / threshold) * 100);

  useEffect(() => {
    if (isAvailable) {
      // Pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Glow animation
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();

      // Sparkle animation
      const sparkle = Animated.loop(
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      sparkle.start();

      return () => {
        pulse.stop();
        glow.stop();
        sparkle.stop();
      };
    }
  }, [isAvailable, pulseAnim, glowAnim, sparkleAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    if (amount > 10_000) return `$${(amount / 1_000).toFixed(2)}K`;
    return `$${Math.floor(amount).toLocaleString()}`;
  };

  if (!isAvailable) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#374151', '#1F2937']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Crown size={16} color="#9CA3AF" />
          <View style={styles.textContainer}>
            <Text style={styles.label}>Prestige</Text>
            <Text style={styles.progressText}>
              {formatMoney(currentNetWorth)} / {formatMoney(threshold)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#F59E0B', '#D97706', '#B45309']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Animated.View
            style={[
              styles.sparkleContainer,
              {
                opacity: sparkleAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 1, 0],
                }),
              },
            ]}
          >
            <Sparkles size={16} color="#FFFFFF" />
          </Animated.View>
          <Crown size={20} color="#FFFFFF" />
          <View style={styles.textContainer}>
            <Text style={styles.availableLabel}>PRESTIGE AVAILABLE!</Text>
            <Text style={styles.availableSubtext}>
              {formatMoney(currentNetWorth)} Net Worth
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginVertical: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 44,
    gap: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glowContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  sparkleContainer: {
    position: 'absolute',
    left: 8,
    top: 8,
  },
  textContainer: {
    flex: 1,
    marginLeft: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  progressText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  availableLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  availableSubtext: {
    fontSize: 11,
    color: '#FEF3C7',
    marginTop: 2,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
});


