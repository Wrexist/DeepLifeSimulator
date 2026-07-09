/**
 * SegmentedControl — the one shared tab/segment control for the app's in-screen
 * tab bars (Market, Work, Computer). Dark-glass container, tinted active
 * segment, muted inactive text. Replaces three near-identical hand-rolled bars.
 *
 * Each segment may carry an optional `icon` (leading) and an optional
 * `accessory` (a sibling rendered next to the touchable — e.g. Market's
 * InfoButton, which must sit outside the tap target so it doesn't switch tabs).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { accent } from '@/lib/config/theme';
import { fontScale, scale, responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';

export interface Segment<T extends string> {
  key: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Rendered beside the touchable (outside the tap target), e.g. an InfoButton. */
  accessory?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Active tint + icon color. Default: theme info blue. */
  activeColor?: string;
  style?: ViewStyle;
}

const MUTED = 'rgba(226, 232, 240, 0.45)';
const ACTIVE_TEXT = '#F8FAFC';

export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  activeColor = accent.info,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {segments.map((seg) => {
        const active = seg.key === value;
        const Icon = seg.icon;
        return (
          <View key={seg.key} style={styles.slot}>
            <TouchableOpacity
              style={[styles.tab, active && { backgroundColor: activeColor + '2E' }]}
              onPress={() => onChange(seg.key)}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={seg.label}
            >
              {Icon ? <Icon size={scale(16)} color={active ? activeColor : MUTED} /> : null}
              <Text style={[styles.text, { color: active ? ACTIVE_TEXT : MUTED }]} numberOfLines={1}>
                {seg.label}
              </Text>
            </TouchableOpacity>
            {seg.accessory}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: scale(4),
    gap: scale(4),
  },
  slot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    minHeight: scale(40),
  },
  text: {
    fontSize: fontScale(12.5),
    fontWeight: '600',
  },
});
