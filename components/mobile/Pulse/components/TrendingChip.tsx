/**
 * TrendingChip - glass pill with hashtag + signed velocity arrow.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { PULSE_COLORS } from '../styles/pulseTheme';

interface TrendingChipProps {
  tag: string;
  velocity: number; // 0-100; sign treated as direction
  whyReason?: string;
  onPress?: () => void;
}

export default function TrendingChip({ tag, velocity, whyReason, onPress }: TrendingChipProps) {
  const { theme } = useTheme();
  const isUp = velocity >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const color = isUp ? PULSE_COLORS.success : PULSE_COLORS.danger;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tag}, ${isUp ? 'trending up' : 'trending down'} ${Math.abs(velocity)} percent${whyReason ? `. ${whyReason}` : ''}`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.tag, { color: theme.text }]} numberOfLines={1}>
        {tag}
      </Text>
      <View style={styles.velRow}>
        <Icon size={fontScale(10)} color={color} strokeWidth={3} />
        <Text style={[styles.vel, { color }]}>{Math.abs(velocity)}%</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tag: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  velRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  vel: {
    fontSize: fontScale(10),
    fontWeight: '700',
  },
});
