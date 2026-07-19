import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BudgetCategory, BudgetWeekBucket } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  buckets: BudgetWeekBucket[];
  darkMode: boolean;
  /** How many weeks to aggregate. Defaults to 4 (a month). */
  weeks?: number;
  /**
   * v22 Wave A (computer-only): weekly per-category budget caps. When set, each
   * row shows the weekly-average spend vs its cap with an over/under chip.
   */
  targets?: Partial<Record<BudgetCategory, number>>;
  /** Tapping a row invokes this (opens the "set cap" input). Computer-only. */
  onSetTarget?: (category: BudgetCategory) => void;
}

const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  housing: 'Housing',
  food: 'Food',
  transport: 'Transport',
  health: 'Health',
  education: 'Education',
  entertainment: 'Entertainment',
  lifestyle: 'Lifestyle',
  vice: 'Vice',
  savings: 'Savings',
  debt: 'Debt',
  taxes: 'Taxes',
  other: 'Other',
};

const CATEGORY_COLOR: Record<BudgetCategory, string> = {
  housing: accent.info,
  food: accent.warning,
  transport: '#06b6d4',
  health: '#22c55e',
  education: '#a855f7',
  entertainment: '#ec4899',
  lifestyle: '#f97316',
  vice: accent.danger,
  savings: accent.success,
  debt: '#64748b',
  taxes: '#71717a',
  other: '#94a3b8',
};

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

export default function BudgetBreakdown({ buckets, darkMode, weeks = 4, targets, onSetTarget }: Props) {
  const theme = getThemeColors(darkMode);
  const recent = [...buckets].sort((a, b) => b.weeksLived - a.weeksLived).slice(0, weeks);
  const weeksCounted = Math.max(1, recent.length);

  // Sum spend by category across the recent buckets.
  const totals: Partial<Record<BudgetCategory, number>> = {};
  let grandTotal = 0;
  for (const bucket of recent) {
    for (const [cat, amt] of Object.entries(bucket.byCategory)) {
      const k = cat as BudgetCategory;
      totals[k] = (totals[k] ?? 0) + (amt ?? 0);
      grandTotal += amt ?? 0;
    }
  }

  const rows = Object.entries(totals)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  if (rows.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: theme.border }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          No tracked spending yet. Add a bill or make a categorised purchase to start.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Last {weeks} weeks · {formatMoney(grandTotal)}
      </Text>
      {rows.map(([cat, amt]) => {
        const key = cat as BudgetCategory;
        const pct = grandTotal > 0 ? (amt ?? 0) / grandTotal : 0;
        const color = CATEGORY_COLOR[key];
        // Weekly budget cap (computer-only). Compare the weekly-average spend to
        // the cap for the over/under chip — matches the weekly overspend tick.
        const cap = targets ? targets[key] : undefined;
        const weeklyAvg = (amt ?? 0) / weeksCounted;
        const over = cap != null && cap > 0 && weeklyAvg > cap;
        const rowBody = (
          <>
            <View style={styles.rowHeader}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.catLabel, { color: theme.text }]}>{CATEGORY_LABEL[key]}</Text>
              {cap != null && cap > 0 && (
                <View style={[styles.capChip, { backgroundColor: (over ? accent.danger : accent.success) + '22' }]}>
                  <Text style={[styles.capChipText, { color: over ? accent.danger : accent.success }]}>
                    {over ? 'over' : 'ok'} · {formatMoney(cap)}/wk
                  </Text>
                </View>
              )}
              <Text style={[styles.amount, { color: theme.textSecondary }]}>{formatMoney(amt ?? 0)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? accent.danger : color }]} />
            </View>
            {onSetTarget && (
              <Text style={[styles.setHint, { color: theme.textMuted }]}>
                {cap != null && cap > 0 ? 'Tap to change weekly cap' : 'Tap to set a weekly cap'}
              </Text>
            )}
          </>
        );
        return onSetTarget ? (
          <TouchableOpacity key={key} style={styles.row} activeOpacity={0.7} onPress={() => onSetTarget(key)}>
            {rowBody}
          </TouchableOpacity>
        ) : (
          <View key={key} style={styles.row}>{rowBody}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  empty: {
    padding: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
  },
  title: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  row: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  catLabel: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  amount: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
  capChip: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 1,
    borderRadius: responsiveBorderRadius.full,
  },
  capChipText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  setHint: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  track: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
});
