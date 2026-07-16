import React, { useRef, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { Crown, Sparkles } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';
const LinearGradient = LinearGradientFallback;

interface PrestigeButtonProps {
  onPress: () => void;
}

export default function PrestigeButton({ onPress }: PrestigeButtonProps) {
  const currentNetWorth = useGameSelector((s) => netWorth(s));
  const prestigeLevel = useGameSelector((s) => s.prestige?.prestigeLevel || 0);
  const reduced = useReducedMotion();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  const threshold = getPrestigeThreshold(prestigeLevel);
  // Only check actual net worth, not the flag (which might be stale)
  const isAvailable = currentNetWorth >= threshold;
  const progress = Math.min(100, (currentNetWorth / threshold) * 100);

  useEffect(() => {
    if (isAvailable) {
      // Reduced motion: skip the looping pulse/glow/sparkle (movement + loops).
      // Keep the button reading as "glowing" by parking glowAnim at a static
      // mid value so its opacity feedback stays.
      if (reduced) {
        glowAnim.setValue(0.5);
        return;
      }

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

      // Glow animation — drives opacity only, so the native driver is safe.
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
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
    return;
  }, [isAvailable, reduced, pulseAnim, glowAnim, sparkleAnim]);

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
          colors={['#334155', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Crown size={16} color="#94A3B8" />
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
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(245, 158, 11, 0.3)' } as any,
      default: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
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
    color: '#94A3B8',
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


