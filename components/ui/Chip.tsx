/**
 * Chip - the small labeled pill, once.
 *
 * ~20 local chip styles across the 19 apps (BenefitChip, ReqChip, SpecChip,
 * FootChip, StatChip, InfoChip, LedgerChip, QuietChip, SortChip, ...) were
 * all: optional icon + short label, tinted fill at ~12% and a rim at ~30%.
 * `tone` names the meaning; a raw `tint` is for an app's identity colour.
 * Pressable when `onPress` is given (a filter/sort chip), with `selected`
 * exposed to screen readers.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { accent, withAlpha } from '@/lib/config/theme';
import { fontScale, responsiveBorderRadius, scale } from '@/utils/scaling';

export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_COLOR: Record<Exclude<ChipTone, 'neutral'>, string> = {
  info: accent.info,
  success: accent.success,
  warning: accent.warning,
  danger: accent.danger,
};

export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  tone?: ChipTone;
  /** Identity colour (6-digit hex). Overrides `tone`. */
  tint?: string;
  onPress?: () => void;
  selected?: boolean;
  /** Screen-reader label when the visible text is not enough. */
  accessibilityLabel?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Chip({
  label,
  icon,
  tone = 'neutral',
  tint,
  onPress,
  selected = false,
  accessibilityLabel,
  size = 'sm',
  style,
}: ChipProps) {
  const { theme } = useTheme();
  const color = tint ?? (tone === 'neutral' ? undefined : TONE_COLOR[tone]);
  const on = selected || (!onPress && !!color);
  const fill = color ? withAlpha(color, on ? 0.16 : 0.08) : theme.surfaceElevated;
  const rim = color ? withAlpha(color, on ? 0.35 : 0.18) : theme.border;
  const textColor = color && on ? color : theme.textSecondary;
  const body = (
    <>
      {icon}
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const box = [styles.chip, size === 'md' && styles.chipMd, { backgroundColor: fill, borderColor: rim }, style];
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={box}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return (
    <View style={box} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: scale(26),
  },
  chipMd: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    minHeight: scale(36),
  },
  text: {
    fontSize: fontScale(11.5),
    fontWeight: '500',
  },
  textMd: {
    fontSize: fontScale(13),
  },
});
