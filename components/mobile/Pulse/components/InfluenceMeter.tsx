/**
 * InfluenceMeter — tier progress pill (Novice → Celebrity).
 *
 * Renders the current tier name + a magenta-indigo gradient fill bar that
 * shows progress to the next tier. Animates the fill width on mount.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { PULSE_GRADIENT, PULSE_MOTION } from '../styles/pulseTheme';
import type { PulseInfluenceLevel } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

const TIER_ORDER: PulseInfluenceLevel[] = ['novice', 'rising', 'popular', 'influencer', 'celebrity'];
const TIER_THRESHOLDS: Record<PulseInfluenceLevel, number> = {
  novice: 0,
  rising: 1_000,
  popular: 10_000,
  influencer: 100_000,
  celebrity: 1_000_000,
};
const TIER_LABELS: Record<PulseInfluenceLevel, string> = {
  novice: 'Novice',
  rising: 'Rising Star',
  popular: 'Popular',
  influencer: 'Influencer',
  celebrity: 'Celebrity',
};

interface InfluenceMeterProps {
  followers: number;
  tier: PulseInfluenceLevel;
  compact?: boolean;
}

export default function InfluenceMeter({ followers, tier, compact = false }: InfluenceMeterProps) {
  const { theme } = useTheme();
  const fill = useRef(new Animated.Value(0)).current;

  const tierIdx = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[tierIdx + 1];
  const currentThreshold = TIER_THRESHOLDS[tier];
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : currentThreshold;
  const progress =
    nextTier && nextThreshold > currentThreshold
      ? Math.max(0, Math.min(1, (followers - currentThreshold) / (nextThreshold - currentThreshold)))
      : 1;

  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      fill.setValue(progress);
    } else {
      Animated.timing(fill, {
        toValue: progress,
        duration: PULSE_MOTION.countUp,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, fill, reduced]);

  const barHeight = compact ? scale(4) : scale(8);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Influence: ${TIER_LABELS[tier]}, ${followers.toLocaleString()} followers${
        nextTier ? `, ${(nextThreshold - followers).toLocaleString()} to ${TIER_LABELS[nextTier]}` : ''
      }`}
      accessibilityValue={{ min: 0, max: 100, now: Math.floor(progress * 100) }}
    >
      {!compact && (
        <View style={styles.headerRow}>
          <Text style={[styles.tierName, { color: theme.text }]}>{TIER_LABELS[tier]}</Text>
          {nextTier ? (
            <Text style={[styles.tierHint, { color: theme.textSecondary }]}>
              {followers.toLocaleString()} / {nextThreshold.toLocaleString()}
            </Text>
          ) : (
            <Text style={[styles.tierHint, { color: theme.textSecondary }]}>Max tier</Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height: barHeight, backgroundColor: theme.border }]}>
        <Animated.View
          style={[
            styles.fillWrap,
            {
              width: fill.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { height: barHeight }]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: responsiveSpacing.xs,
  },
  tierName: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  tierHint: {
    fontSize: fontScale(11),
  },
  track: {
    width: '100%',
    borderRadius: scale(999),
    overflow: 'hidden',
  },
  fillWrap: {
    height: '100%',
    borderRadius: scale(999),
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    borderRadius: scale(999),
  },
});
