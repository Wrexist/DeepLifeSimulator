/**
 * ProgressBar - the linear sibling of ProgressRing.
 *
 * Eight apps declared a track/fill pair (durTrack/durFill, gaugeTrack,
 * meterTrack, capTrack, hypeTrack, conditionBarTrack, progressTrack, and an
 * ASCII one). `value` is 0-1; `color` is for MEANING (green = fine, amber =
 * attention, red = failing) and defaults to the info blue. Labeled for screen
 * readers as a progressbar with the percentage, which none of the copies were.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { accent, withAlpha } from '@/lib/config/theme';
import { responsiveBorderRadius, scale } from '@/utils/scaling';

export default function ProgressBar({
  value,
  color = accent.info,
  height = scale(6),
  label,
  style,
}: {
  /** 0..1 - clamped. */
  value: number;
  color?: string;
  height?: number;
  /** What the bar measures ("Condition"), for screen readers. */
  label?: string;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const pct = Math.round(v * 100);
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: withAlpha(color, 0.14) || theme.border }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ? `${label} ${pct} percent` : `${pct} percent`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: responsiveBorderRadius.full,
  },
  fill: {
    height: '100%',
  },
});
