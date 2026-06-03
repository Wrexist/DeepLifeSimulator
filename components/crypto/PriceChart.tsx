import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { responsiveFontSize, responsiveSpacing } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  /** Oldest-first list of price points. */
  history: { weeksLived: number; price: number }[];
  darkMode: boolean;
  height?: number;
  /** Strokes the line in this color; defaults to up/down green/red based on net move. */
  color?: string;
}

/**
 * Minimal sparkline. Lays out points as a sequence of <View> bars on a baseline,
 * preserving aspect across light/dark themes without pulling in a chart library.
 */
export default function PriceChart({ history, darkMode, height = 64, color }: Props) {
  const theme = getThemeColors(darkMode);

  if (history.length < 2) {
    return (
      <View style={[styles.empty, { height, backgroundColor: theme.surfaceElevated }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No price history yet</Text>
      </View>
    );
  }

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const first = prices[0];
  const last = prices[prices.length - 1];
  const up = last >= first;
  const strokeColor = color ?? (up ? accent.success : accent.danger);
  const trackColor = up ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';

  return (
    <View style={[styles.wrap, { height, backgroundColor: trackColor }]}>
      {history.map((h, i) => {
        const norm = (h.price - min) / range;
        const colHeight = Math.max(2, norm * (height - 4));
        return (
          <View
            key={i}
            style={[
              styles.col,
              {
                height: colHeight,
                backgroundColor: strokeColor,
                opacity: 0.5 + 0.5 * (i / history.length),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 1,
    overflow: 'hidden',
  },
  col: {
    flex: 1,
    minWidth: 1,
    borderRadius: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    padding: responsiveSpacing.sm,
  },
  emptyText: {
    fontSize: responsiveFontSize.xs,
  },
});
