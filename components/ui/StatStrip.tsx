/**
 * StatStrip / StatTile - "a number with a label under it", once.
 *
 * The 19 phone apps carried ~30 of these under as many names (StatCard,
 * StatPill, Kpi, MoneyStat, MiniStat, BoardStat, AggStat, StatCell, Counter,
 * SummaryCell, BondStat, KV, FactCell, ...). Every one was: big tabular value,
 * small muted label, optional tint. A strip is 2-4 tiles in a row divided by
 * hairlines - and the rule the audit set is that a strip shows the two or
 * three numbers a player decides on, with everything else behind a breakdown.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';

export interface StatTileProps {
  label: string;
  value: string | number;
  /** A second, smaller line under the value ("+2.1% this week"). */
  sub?: string;
  /** Colours the value only - the label stays muted so the colour means something. */
  tint?: string;
  /** Left-align (default centred, for strips). */
  align?: 'center' | 'left';
  /** Larger value - for the ONE headline number on a screen. */
  hero?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ label, value, sub, tint, align = 'center', hero = false, style }: StatTileProps) {
  const { theme } = useTheme();
  const alignItems = align === 'left' ? 'flex-start' : 'center';
  const textAlign = align === 'left' ? 'left' : 'center';
  return (
    <View
      style={[styles.tile, { alignItems }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} ${value}${sub ? `, ${sub}` : ''}`}
    >
      <Text style={[styles.value, hero && styles.valueHero, { color: tint ?? theme.text, textAlign }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: theme.textMuted, textAlign }]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: theme.textSecondary, textAlign }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export default function StatStrip({ items, style }: { items: StatTileProps[]; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.strip, style]}>
      {items.map((item, i) => (
        <React.Fragment key={`${item.label}-${i}`}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
          <StatTile {...item} style={[styles.stripTile, item.style]} />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: responsiveSpacing.xs,
  },
  stripTile: {
    flex: 1,
    paddingHorizontal: responsiveSpacing.xs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: scale(4),
  },
  tile: {
    gap: scale(2),
  },
  value: {
    fontSize: fontScale(17),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  valueHero: {
    fontSize: fontScale(28),
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  label: {
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  sub: {
    fontSize: fontScale(11),
  },
});
